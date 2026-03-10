/**
 * content-loader.ts — Load panel definitions from JSON and YAML canvas files.
 */

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { CEPanelDef } from "./panel-types.js";
import type { CanvasColumnDef, CanvasDocument } from "../../src/core/canvas-types.js";
export type { CanvasColumnDef, CanvasDocument } from "../../src/core/canvas-types.js";

/**
 * Load all panel definitions from a directory.
 * Reads *.json (single def or array) and *.canvas.yaml (panels array).
 * Files sorted alphabetically for consistent ordering.
 */
export function loadPanelsFromDir(dir: string): CEPanelDef[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json") || f.endsWith(".canvas.yaml"))
    .sort()
    .flatMap(f => {
      try {
        const filePath = path.join(dir, f);
        if (f.endsWith(".canvas.yaml")) {
          return loadCanvasPanels(filePath);
        }
        // JSON
        const raw = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [data];
      } catch {
        return [];
      }
    });
}

/**
 * Load panels from a .canvas.yaml file.
 * Expected shape: { meta: {...}, panels: CEPanelDef[] }
 */
export function loadCanvasPanels(filePath: string): CEPanelDef[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const doc = YAML.parse(raw);
  if (!doc || !Array.isArray(doc.panels)) return [];
  return doc.panels as CEPanelDef[];
}

/**
 * Load canvas meta + panels from a .canvas.yaml file.
 */
export function loadCanvas(filePath: string): CanvasDocument | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const doc = YAML.parse(raw);
    if (!doc || !Array.isArray(doc.panels) || doc.panels.length === 0) return null;

    const columns = new Map<number, CanvasColumnDef>();
    if (doc.columns && typeof doc.columns === "object") {
      for (const [key, val] of Object.entries(doc.columns)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx) && val && typeof val === "object") {
          columns.set(idx, val as CanvasColumnDef);
        }
      }
    }

    // Post-process panels: split animated-text frames from text field
    const panels = (doc.panels as CEPanelDef[]).map(p => {
      if (p.type === "animated-text" && !p.frames && p.text) {
        // Split text on ~~~ separator into frames
        return { ...p, frames: p.text.split(/\n~~~\n/), live: true };
      }
      if (p.type === "animated-text" && p.frames) {
        // Frames already provided as YAML array — just ensure live
        return { ...p, live: true };
      }
      return p;
    });

    return {
      title: doc.meta?.title ?? "Untitled",
      columnHeaders: doc.meta?.columnHeaders === true,
      columns,
      panels,
    };
  } catch { return null; }
}

/**
 * Watch a directory for changes and call onChange when files are added/modified/removed.
 * Returns a cleanup function to stop watching.
 */
export function watchPanelDir(dir: string, onChange: () => void): () => void {
  if (!fs.existsSync(dir)) return () => {};

  const watcher = fs.watch(dir, { recursive: false }, () => onChange());
  return () => watcher.close();
}
