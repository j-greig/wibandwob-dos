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

/** Restores a window from a snapshot. Should call exactly one open* action and return the created window. */
export type SnapshotRestorer = (snapshot: WindowSnapshot, payload: Record<string, unknown>, actions: SnapshotRestoreActions) => WindowRecord | undefined;

export interface SnapshotHandler {
  serialize: SnapshotSerializer;
  restore: SnapshotRestorer;
}

// ---------------------------------------------------------------------------
// Restore actions — the set of openers available during restore.
// Extend this when adding new persistable window types.
// ---------------------------------------------------------------------------

type MaybeWindow = WindowRecord | undefined;

export interface SnapshotRestoreActions {
  openPrimerWindow: (filePath: string) => MaybeWindow;
  openEditorWindow: (filePath: string | undefined, title: string, initial: string, restore?: { cursor?: number; viewMode?: "edit" | "view"; scrollOffset?: number; figlet?: boolean }) => MaybeWindow;
  openBrowserReaderWindow: (filePath?: string) => MaybeWindow;
  openFigletWindow: (text: string, font: string) => MaybeWindow;
  openPrimerGalleryWindow: (restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number }) => MaybeWindow;
  openPrimerBrowserWindow: (restore?: { selectedIndex?: number }) => MaybeWindow;
  openFileManagerWindow: (restore?: { currentPath?: string; selectedIndex?: number; filterValue?: string; searchQuery?: string; searchMode?: "simple" | "advanced"; viewMode?: "list" | "icon"; showHidden?: boolean; sortField?: "name" | "size" | "modified" | "type" }) => MaybeWindow;
  openBackroomsTv: (channel: BackroomsChannel) => MaybeWindow;
  openBackroomsLogBrowserWindow: () => MaybeWindow;
  openBackroomsPrimerPickerWindow: () => MaybeWindow;
  openChromeBrowserWindow: (restore?: { url?: string }) => MaybeWindow;
  openCompanionWindow: (restore?: { tick?: number; displayMode?: string }) => MaybeWindow;

  openWibWobAgentWindow: () => MaybeWindow;
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
      return snapshot.filePath ? actions.openPrimerWindow(snapshot.filePath) : undefined;
    },
  },

  // --- kind: "editor" ---
  "text-editor": {
    serialize: (window) => {
      const d = getDetails(window);
      const viewMode = detailString(d, "viewMode");
      if (viewMode === "view") {
        // Markdown view mode — save scroll + figlet state
        return {
          viewMode: "view",
          scrollOffset: detailNumber(d, "scrollOffset") ?? 0,
          figlet: d.figlet !== false,
        };
      }
      return window.editor
        ? { content: window.editor.value, cursor: window.editor.cursor }
        : undefined;
    },
    restore: (snapshot, payload, actions) => {
      const viewMode = typeof payload.viewMode === "string" ? payload.viewMode as "edit" | "view" : undefined;
      return actions.openEditorWindow(
        snapshot.filePath,
        snapshot.title,
        typeof payload.content === "string"
          ? payload.content
          : snapshot.filePath && fs.existsSync(snapshot.filePath)
            ? fs.readFileSync(snapshot.filePath, "utf8")
            : "",
        {
          cursor: typeof payload.cursor === "number" ? payload.cursor : undefined,
          viewMode,
          scrollOffset: typeof payload.scrollOffset === "number" ? payload.scrollOffset : undefined,
          figlet: typeof payload.figlet === "boolean" ? payload.figlet : undefined,
        }
      );
    },
  },

  // --- kind: "reader" ---
  "reader-viewer": {
    serialize: (_window) => undefined,
    restore: (snapshot, _payload, actions) => {
      return actions.openBrowserReaderWindow(snapshot.filePath);
    },
  },

  // --- kind: "figlet" --- (E039: migrated to microapp, legacy remap handles old files)

  // --- kind: "pattern" --- (migrated to microapp.wibwob.generative)

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
      return actions.openPrimerGalleryWindow({
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
      return actions.openPrimerBrowserWindow({
        selectedIndex: typeof payload.selectedIndex === "number" ? payload.selectedIndex : undefined,
      });
    },
  },

  "file-manager": {
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
      return actions.openFileManagerWindow({
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
      return actions.openBackroomsLogBrowserWindow();
    },
  },

  "web-reader": {
    serialize: (window) => ({
      currentUrl: detailString(getDetails(window), "currentUrl"),
    }),
    restore: (_snapshot, payload, actions) => {
      return actions.openChromeBrowserWindow({
        url: typeof payload.currentUrl === "string" ? payload.currentUrl : undefined,
      });
    },
  },

  "backrooms-primer-picker": {
    serialize: (_window) => undefined,
    restore: (_snapshot, _payload, actions) => {
      return actions.openBackroomsPrimerPickerWindow();
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
      return actions.openBackroomsTv({
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
    serialize: (window) => {
      const details = getDetails(window);
      return {
        tick: detailNumber(details, "tick") ?? 0,
        displayMode: typeof details?.displayMode === "string" ? details.displayMode : "floating",
      };
    },
    restore: (_snapshot, payload, actions) => {
      return actions.openCompanionWindow({
        tick: typeof payload.tick === "number" ? payload.tick : undefined,
        displayMode: typeof payload.displayMode === "string" ? payload.displayMode : undefined,
      });
    },
  },

  // --- kind: "art" --- (migrated to microapp.wibwob.generative)

  // monster-cam — migrated to microapps/monster-cam/ (restore via microapp loader)

  // --- kind: "chat" (wibwob-agent) ---
  "wibwob-agent": {
    serialize: (window) => {
      const details = window.describeState?.();
      return details?.messages ? { messages: details.messages } : undefined;
    },
    restore: (_snapshot, _payload, actions) => {
      return actions.openWibWobAgentWindow();
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

export function clearDynamicSnapshots(predicate?: (appType: string) => boolean): number {
  const before = dynamicHandlers.size;
  if (!predicate) {
    dynamicHandlers.clear();
    return before;
  }
  for (const appType of [...dynamicHandlers.keys()]) {
    if (predicate(appType)) {
      dynamicHandlers.delete(appType);
    }
  }
  return before - dynamicHandlers.size;
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
// Built-in type remaps are typed strictly; dynamic module remaps are plain strings.
const legacyAppTypeRemap: Record<string, string> = {
  "wibwob-chat-v2": "wibwob-agent",
  "chat-transcript": "wibwob-agent",
  // E033 — nomenclature cleanup
  "farjs-file-manager": "file-manager",
  "chrome-browser": "web-reader",
  // E031 S21 — "markdown-viewer" renamed to "reader"
  "markdown-viewer": "reader",
  // E032 S02 — "reader" appType (old markdown-viewer) merged into "text-editor"
  "reader": "text-editor",
  // E039 — microapp owns its own snapshot now
  "figlet-banner": "wibwob.figlet",
  "contour-studio": "wibwob.contour",
  // E031 — module ID normalisation (S00b): old IDs → wibwob.slug
  "world-chatroom": "wibwob.chatroom",
  "wibwobworld": "wibwob.world",
  "monster-cam": "wibwob.monster-cam",
  "patchbay.lab": "wibwob.patchbay",
  "touchlab.mvp": "wibwob.touchlab",
  "example.hello-world": "wibwob.example.hello",
  "wibwob.e026-demo": "wibwob.example.e026",
};

// Maps WindowKind → default PersistableAppType for old workspace files
// that were saved before the registry existed (no appType in payload).
const kindFallbackMap: Partial<Record<string, PersistableAppType | string>> = {
  primer: "primer-viewer",
  editor: "text-editor",
  reader: "reader-viewer",
  figlet: "wibwob.figlet",
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

/** Restore a window from a snapshot using the registry. Returns the restored window, or undefined on failure. */
export function registryRestore(
  snapshot: WindowSnapshot,
  actions: SnapshotRestoreActions
): WindowRecord | undefined {
  const payload = snapshot.payload ?? {};
  // Prefer explicit appType from payload, remap legacy values, fall back to kind-based default
  const raw = typeof payload.appType === "string" ? payload.appType : undefined;
  const remapped = raw ? (legacyAppTypeRemap[raw] ?? raw) : undefined;
  const appType = (remapped ?? kindFallbackMap[snapshot.kind]) as string | undefined;
  if (!appType) {
    console.warn(`[snapshot-registry] No restore handler for kind "${snapshot.kind}" — skipping window "${snapshot.title}"`);
    return undefined;
  }
  // Check built-in registry first, then dynamic handlers
  const handler = (snapshotRegistry as Record<string, SnapshotHandler>)[appType] ?? dynamicHandlers.get(appType);
  if (!handler) {
    console.warn(`[snapshot-registry] No restore handler for appType "${appType}" — skipping window "${snapshot.title}"`);
    return undefined;
  }
  return handler.restore(snapshot, payload, actions);
}
