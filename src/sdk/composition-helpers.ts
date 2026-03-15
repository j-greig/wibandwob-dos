/**
 * composition-helpers.ts — SDK composition helpers for microapp authors.
 *
 * Each helper creates a themed blessed widget with sensible defaults.
 * Returns a handle: { element, update(opts), destroy() }.
 *
 * Import via: import { createStatusBar, ... } from "../../src/services/microapp-sdk.js";
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface StatusBarOptions {
  /** Text for left side. Default: "" */
  left?: string;
  /** Text for right side. Default: "" */
  right?: string;
  /** Height in rows. Default: 1 */
  height?: number;
}

export interface StatusBarHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: Partial<StatusBarOptions>): void;
  destroy(): void;
}

export interface TextViewerOptions {
  /** Initial content. Default: "" */
  content?: string;
  /** Wrap long lines. Default: true */
  wrap?: boolean;
  /** Enable vi-style keys (j/k scroll). Default: true */
  vi?: boolean;
  /** Reserve bottom rows for other elements. Default: 0 */
  bottomOffset?: number;
}

export interface TextViewerHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: { content?: string }): void;
  getContent(): string;
  destroy(): void;
}

export interface ListPanelOptions {
  /** Items to display. */
  items: string[];
  /** Enable vi keys (j/k). Default: true */
  vi?: boolean;
  /** Reserve bottom rows. Default: 0 */
  bottomOffset?: number;
}

export interface ListPanelHandle {
  element: blessed.Widgets.ListElement;
  update(opts: { items?: string[]; selected?: number }): void;
  getSelected(): number;
  onSelect(cb: (index: number, item: string) => void): void;
  destroy(): void;
}

export interface SplitViewOptions {
  /** Direction. Default: "horizontal" (left/right) */
  direction?: "horizontal" | "vertical";
  /** Ratio for first pane, 0–1. Default: 0.5 */
  ratio?: number;
  /** Reserve bottom rows from parent. Default: 0 */
  bottomOffset?: number;
}

export interface SplitViewHandle {
  /** Left or top pane */
  first: blessed.Widgets.BoxElement;
  /** Right or bottom pane */
  second: blessed.Widgets.BoxElement;
  /** Outer container */
  element: blessed.Widgets.BoxElement;
  update(opts: { ratio?: number }): void;
  destroy(): void;
}

export interface ButtonBarButton {
  /** Label shown in the bar */
  label: string;
  /** Keyboard shortcut hint (e.g. "q", "C-s") */
  key?: string;
  /** Called when clicked or key pressed */
  action: () => void;
}

export interface ButtonBarOptions {
  buttons: ButtonBarButton[];
  /** Height in rows. Default: 1 */
  height?: number;
}

export interface ButtonBarHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: { buttons?: ButtonBarButton[] }): void;
  destroy(): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Themed status bar pinned to the bottom of a parent element.
 * Shows left-aligned and right-aligned text.
 */
export function createSimpleStatusBar(
  parent: blessed.Widgets.BoxElement,
  opts: StatusBarOptions = {},
): StatusBarHandle {
  const height = opts.height ?? 1;
  let left = opts.left ?? "";
  let right = opts.right ?? "";

  const t = theme();
  const el = blessed.box({
    parent,
    bottom: 0,
    left: 0,
    right: 0,
    height,
    tags: true,
    style: { fg: t.footer.fg, bg: t.footer.bg },
    content: "",
  });

  function render() {
    const w = (el.width as number) || 40;
    const gap = Math.max(1, w - left.length - right.length);
    el.setContent(`${left}${" ".repeat(gap)}${right}`);
  }

  render();

  return {
    element: el,
    update(o) {
      if (o.left !== undefined) left = o.left;
      if (o.right !== undefined) right = o.right;
      const t2 = theme();
      el.style.fg = t2.footer.fg;
      el.style.bg = t2.footer.bg;
      render();
    },
    destroy() {
      el.destroy();
    },
  };
}

/**
 * Scrollable, themed text viewer. Handles vi keys, mouse scroll, scrollbar.
 */
export function createTextViewer(
  parent: blessed.Widgets.BoxElement,
  opts: TextViewerOptions = {},
): TextViewerHandle {
  const bottomOffset = opts.bottomOffset ?? 0;
  const t = theme();

  const el = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: bottomOffset,
    keys: true,
    mouse: true,
    vi: opts.vi ?? true,
    scrollable: true,
    alwaysScroll: true,
    wrap: opts.wrap ?? true,
    scrollbar: {
      ch: "▐",
      track: { bg: t.scrollbar.track },
      style: { bg: t.scrollbar.bg, fg: t.scrollbar.fg },
    },
    style: { fg: t.body.fg, bg: t.body.bg },
    content: opts.content ?? "",
  });

  return {
    element: el,
    update(o) {
      if (o.content !== undefined) el.setContent(o.content);
      const t2 = theme();
      el.style.fg = t2.body.fg;
      el.style.bg = t2.body.bg;
    },
    getContent() {
      return el.getContent();
    },
    destroy() {
      el.destroy();
    },
  };
}

/**
 * Selectable list with theme tokens, vi keys, and mouse support.
 */
export function createListPanel(
  parent: blessed.Widgets.BoxElement,
  opts: ListPanelOptions,
): ListPanelHandle {
  const bottomOffset = opts.bottomOffset ?? 0;
  const t = theme();
  const selectCallbacks: ((index: number, item: string) => void)[] = [];

  const el = blessed.list({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: bottomOffset,
    keys: true,
    mouse: true,
    vi: opts.vi ?? true,
    items: opts.items,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: "▐",
      track: { bg: t.scrollbar.track },
      style: { bg: t.scrollbar.bg, fg: t.scrollbar.fg },
    },
    style: {
      fg: t.body.fg,
      bg: t.body.bg,
      selected: { fg: t.selected.fg, bg: t.selected.bg },
    },
  } as any);

  el.on("select", (_item: any, index: number) => {
    const text = opts.items[index] ?? "";
    for (const cb of selectCallbacks) cb(index, text);
  });

  return {
    element: el,
    update(o) {
      if (o.items !== undefined) {
        opts.items = o.items;
        el.setItems(o.items as any);
      }
      if (o.selected !== undefined) el.select(o.selected);
      const t2 = theme();
      el.style.fg = t2.body.fg;
      el.style.bg = t2.body.bg;
      (el.style as any).selected = { fg: t2.selected.fg, bg: t2.selected.bg };
    },
    getSelected() {
      return (el as any).selected ?? 0;
    },
    onSelect(cb) {
      selectCallbacks.push(cb);
    },
    destroy() {
      selectCallbacks.length = 0;
      el.destroy();
    },
  };
}

/**
 * Split view — two panes side-by-side (horizontal) or stacked (vertical).
 */
export function createSplitView(
  parent: blessed.Widgets.BoxElement,
  opts: SplitViewOptions = {},
): SplitViewHandle {
  const direction = opts.direction ?? "horizontal";
  let ratio = opts.ratio ?? 0.5;
  const bottomOffset = opts.bottomOffset ?? 0;
  const t = theme();

  const container = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: bottomOffset,
    style: { fg: t.body.fg, bg: t.body.bg },
  });

  const first = blessed.box({
    parent: container,
    top: 0,
    left: 0,
    style: { fg: t.body.fg, bg: t.body.bg },
  });

  const second = blessed.box({
    parent: container,
    style: { fg: t.body.fg, bg: t.body.bg },
  });

  function applyLayout() {
    const pct = `${Math.round(ratio * 100)}%`;
    const rest = `${Math.round((1 - ratio) * 100)}%`;
    if (direction === "horizontal") {
      first.top = 0;
      first.left = 0;
      first.width = pct;
      first.height = "100%";
      second.top = 0;
      second.left = pct;
      second.width = rest;
      second.height = "100%";
    } else {
      first.top = 0;
      first.left = 0;
      first.width = "100%";
      first.height = pct;
      second.top = pct;
      second.left = 0;
      second.width = "100%";
      second.height = rest;
    }
  }

  applyLayout();

  return {
    first,
    second,
    element: container,
    update(o) {
      if (o.ratio !== undefined) {
        ratio = o.ratio;
        applyLayout();
      }
    },
    destroy() {
      container.destroy();
    },
  };
}

/**
 * Themed button bar pinned to the bottom. Shows labelled buttons with optional key hints.
 */
export function createSimpleButtonBar(
  parent: blessed.Widgets.BoxElement,
  opts: ButtonBarOptions,
): ButtonBarHandle {
  const height = opts.height ?? 1;
  let buttons = opts.buttons;
  const t = theme();
  const keyListeners: { key: string; handler: () => void }[] = [];

  const el = blessed.box({
    parent,
    bottom: 0,
    left: 0,
    right: 0,
    height,
    tags: true,
    style: { fg: t.header.fg, bg: t.header.bg },
    content: "",
  });

  function render() {
    const parts = buttons.map((b) => {
      if (b.key) return `{bold}${b.key}{/bold}:${b.label}`;
      return b.label;
    });
    el.setContent(` ${parts.join("  ")}`);
  }

  function bindKeys() {
    // Clean up old listeners
    for (const kl of keyListeners) {
      parent.screen?.unkey(kl.key, kl.handler);
    }
    keyListeners.length = 0;
    // Bind new
    for (const b of buttons) {
      if (b.key && parent.screen) {
        const handler = () => b.action();
        parent.screen.key(b.key, handler);
        keyListeners.push({ key: b.key, handler });
      }
    }
  }

  render();
  // Defer key binding to next tick so screen is attached
  setTimeout(() => bindKeys(), 0);

  return {
    element: el,
    update(o) {
      if (o.buttons !== undefined) {
        buttons = o.buttons;
        render();
        bindKeys();
      }
      const t2 = theme();
      el.style.fg = t2.header.fg;
      el.style.bg = t2.header.bg;
    },
    destroy() {
      for (const kl of keyListeners) {
        parent.screen?.unkey(kl.key, kl.handler);
      }
      keyListeners.length = 0;
      el.destroy();
    },
  };
}
