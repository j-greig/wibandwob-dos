/**
 * file-manager/types.ts — Shared types for the File Manager v3 column browser.
 *
 * Defines the state model, file entry shape, sort/action enums.
 * No runtime dependencies — pure type definitions.
 */
import type { ChildProcess } from "node:child_process";

// ── File entry ───────────────────────────────────────────────────────────────

export interface FileEntry {
  label: string;
  fullPath: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

// ── Sort ─────────────────────────────────────────────────────────────────────

export type SortField = "name" | "size" | "modified" | "type";
export const SORT_CYCLE: readonly SortField[] = ["name", "size", "modified", "type"];

// ── Column state ─────────────────────────────────────────────────────────────

export interface ColumnState {
  path: string;
  entries: FileEntry[];
  selectedIndex: number;
}

// ── Mode discriminated union ─────────────────────────────────────────────────

export type FileManagerMode =
  | { kind: "browse" }
  | { kind: "search"; query: string; results: SearchResult[]; process: ChildProcess | null }
  | { kind: "edit"; filePath: string; dirty: boolean };

export interface SearchResult {
  file: string;
  line: number;
  text: string;
}

// ── Top-level state ──────────────────────────────────────────────────────────

interface FileManagerState {
  mode: FileManagerMode;
  columns: ColumnState[];
  activeColumn: number;
  previewFile: string | null;
  viewMode: "columns" | "icon";
  sortField: SortField;
  filterValue: string;
  splitRatio: number;
  splitLocked: boolean;
  git: {
    root: string | null;
    statusMap: Map<string, string>;
  };
}

// ── Actions (single dispatcher, no duplicate handlers) ───────────────────────

export type FileAction =
  | "open"
  | "view"
  | "edit"
  | "quicklook"
  | "copy-path"
  | "yank-contents"
  | "external-editor"
  | "reveal"
  | "navigate-into"
  | "navigate-up"
  | "navigate-to-column"
  | "filter-focus"
  | "search-start"
  | "search-cancel"
  | "toggle-view"
  | "sort-cycle"
  | "refresh"
  | "context-menu";

// ── File manager window params (passed to the factory) ───────────────────────

export interface FileManagerParams {
  screen: import("blessed").Widgets.Screen;
  windowManager: import("../../core/window-manager.js").WindowManager;
  overlays: import("../../core/overlay-manager.js").OverlayManager;
  startPath: string;
  restore?: FileManagerRestore;
  onOpenFile: (filePath: string) => void;
  onViewFile: (filePath: string) => void;
  onStateChanged: () => void;
}

export interface FileManagerRestore {
  currentPath?: string;
  filterValue?: string;
  viewMode?: "columns" | "icon";
  sortField?: SortField;
  searchQuery?: string;
  searchMode?: string;
  columns?: Array<{ path: string; selectedIndex: number }>;
}
