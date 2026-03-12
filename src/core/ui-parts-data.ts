/**
 * ui-parts-data.ts — Data display component primitives.
 *
 * Module authors: import from ../../src/services/microapp-sdk.js
 * All components follow the component contract (.agents/module-dev/component-contract.md)
 * All return LayoutPart for composition with createStack/createRow/createGrid.
 */
import blessed from "blessed";
import { theme } from "./theme/resolver.js";
import type { Rect, LayoutPart } from "./ui-parts.js";

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
