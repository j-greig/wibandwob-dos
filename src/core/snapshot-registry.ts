/**
 * Snapshot Registry — compiler-enforced save/restore parity.
 *
 * Every persistable window type must register both a serialize and restore
 * handler here. If you add a new SnapshotAppType without adding a handler
 * entry, TypeScript will error on the `satisfies Record<...>` assertion.
 *
 * Transient window types (palette, workspace-manager, state-inspector) are
 * intentionally excluded — they are never persisted to workspace files.
 */

import fs from "node:fs";
import { getDefaultFigletFont } from "../services/figlet-service.js";
import type { PersistableAppType, WindowRecord, WindowSnapshot, BackroomsChannel } from "./types.js";
import type { WindowFacade } from "./window-facade.js";



// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

/** Extracts persistable payload from a live window. */
export type SnapshotSerializer = (window: WindowRecord) => Record<string, unknown> | undefined;

/** Restores a window from a snapshot. Should call exactly one open* action. */
export type SnapshotRestorer = (snapshot: WindowSnapshot, payload: Record<string, unknown>, actions: SnapshotRestoreActions) => void;

export interface SnapshotHandler {
  serialize: SnapshotSerializer;
  restore: SnapshotRestorer;
}

// ---------------------------------------------------------------------------
// Restore actions — the set of openers available during restore.
// Extend this when adding new persistable window types.
// ---------------------------------------------------------------------------

export interface SnapshotRestoreActions {
  openPrimerWindow: (filePath: string) => void;
  openEditorWindow: (filePath: string | undefined, title: string, initial: string, restore?: { cursor?: number }) => void;
  openBrowserReaderWindow: (filePath?: string) => void;
  openFigletWindow: (text: string, font: string) => void;
  openPatternWindow: () => void;
  openPrimerGalleryWindow: (restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number }) => void;
  openPrimerBrowserWindow: (restore?: { selectedIndex?: number }) => void;
  openFileManagerWindow: (restore?: { currentPath?: string; selectedIndex?: number; filterValue?: string; searchQuery?: string; searchMode?: "simple" | "advanced"; viewMode?: "list" | "icon"; showHidden?: boolean; sortField?: "name" | "size" | "modified" | "type" }) => void;
  openBackroomsTv: (channel: BackroomsChannel) => void;
  openBackroomsLogBrowserWindow: () => void;
  openBackroomsPrimerPickerWindow: () => void;
  openChromeBrowserWindow: (restore?: { url?: string }) => void;
  openCompanionWindow: (restore?: { tick?: number }) => void;
  openArtWindow: () => void;
  openMonsterCamWindow: () => void;
  openWibWobAgentWindow: () => void;
  windows: WindowFacade;
}

// ---------------------------------------------------------------------------
// Shared serialization helpers
// ---------------------------------------------------------------------------

function getDetails(window: WindowRecord): Record<string, unknown> {
  return window.describeState?.() ?? {};
}

function detailString(details: Record<string, unknown>, key: string): string | undefined {
  const v = details[key];
  return typeof v === "string" ? v : undefined;
}

function detailNumber(details: Record<string, unknown>, key: string): number | undefined {
  const v = details[key];
  return typeof v === "number" ? v : undefined;
}

// ---------------------------------------------------------------------------
// The registry — compiler-checked exhaustive map.
// ---------------------------------------------------------------------------

export const snapshotRegistry = {

  // --- kind: "primer" ---
  "primer-viewer": {
    serialize: (_window) => undefined,
    restore: (snapshot, _payload, actions) => {
      if (snapshot.filePath) actions.openPrimerWindow(snapshot.filePath);
    },
  },

  // --- kind: "editor" ---
  "text-editor": {
    serialize: (window) =>
      window.editor
        ? { content: window.editor.value, cursor: window.editor.cursor }
        : undefined,
    restore: (snapshot, payload, actions) => {
      actions.openEditorWindow(
        snapshot.filePath,
        snapshot.title,
        typeof payload.content === "string"
          ? payload.content
          : snapshot.filePath && fs.existsSync(snapshot.filePath)
            ? fs.readFileSync(snapshot.filePath, "utf8")
            : "",
        { cursor: typeof payload.cursor === "number" ? payload.cursor : undefined }
      );
    },
  },

  // --- kind: "reader" ---
  "reader-viewer": {
    serialize: (_window) => undefined,
    restore: (snapshot, _payload, actions) => {
      actions.openBrowserReaderWindow(snapshot.filePath);
    },
  },

  // --- kind: "figlet" ---
  "figlet-banner": {
    serialize: (window) => {
      const d = getDetails(window);
      return {
        inputText: detailString(d, "inputText") ?? window.title.replace(/^Banner:\s*/, ""),
        font: detailString(d, "font") ?? getDefaultFigletFont(),
      };
    },
    restore: (_snapshot, payload, actions) => {
      actions.openFigletWindow(
        typeof payload.inputText === "string" ? payload.inputText : "WibWob",
        typeof payload.font === "string" ? payload.font : getDefaultFigletFont()
      );
    },
  },

  // --- kind: "pattern" ---
  "pattern-animation": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      actions.openPatternWindow();
    },
  },

  // --- kind: "gallery" ---
  "primer-gallery": {
    serialize: (window) => {
      const d = getDetails(window);
      return {
        activeTabIndex: detailNumber(d, "activeTabIndex") ?? 0,
        searchValue: detailString(d, "searchValue") ?? "",
        selectedIndex: detailNumber(d, "selectedIndex") ?? 0,
      };
    },
    restore: (_snapshot, payload, actions) => {
      actions.openPrimerGalleryWindow({
        activeTabIndex: typeof payload.activeTabIndex === "number" ? payload.activeTabIndex : undefined,
        searchValue: typeof payload.searchValue === "string" ? payload.searchValue : undefined,
        selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined,
      });
    },
  },

  // --- kind: "browser" — five appTypes sharing one frame kind ---

  "primer-browser": {
    serialize: (window) => ({
      selectedIndex: detailNumber(getDetails(window), "selectedIndex") ?? 0,
    }),
    restore: (_snapshot, payload, actions) => {
      actions.openPrimerBrowserWindow({
        selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined,
      });
    },
  },

  "farjs-file-manager": {
    serialize: (window) => {
      const d = getDetails(window);
      return {
        currentPath: detailString(d, "currentPath"),
        filterValue: detailString(d, "filterValue"),
        selectedIndex: detailNumber(d, "selectedIndex") ?? 0,
        searchQuery: detailString(d, "searchQuery"),
        searchMode: d.searchMode === "simple" || d.searchMode === "advanced" ? d.searchMode : undefined,
        viewMode: d.viewMode === "list" || d.viewMode === "icon" ? d.viewMode : undefined,
        showHidden: typeof d.showHidden === "boolean" ? d.showHidden : undefined,
        sortField: ["name", "size", "modified", "type"].includes(d.sortField as string) ? d.sortField : undefined,
      };
    },
    restore: (_snapshot, payload, actions) => {
      actions.openFileManagerWindow({
        currentPath: typeof payload.currentPath === "string" ? payload.currentPath : undefined,
        filterValue: typeof payload.filterValue === "string" ? payload.filterValue : undefined,
        selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined,
        searchQuery: typeof payload.searchQuery === "string" ? payload.searchQuery : undefined,
        searchMode: payload.searchMode === "simple" || payload.searchMode === "advanced" ? payload.searchMode : undefined,
        viewMode: payload.viewMode === "list" || payload.viewMode === "icon" ? payload.viewMode : undefined,
        showHidden: typeof payload.showHidden === "boolean" ? payload.showHidden : undefined,
        sortField: ["name", "size", "modified", "type"].includes(payload.sortField as string) ? payload.sortField as "name" | "size" | "modified" | "type" : undefined,
      });
    },
  },

  "backrooms-log-browser": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      actions.openBackroomsLogBrowserWindow();
    },
  },

  "chrome-browser": {
    serialize: (window) => ({
      currentUrl: detailString(getDetails(window), "currentUrl"),
    }),
    restore: (_snapshot, payload, actions) => {
      actions.openChromeBrowserWindow({
        url: typeof payload.currentUrl === "string" ? payload.currentUrl : undefined,
      });
    },
  },

  "backrooms-primer-picker": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      actions.openBackroomsPrimerPickerWindow();
    },
  },

  // --- kind: "backrooms" ---
  "backrooms-tv": {
    serialize: (window) => {
      const d = getDetails(window);
      return {
        theme: detailString(d, "theme") ?? "liminal fluorescent maze",
        primers: detailString(d, "primers") ?? "",
        turns: detailNumber(d, "turns") ?? 3,
        model:
          d.model === "haiku" || d.model === "opus" || d.model === "sonnet"
            ? d.model : "sonnet",
        mode:
          d.requestedMode === "live" || d.requestedMode === "fake-live" || d.requestedMode === "auto"
            ? d.requestedMode : "auto",
      };
    },
    restore: (_snapshot, payload, actions) => {
      actions.openBackroomsTv({
        theme: typeof payload.theme === "string" ? payload.theme : "liminal fluorescent maze",
        primers: typeof payload.primers === "string" ? payload.primers : "",
        turns: typeof payload.turns === "number" ? payload.turns : 3,
        model:
          payload.model === "haiku" || payload.model === "opus" || payload.model === "sonnet"
            ? payload.model : "sonnet",
        mode:
          payload.mode === "live" || payload.mode === "fake-live" || payload.mode === "auto"
            ? payload.mode : "auto",
      });
    },
  },

  // --- kind: "companion" ---
  "companion-widget": {
    serialize: (window) => ({
      tick: detailNumber(getDetails(window), "tick") ?? 0,
    }),
    restore: (_snapshot, payload, actions) => {
      actions.openCompanionWindow({
        tick: typeof payload.tick === "number" ? payload.tick : undefined,
      });
    },
  },

  // --- kind: "art" ---
  "generative-art": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      actions.openArtWindow();
    },
  },

  // --- kind: "monster-cam" ---
  "monster-cam": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      actions.openMonsterCamWindow();
    },
  },

  // --- kind: "chat" (wibwob-agent) ---
  "wibwob-agent": {
    serialize: (window) => {
      const details = window.describeState?.();
      return details?.messages ? { messages: details.messages } : undefined;
    },
    restore: (_snapshot, _payload, actions) => {
      actions.openWibWobAgentWindow();
    },
  },

} satisfies Record<PersistableAppType, SnapshotHandler>;

// ---------------------------------------------------------------------------
// Dynamic snapshot handlers — registered by microapp modules at runtime.
// ---------------------------------------------------------------------------

const dynamicHandlers = new Map<string, SnapshotHandler>();

/**
 * Register a snapshot handler for a dynamic appType (microapp module).
 * Called by MicroappHost.registerSnapshot() during module setup.
 */
export function registerDynamicSnapshot(appType: string, handler: SnapshotHandler): void {
  if (dynamicHandlers.has(appType)) {
    console.warn(`[snapshot-registry] Duplicate dynamic handler for "${appType}" — overwriting`);
  }
  dynamicHandlers.set(appType, handler);
}

// ---------------------------------------------------------------------------
// Public API — used by workspace-snapshots.ts
// ---------------------------------------------------------------------------

/** Check whether a window should be included in workspace snapshots. */
export function isPersistable(window: WindowRecord): boolean {
  const appType = window.describeState?.()?.appType;
  if (!appType) return false;
  return (appType in snapshotRegistry) || dynamicHandlers.has(appType);
}

/** Serialize a window's payload using the registry. Returns undefined for unknown/transient types. */
export function registrySerialize(window: WindowRecord): Record<string, unknown> | undefined {
  const appType = window.describeState?.()?.appType as string | undefined;
  if (!appType) return undefined;
  // Check built-in registry first, then dynamic handlers
  const handler = (snapshotRegistry as Record<string, SnapshotHandler>)[appType] ?? dynamicHandlers.get(appType);
  if (!handler) return undefined;
  const payload = handler.serialize(window);
  // Always include appType in the payload so restore can dispatch on it
  return payload ? { ...payload, appType } : { appType };
}

// Legacy appType remaps — old workspace files may contain retired appTypes.
const legacyAppTypeRemap: Record<string, PersistableAppType> = {
  "wibwob-chat-v2": "wibwob-agent",
  "chat-transcript": "wibwob-agent",
};

// Maps WindowKind → default PersistableAppType for old workspace files
// that were saved before the registry existed (no appType in payload).
const kindFallbackMap: Partial<Record<string, PersistableAppType>> = {
  primer: "primer-viewer",
  editor: "text-editor",
  reader: "reader-viewer",
  figlet: "figlet-banner",
  pattern: "pattern-animation",
  gallery: "primer-gallery",
  browser: "primer-browser",
  backrooms: "backrooms-tv",
  companion: "companion-widget",
  art: "generative-art",
  "monster-cam": "monster-cam",
  chat: "wibwob-agent",
  inspector: undefined,  // transient, skip
  palette: undefined,    // transient, skip
  workspace: undefined,  // transient, skip
};

/** Restore a window from a snapshot using the registry. Returns false for unknown types. */
export function registryRestore(
  snapshot: WindowSnapshot,
  actions: SnapshotRestoreActions
): boolean {
  const payload = snapshot.payload ?? {};
  // Prefer explicit appType from payload, remap legacy values, fall back to kind-based default
  const raw = typeof payload.appType === "string" ? payload.appType : undefined;
  const remapped = raw ? (legacyAppTypeRemap[raw] ?? raw) : undefined;
  const appType = (remapped ?? kindFallbackMap[snapshot.kind]) as string | undefined;
  if (!appType) {
    console.warn(`[snapshot-registry] No restore handler for kind "${snapshot.kind}" — skipping window "${snapshot.title}"`);
    return false;
  }
  // Check built-in registry first, then dynamic handlers
  const handler = (snapshotRegistry as Record<string, SnapshotHandler>)[appType] ?? dynamicHandlers.get(appType);
  if (!handler) {
    console.warn(`[snapshot-registry] No restore handler for appType "${appType}" — skipping window "${snapshot.title}"`);
    return false;
  }
  handler.restore(snapshot, payload, actions);
  return true;
}
