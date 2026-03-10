/**
 * canvas-document.ts — Load and save .canvas.yaml documents.
 *
 * A canvas document describes a composition of desktop windows:
 * their kinds, positions, sizes, and type-specific content.
 * Documents are human-readable YAML, agent-writable, and git-diffable.
 */

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { SnapshotRestoreActions } from "../core/snapshot-registry.js";
import type { WindowFacade } from "../core/window-facade.js";
import type { WindowRecord } from "../core/types.js";

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface CanvasMeta {
  title: string;
  format?: string;
  exported?: string;
  screen?: { width: number; height: number };
  tags?: string[];
}

export interface CanvasWindowEntry {
  id?: string;
  kind: string;
  title?: string;
  position?: { x: number; y: number };
  size?: { w: number; h: number };
  // Kind-specific fields
  text?: string;        // figlet
  font?: string;        // figlet
  file?: string;        // primer, ascii-art
  content?: string;     // text (inline)
  agent?: boolean;      // chat
  model?: string;       // chat
  url?: string;         // browser
  filePath?: string;    // editor, markdown, reader
}

export interface CanvasDocument {
  meta: CanvasMeta;
  windows: CanvasWindowEntry[];
}

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

export function parseCanvasDocument(yamlStr: string): CanvasDocument {
  const raw = YAML.parse(yamlStr);
  if (!raw || typeof raw !== "object") {
    throw new Error("Canvas document: invalid YAML — expected an object at root");
  }
  if (!raw.meta || typeof raw.meta !== "object") {
    throw new Error("Canvas document: missing 'meta' section");
  }
  if (!raw.meta.title) {
    throw new Error("Canvas document: meta.title is required");
  }
  if (!Array.isArray(raw.windows)) {
    throw new Error("Canvas document: missing 'windows' array");
  }
  for (let i = 0; i < raw.windows.length; i++) {
    const w = raw.windows[i];
    if (!w.kind) {
      throw new Error(`Canvas document: windows[${i}] missing 'kind'`);
    }
  }
  return raw as CanvasDocument;
}

export function loadCanvasFile(filePath: string): CanvasDocument {
  const content = fs.readFileSync(filePath, "utf8");
  return parseCanvasDocument(content);
}

// ---------------------------------------------------------------------------
// Restore: open windows from a canvas document
// ---------------------------------------------------------------------------

export interface CanvasLoadResult {
  loaded: number;
  skipped: number;
  errors: string[];
  windows: WindowRecord[];
}

/** Window kinds that are singletons — skip if already open. */
const SINGLETON_KINDS = new Set(["chat", "companion", "monster-cam"]);

export function restoreCanvas(
  doc: CanvasDocument,
  actions: SnapshotRestoreActions,
): CanvasLoadResult {
  const result: CanvasLoadResult = { loaded: 0, skipped: 0, errors: [], windows: [] };

  // Track which singleton kinds we've already seen in this load
  const existingWindows = actions.windows.getWindows();
  const existingSingletons = new Set(
    existingWindows
      .filter(w => SINGLETON_KINDS.has(w.kind as string))
      .map(w => w.kind as string)
  );

  for (const entry of doc.windows) {
    // Skip singleton kinds that already exist
    if (SINGLETON_KINDS.has(entry.kind) && existingSingletons.has(entry.kind)) {
      // Just reposition the existing one
      const existing = existingWindows.find(w => w.kind === entry.kind);
      if (existing && entry.position) {
        actions.windows.moveWindow(existing.id, entry.position.x, entry.position.y);
      }
      if (existing && entry.size) {
        actions.windows.resizeWindow(existing.id, entry.size.w, entry.size.h);
      }
      result.loaded++;
      continue;
    }

    try {
      const win = restoreWindowEntry(entry, actions);
      if (win) {
        if (SINGLETON_KINDS.has(entry.kind)) existingSingletons.add(entry.kind);
        // Apply position and size
        if (entry.position) {
          actions.windows.moveWindow(win.id, entry.position.x, entry.position.y);
        }
        if (entry.size) {
          actions.windows.resizeWindow(win.id, entry.size.w, entry.size.h);
        }
        result.windows.push(win);
        result.loaded++;
      } else {
        result.skipped++;
        result.errors.push(`Skipped: ${entry.kind} "${entry.title ?? entry.id ?? "?"}" — no handler`);
      }
    } catch (e) {
      result.skipped++;
      result.errors.push(`Error: ${entry.kind} "${entry.title ?? entry.id ?? "?"}" — ${e}`);
    }
  }

  return result;
}

function restoreWindowEntry(
  entry: CanvasWindowEntry,
  actions: SnapshotRestoreActions,
): WindowRecord | undefined {
  switch (entry.kind) {
    case "figlet":
      return actions.openFigletWindow(
        entry.text ?? entry.title ?? "HELLO",
        entry.font ?? "standard",
      );

    case "primer":
      if (entry.file) {
        return actions.openPrimerWindow(entry.file);
      }
      return undefined;

    case "chat":
      return actions.openWibWobAgentWindow();

    case "editor":
      return actions.openEditorWindow(
        entry.filePath,
        entry.title ?? "Untitled",
        entry.content ?? "",
      );

    case "reader":
      return actions.openBrowserReaderWindow(entry.filePath);

    case "markdown-viewer":
      if (entry.filePath) {
        return actions.openMarkdownViewerWindow(entry.filePath);
      }
      return undefined;

    case "browser":
      return actions.openChromeBrowserWindow(
        entry.url ? { url: entry.url } : undefined,
      );

    case "art":
    case "plasma":
      return actions.openArtWindow();

    case "pattern":
      return actions.openPatternWindow();

    case "companion":
      return actions.openCompanionWindow();

    case "monster-cam":
      return actions.openMonsterCamWindow();

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Export: current desktop → canvas document YAML
// ---------------------------------------------------------------------------

export function exportCanvasDocument(
  windows: WindowRecord[],
  windowFacade: WindowFacade,
  title: string = "Untitled Canvas",
): string {
  const entries: CanvasWindowEntry[] = [];

  for (const w of windows) {
    const entry: CanvasWindowEntry = {
      id: `w${w.id}`,
      kind: w.kind,
      title: w.title,
      position: {
        x: Number(w.frame.left) || 0,
        y: Number(w.frame.top) || 0,
      },
      size: {
        w: Number(w.frame.width) || 40,
        h: Number(w.frame.height) || 15,
      },
    };

    // Kind-specific fields
    const details = w.describeState?.() as Record<string, unknown> | undefined;
    if (w.kind === "figlet" && details) {
      entry.text = (details.inputText as string) ?? "";
      entry.font = (details.font as string) ?? "standard";
    } else if (w.kind === "primer" && w.filePath) {
      entry.file = w.filePath;
    } else if (w.kind === "chat") {
      entry.agent = true;
      if (details?.model) entry.model = details.model as string;
    } else if (w.kind === "browser" && details) {
      entry.url = (details.url as string) ?? "";
    } else if ((w.kind === "editor" || w.kind === "markdown-viewer") && w.filePath) {
      entry.filePath = w.filePath;
    }

    entries.push(entry);
  }

  const doc: CanvasDocument = {
    meta: {
      title,
      format: "wibwob-canvas-v1",
      exported: new Date().toISOString().slice(0, 10),
    },
    windows: entries,
  };

  return "# wibwob-canvas v1\n" + YAML.stringify(doc, {
    lineWidth: 120,
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
  });
}
