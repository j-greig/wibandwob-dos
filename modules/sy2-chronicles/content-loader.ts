/**
 * content-loader.ts — Load panel definitions from JSON files + hot-reload watcher.
 */

import fs from "node:fs";
import path from "node:path";
import type { CEPanelDef } from "./panel-types.js";

/**
 * Load all panel definitions from a directory of JSON files.
 * Each file can contain a single panel def or an array of panel defs.
 * Files are sorted alphabetically to ensure consistent ordering.
 */
export function loadPanelsFromDir(dir: string): CEPanelDef[] {
  if (!fs.existsSync(dir)) return [];
  
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .sort()
    .flatMap(f => {
      try {
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [data];
      } catch {
        return [];
      }
    });
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
