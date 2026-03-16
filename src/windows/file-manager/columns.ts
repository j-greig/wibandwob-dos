/**
 * file-manager/columns.ts — Column browser widget management.
 *
 * Creates, positions, and destroys blessed list widgets for each directory column.
 * Handles horizontal scrolling when columns exceed the available width.
 */
import blessed from "blessed";
import type { FileEntry, ColumnState, SortField } from "./types.js";
import { fileIcon, fileColour, formatSize, escapeBlessedTags } from "./icons.js";
import { gitIndicator, type GitState } from "./git.js";
import { theme } from "../../core/theme/resolver.js";
import { createScrollbar } from "../../core/ui-primitives.js";
import fs from "node:fs";
import path from "node:path";

// ── Constants ────────────────────────────────────────────────────────────────

const COLUMN_MIN_WIDTH = 22;
const COLUMN_MAX_WIDTH = 40;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColumnWidget {
  list: blessed.Widgets.ListElement;
  state: ColumnState;
  /** Update list items without firing select events. */
  setItemsSilent(items: string[]): void;
  /** Destroy the blessed widget. */
  destroy(): void;
}

export interface ColumnManagerDeps {
  parent: blessed.Widgets.BoxElement;
  screen: blessed.Widgets.Screen;
  git: GitState;
  sortField: SortField;
  onSelect: (columnIndex: number, entry: FileEntry) => void;
  onNavigateInto: (columnIndex: number, dirPath: string) => void;
  onNavigateUp: () => void;
}

// ── Entry building ───────────────────────────────────────────────────────────

export function buildEntries(dirPath: string, sortField: SortField): FileEntry[] {
  let items: FileEntry[] = [];
  try {
    const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    items = dirents.map(d => {
      const fullPath = path.join(dirPath, d.name);
      const label = d.isDirectory() ? d.name + "/" : d.name;
      let size = 0, mtime = 0;
      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch {}
      return { label, fullPath, isDirectory: d.isDirectory(), size, mtime };
    });
  } catch {}

  // Sort: dirs first, then by sortField
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    switch (sortField) {
      case "size": return b.size - a.size;
      case "modified": return b.mtime - a.mtime;
      case "type": {
        const ea = path.extname(a.label).toLowerCase();
        const eb = path.extname(b.label).toLowerCase();
        return ea.localeCompare(eb) || a.label.localeCompare(b.label);
      }
      default: return a.label.localeCompare(b.label);
    }
  });

  // Add parent entry
  if (dirPath !== "/" && dirPath !== path.parse(dirPath).root) {
    items.unshift({ label: "../", fullPath: path.dirname(dirPath), isDirectory: true, size: 0, mtime: 0 });
  }

  return items;
}

// ── Format a list item ───────────────────────────────────────────────────────

export function formatColumnItem(entry: FileEntry, git: GitState, width: number): string {
  const icon = fileIcon(entry);
  const col = fileColour(entry);
  const gi = gitIndicator(git, entry.fullPath);
  const safeName = escapeBlessedTags(entry.label);

  if (entry.isDirectory) {
    const arrow = entry.label === "../" ? "" : " \u25B8";
    const nameSpace = Math.max(6, width - icon.length - 5);
    const name = safeName.length > nameSpace ? safeName.slice(0, nameSpace - 1) + "\u2026" : safeName;
    return `${gi}{${col}-fg}${icon}{/${col}-fg} ${name}${arrow}`;
  }

  const size = formatSize(entry.size);
  const nameSpace = Math.max(6, width - icon.length - size.length - 6);
  const name = safeName.length > nameSpace ? safeName.slice(0, nameSpace - 1) + "\u2026" : safeName.padEnd(nameSpace);
  return `${gi}{${col}-fg}${icon}{/${col}-fg} ${name} {gray-fg}${size}{/gray-fg}`;
}

// ── Column creation ──────────────────────────────────────────────────────────

export function createColumn(
  deps: ColumnManagerDeps,
  columnIndex: number,
  dirPath: string,
  left: number,
  width: number,
  selectedIndex = 0,
): ColumnWidget {
  const entries = buildEntries(dirPath, deps.sortField);
  const state: ColumnState = { path: dirPath, entries, selectedIndex };

  const list = blessed.list({
    parent: deps.parent,
    top: 0,
    left,
    width,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    tags: true,
    items: entries.map(e => formatColumnItem(e, deps.git, width)),
    style: {
      ...theme().body,
      selected: theme().selected,
      item: theme().body,
    },
  } as blessed.Widgets.ListOptions<blessed.Widgets.ListElementStyle>);

  list.select(Math.min(selectedIndex, entries.length - 1));

  // Selection change → preview or navigate
  // Guard: setItems() fires "select item" — prevent recursion
  let suppressSelectItem = false;
  list.on("select item", () => {
    if (suppressSelectItem) return;
    const idx = list.selected;
    state.selectedIndex = idx;
    const entry = entries[idx];
    if (entry) {
      deps.onSelect(columnIndex, entry);
    }
  });

  // Enter → open or navigate into
  list.on("select", (_item, idx) => {
    const entry = entries[idx];
    if (!entry) return;
    if (entry.isDirectory) {
      if (entry.label === "../") {
        deps.onNavigateUp();
      } else {
        deps.onNavigateInto(columnIndex, entry.fullPath);
      }
    } else {
      // File selected — let the parent handle open
      deps.onSelect(columnIndex, entry);
    }
  });

  return {
    list,
    state,
    setItemsSilent(items: string[]) {
      suppressSelectItem = true;
      list.setItems(items);
      suppressSelectItem = false;
    },
    destroy() {
      list.destroy();
    },
  };
}

// ── Column layout calculation ────────────────────────────────────────────────

export function calculateColumnLayout(
  columnCount: number,
  availableWidth: number,
  previewWidth: number,
): { columnWidth: number; visibleColumns: number; scrollOffset: number; previewLeft: number } {
  const columnsSpace = availableWidth - previewWidth;
  const idealWidth = Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, Math.floor(columnsSpace / Math.max(1, columnCount))));
  const visibleColumns = Math.max(1, Math.floor(columnsSpace / idealWidth));
  const scrollOffset = Math.max(0, columnCount - visibleColumns);
  const actualColumnsWidth = Math.min(visibleColumns, columnCount) * idealWidth;
  const previewLeft = actualColumnsWidth;

  return {
    columnWidth: idealWidth,
    visibleColumns,
    scrollOffset,
    previewLeft,
  };
}
