/**
 * ui-parts-data.ts — Data display component primitives.
 *
 * Module authors: import from ../../src/services/microapp-sdk.js
 * All components follow the component contract (.agents/microapp-dev/component-contract.md)
 * All return LayoutPart for composition with createStack/createRow/createGrid.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import type { Rect, LayoutPart } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// createKeyValuePanel
// ═══════════════════════════════════════════════════════════════════════════

export interface KVEntry {
  key: string;
  value: string;
}

export interface KeyValuePanelOptions {
  entries?: KVEntry[];
  border?: boolean;
  label?: string;
  keyWidth?: number; // fixed key column width; auto-calculated if omitted
}

export type KeyValuePanelHandle = LayoutPart<Partial<KeyValuePanelOptions>>;

/**
 * Aligned key-value pairs. Height = entry count (+ 2 if bordered).
 *
 * @example
 * const kv = createKeyValuePanel({
 *   entries: [{ key: "Name", value: "Antopolis" }, { key: "Pop", value: "142" }],
 *   border: true, label: "Stats",
 * });
 */
export function createKeyValuePanel(opts: KeyValuePanelOptions = {}): KeyValuePanelHandle {
  let { entries = [], border = false, label = "", keyWidth } = opts;

  const node = blessed.box({
    width: 0,
    height: 0,
    content: "",
    border: border ? "line" : undefined,
    label: label && border ? ` ${label} ` : undefined,
    style: getStyle(),
    tags: false,
  });

  function getStyle() {
    const t = theme();
    return {
      fg: t.body.fg,
      bg: t.body.bg,
      border: border ? { fg: t.muted.fg } : undefined,
    };
  }

  function renderContent(availWidth: number) {
    if (entries.length === 0) { node.setContent(""); return; }
    const kw = keyWidth ?? Math.max(...entries.map(e => e.key.length));
    const innerW = border ? Math.max(1, availWidth - 2) : availWidth;
    const lines = entries.map(e => {
      const k = e.key.padEnd(kw);
      const sep = " : ";
      const maxVal = Math.max(0, innerW - kw - sep.length - 1);
      const v = e.value.length > maxVal ? e.value.slice(0, maxVal) : e.value;
      return ` ${k}${sep}${v}`;
    });
    node.setContent(lines.join("\n"));
  }

  function naturalHeight() {
    return entries.length + (border ? 2 : 0);
  }

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = Math.min(rect.height, naturalHeight());
      renderContent(rect.width);
    },
    restyle() {
      node.style = getStyle();
      if (border) node.style.border = { fg: theme().muted.fg };
    },
    destroy() { node.destroy(); },
    update(props: Partial<KeyValuePanelOptions>) {
      if (props.entries !== undefined) entries = props.entries;
      if (props.border !== undefined) border = props.border;
      if (props.label !== undefined) label = props.label;
      if (props.keyWidth !== undefined) keyWidth = props.keyWidth;
      if (border) {
        node.border = { type: "line" } as any;
        node.setLabel(label ? ` ${label} ` : "");
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createLogView
// ═══════════════════════════════════════════════════════════════════════════

export type LogSeverity = "info" | "success" | "warning" | "error";

export interface LogEntry {
  text: string;
  severity?: LogSeverity;
}

export interface LogViewOptions {
  maxEntries?: number;
  autoscroll?: boolean;
  border?: boolean;
  label?: string;
}

export type LogViewHandle = LayoutPart<Partial<LogViewOptions>> & {
  append(entry: LogEntry | string): void;
  clear(): void;
  entries(): readonly LogEntry[];
};

const SEVERITY_PREFIX: Record<LogSeverity, string> = {
  info: "  ",
  success: "+ ",
  warning: "~ ",
  error: "! ",
};

/**
 * A rolling event log with optional severity prefixes.
 * Append entries with `.append()`. Auto-scrolls to bottom.
 *
 * @example
 * const log = createLogView({ maxEntries: 50, border: true, label: "Events" });
 * log.append({ text: "Reactor online", severity: "success" });
 * log.append("Plain message");
 */
export function createLogView(opts: LogViewOptions = {}): LogViewHandle {
  let { maxEntries = 100, autoscroll = true, border = false, label = "" } = opts;
  const _entries: LogEntry[] = [];

  const node = blessed.box({
    width: 0,
    height: 0,
    content: "",
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    border: border ? "line" : undefined,
    label: label && border ? ` ${label} ` : undefined,
    style: getStyle(),
    tags: false,
  });

  function getStyle() {
    const t = theme();
    return {
      fg: t.body.fg,
      bg: t.body.bg,
      border: border ? { fg: t.muted.fg } : undefined,
    };
  }

  function renderContent() {
    const lines = _entries.map(e => {
      const prefix = SEVERITY_PREFIX[e.severity ?? "info"];
      return `${prefix}${e.text}`;
    });
    node.setContent(lines.join("\n"));
    // Guard: setScrollPerc crashes if node not yet attached to screen
    if (autoscroll && node.screen) {
      try { node.setScrollPerc(100); } catch { /* not yet rendered */ }
    }
  }

  function append(entry: LogEntry | string) {
    const e: LogEntry = typeof entry === "string" ? { text: entry } : entry;
    _entries.push(e);
    while (_entries.length > maxEntries) _entries.shift();
    renderContent();
    node.screen?.render();
  }

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = rect.height;
      renderContent();
    },
    restyle() {
      node.style = getStyle();
    },
    destroy() { node.destroy(); },
    update(props: Partial<LogViewOptions>) {
      if (props.maxEntries !== undefined) maxEntries = props.maxEntries;
      if (props.autoscroll !== undefined) autoscroll = props.autoscroll;
      if (props.label !== undefined) {
        label = props.label;
        if (border) node.setLabel(label ? ` ${label} ` : "");
      }
    },
    append,
    clear() {
      _entries.length = 0;
      renderContent();
    },
    entries() { return _entries; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createDataTable
// ═══════════════════════════════════════════════════════════════════════════

export interface DataColumn {
  key: string;
  label: string;
  width?: number; // fixed char width; flex (proportional) if omitted
}

export interface DataTableOptions {
  columns: DataColumn[];
  rows?: Record<string, string>[];
  sortable?: boolean;
  onSelect?: (row: Record<string, string>, index: number) => void;
}

export type DataTableHandle = LayoutPart<Partial<DataTableOptions>> & {
  selectedIndex(): number;
  selectedRow(): Record<string, string> | undefined;
};

/**
 * A sortable data table with column headers, row selection, and keyboard nav.
 * Arrow Up/Down navigates rows, Enter selects, click on header sorts.
 *
 * @example
 * const table = createDataTable({
 *   columns: [{ key: "name", label: "Name" }, { key: "pop", label: "Pop", width: 8 }],
 *   rows: [{ name: "London", pop: "9M" }, { name: "Paris", pop: "2M" }],
 *   sortable: true,
 *   onSelect: (row) => console.log(row.name),
 * });
 */
export function createDataTable(opts: DataTableOptions): DataTableHandle {
  let { columns, rows = [], sortable = false, onSelect } = opts;
  let selIndex = 0;
  // Sort state: null = unsorted, "asc" = A-Z, "desc" = Z-A
  let sortKey: string | null = null;
  let sortDir: "asc" | "desc" | null = null;
  let displayRows = rows.slice();
  let lastWidth = 0;
  let colWidthsCache: number[] = [];

  const node = blessed.box({
    width: 0,
    height: 0,
    content: "",
    focusable: true,
    mouse: true,
    keys: true,
    style: getStyle(),
    tags: false,
  });

  function getStyle() {
    const t = theme();
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function computeColWidths(totalW: number): number[] {
    const fixedCols = columns.filter(c => c.width);
    const flexCols = columns.filter(c => !c.width);
    const fixedTotal = fixedCols.reduce((s, c) => s + (c.width ?? 0), 0);
    const separators = Math.max(0, columns.length - 1);
    const remaining = Math.max(0, totalW - fixedTotal - separators);
    const flexW = flexCols.length > 0 ? Math.max(1, Math.floor(remaining / flexCols.length)) : 0;
    return columns.map(c => c.width ?? flexW);
  }

  function reSort() {
    if (!sortable || !sortKey || !sortDir) { displayRows = rows.slice(); return; }
    const key = sortKey;
    const dir = sortDir === "asc" ? 1 : -1;
    displayRows = rows.slice().sort((a, b) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }

  /** Cycle sort: unsorted → asc → desc → unsorted */
  function toggleSort(colKey: string) {
    if (!sortable) return;
    if (sortKey !== colKey) {
      // New column: start A-Z
      sortKey = colKey;
      sortDir = "asc";
    } else if (sortDir === "asc") {
      sortDir = "desc";
    } else {
      // Was desc (or null) → revert to unsorted
      sortKey = null;
      sortDir = null;
    }
    reSort();
    renderContent();
    node.screen?.render();
  }

  /** Find which column index an x position falls in, using cached widths. */
  function colIndexAtX(x: number): number {
    let cursor = 0;
    for (let i = 0; i < colWidthsCache.length; i++) {
      const w = colWidthsCache[i]!;
      if (x >= cursor && x < cursor + w) return i;
      cursor += w + 1; // +1 for separator
    }
    return -1;
  }

  function renderContent() {
    const widths = computeColWidths(lastWidth);
    colWidthsCache = widths;
    const isFocused = node.screen?.focused === node;

    // Header
    const headerCells = columns.map((c, i) => {
      let lbl = c.label;
      if (sortable && sortKey === c.key && sortDir) lbl += sortDir === "asc" ? " ^" : " v";
      return truncPad(lbl, widths[i]!);
    });
    const headerLine = headerCells.join("|");

    const sepLine = widths.map(w => "-".repeat(w)).join("+");

    // Rows
    const maxRows = Math.max(0, (Number(node.height) || 0) - 2); // header + separator
    const visible = displayRows.slice(0, maxRows);
    const rowLines = visible.map((row, ri) => {
      const cells = columns.map((c, ci) => truncPad(row[c.key] ?? "", widths[ci]!));
      const line = cells.join("|");
      const originalIndex = rows.indexOf(row);
      if (originalIndex === selIndex && isFocused) return `>${line.slice(1)}`;
      return line;
    });

    node.setContent([headerLine, sepLine, ...rowLines].join("\n"));
  }

  function truncPad(s: string, w: number): string {
    if (s.length > w) return s.slice(0, Math.max(0, w - 1)) + "~";
    return s.padEnd(w);
  }

  node.on("focus", () => renderContent());
  node.on("blur", () => renderContent());

  node.on("keypress", (_ch: string, key: { name: string }) => {
    if (!key) return;
    if (key.name === "up") {
      selIndex = Math.max(0, selIndex - 1);
      renderContent();
    } else if (key.name === "down") {
      selIndex = Math.min(rows.length - 1, selIndex + 1);
      renderContent();
    } else if (key.name === "enter") {
      if (rows[selIndex]) onSelect?.(rows[selIndex]!, selIndex);
    } else if (key.name === "left" && sortable) {
      // Cycle sort on previous column
      const curIdx = sortKey ? columns.findIndex(c => c.key === sortKey) : 0;
      const prev = (curIdx - 1 + columns.length) % columns.length;
      toggleSort(columns[prev]!.key);
    } else if (key.name === "right" && sortable) {
      // Cycle sort on next column
      const curIdx = sortKey ? columns.findIndex(c => c.key === sortKey) : -1;
      const next = (curIdx + 1) % columns.length;
      toggleSort(columns[next]!.key);
    }
  });

  node.on("click", (_data: any) => {
    node.focus();
    // Detect header row click for sorting
    if (sortable && _data && typeof _data.y === "number" && typeof _data.x === "number") {
      const relY = _data.y - (Number(node.atop ?? node.top) || 0);
      if (relY === 0) {
        // Clicked on header row
        const relX = _data.x - (Number(node.aleft ?? node.left) || 0);
        const colIdx = colIndexAtX(relX);
        if (colIdx >= 0 && colIdx < columns.length) {
          toggleSort(columns[colIdx]!.key);
        }
      }
    }
  });

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = rect.height;
      lastWidth = rect.width;
      renderContent();
    },
    restyle() {
      node.style = getStyle();
      renderContent();
    },
    destroy() { node.destroy(); },
    update(props: Partial<DataTableOptions>) {
      if (props.columns !== undefined) columns = props.columns;
      if (props.rows !== undefined) {
        rows = props.rows;
        selIndex = Math.min(selIndex, Math.max(0, rows.length - 1));
      }
      if (props.sortable !== undefined) sortable = props.sortable;
      if (props.onSelect !== undefined) onSelect = props.onSelect;
      reSort();
      renderContent();
    },
    selectedIndex() { return selIndex; },
    selectedRow() { return rows[selIndex]; },
  };
}
