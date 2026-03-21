/**
 * composition-helpers.ts — SDK composition helpers for microapp authors.
 *
 * Each helper creates a themed blessed widget with sensible defaults.
 * Takes `parent: BoxElement` as first arg, self-positions within it.
 * Returns a handle: { element, update(opts), destroy() }.
 *
 * These are the @public recommended building blocks for microapp UI.
 * Do NOT pass these handles to createStack — they lack .node/.layout()
 * and will silently produce a blank window. See GOTCHAS.md.
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
export function createStatusBar(
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
  } as Record<string, unknown>);

  el.on("select", (_item: blessed.Widgets.BlessedElement, index: number) => {
    const text = opts.items[index] ?? "";
    for (const cb of selectCallbacks) cb(index, text);
  });

  return {
    element: el,
    update(o) {
      if (o.items !== undefined) {
        opts.items = o.items;
        el.setItems(o.items as string[]);
      }
      if (o.selected !== undefined) el.select(o.selected);
      const t2 = theme();
      el.style.fg = t2.body.fg;
      el.style.bg = t2.body.bg;
      ((el.style as Record<string, any>)).selected = { fg: t2.selected.fg, bg: t2.selected.bg };
    },
    getSelected() {
      return (el as Record<string, any>).selected ?? 0;
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
export function createButtonBar(
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

// ── New Handle components (S08) ───────────────────────────────────────────

export interface HeaderBarOptions {
  /** Text for left side. Default: "" */
  left?: string;
  /** Text for right side. Default: "" */
  right?: string;
  /** Height in rows. Default: 1 */
  height?: number;
}

export interface HeaderBarHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: Partial<HeaderBarOptions>): void;
  destroy(): void;
}

/**
 * Themed header bar pinned to the top of a parent element.
 * Shows left-aligned and right-aligned text. Uses theme().header tokens.
 */
export function createHeaderBar(
  parent: blessed.Widgets.BoxElement,
  opts: HeaderBarOptions = {},
): HeaderBarHandle {
  const height = opts.height ?? 1;
  let left = opts.left ?? "";
  let right = opts.right ?? "";

  const t = theme();
  const el = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    height,
    tags: true,
    style: { fg: t.header.fg, bg: t.header.bg },
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
      el.style.fg = t2.header.fg;
      el.style.bg = t2.header.bg;
      render();
    },
    destroy() {
      el.destroy();
    },
  };
}

// ── ScrollView ────────────────────────────────────────────────────────────

export interface ScrollViewOptions {
  /** Initial content. Default: "" */
  content?: string;
  /** Wrap long lines. Default: false */
  wrap?: boolean;
  /** Enable vi keys. Default: true */
  vi?: boolean;
  /** Reserve top rows. Default: 0 */
  topOffset?: number;
  /** Reserve bottom rows. Default: 0 */
  bottomOffset?: number;
}

export interface ScrollViewHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: { content?: string }): void;
  getContent(): string;
  scrollTo(line: number): void;
  destroy(): void;
}

/**
 * Scrollable content area with themed scrollbar. Handles vi keys, mouse.
 * Like createTextViewer but with topOffset and scrollTo.
 */
export function createScrollView(
  parent: blessed.Widgets.BoxElement,
  opts: ScrollViewOptions = {},
): ScrollViewHandle {
  const t = theme();
  const el = blessed.box({
    parent,
    top: opts.topOffset ?? 0,
    left: 0,
    right: 0,
    bottom: opts.bottomOffset ?? 0,
    keys: true,
    mouse: true,
    vi: opts.vi ?? true,
    scrollable: true,
    alwaysScroll: true,
    wrap: opts.wrap ?? false,
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
    scrollTo(line) {
      el.scrollTo(line);
    },
    destroy() {
      el.destroy();
    },
  };
}

// ── Tabs ──────────────────────────────────────────────────────────────────

export interface HandleTabDef {
  /** Tab label shown in the tab bar */
  label: string;
  /** Content to render when this tab is active */
  content: string;
}

export interface TabsOptions {
  /** Tab definitions */
  tabs: HandleTabDef[];
  /** Initially active tab index. Default: 0 */
  active?: number;
  /** Reserve bottom rows. Default: 0 */
  bottomOffset?: number;
}

export interface TabsHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: { tabs?: HandleTabDef[]; active?: number }): void;
  getActive(): number;
  onSwitch(cb: (index: number) => void): void;
  destroy(): void;
}

/**
 * Tabbed container — tab bar at top, content area below.
 * Switch tabs with left/right arrow keys or number keys.
 */
export function createTabs(
  parent: blessed.Widgets.BoxElement,
  opts: TabsOptions,
): TabsHandle {
  let tabs = opts.tabs;
  let active = opts.active ?? 0;
  const bottomOffset = opts.bottomOffset ?? 0;
  const switchCallbacks: ((index: number) => void)[] = [];
  const t = theme();

  const container = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: bottomOffset,
  });

  const tabBar = blessed.box({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: t.header.fg, bg: t.header.bg },
  });

  const contentArea = blessed.box({
    parent: container,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0,
    style: { fg: t.body.fg, bg: t.body.bg },
  });

  function renderTabBar() {
    const t2 = theme();
    const parts = tabs.map((tab, i) => {
      if (i === active) return `{bold} ${tab.label} {/bold}`;
      return ` ${tab.label} `;
    });
    tabBar.setContent(parts.join("│"));
    tabBar.style.fg = t2.header.fg;
    tabBar.style.bg = t2.header.bg;
  }

  function renderContent() {
    const t2 = theme();
    contentArea.setContent(tabs[active]?.content ?? "");
    contentArea.style.fg = t2.body.fg;
    contentArea.style.bg = t2.body.bg;
  }

  function switchTo(idx: number) {
    if (idx < 0 || idx >= tabs.length) return;
    active = idx;
    renderTabBar();
    renderContent();
    for (const cb of switchCallbacks) cb(active);
  }

  // Key bindings
  container.on("keypress", (_ch: string, key: { name: string }) => {
    if (key.name === "right") switchTo((active + 1) % tabs.length);
    else if (key.name === "left") switchTo((active - 1 + tabs.length) % tabs.length);
    else if (key.name >= "1" && key.name <= "9") {
      const idx = parseInt(key.name) - 1;
      if (idx < tabs.length) switchTo(idx);
    }
  });

  renderTabBar();
  renderContent();

  return {
    element: container,
    update(o) {
      if (o.tabs !== undefined) tabs = o.tabs;
      if (o.active !== undefined) active = o.active;
      renderTabBar();
      renderContent();
    },
    getActive() {
      return active;
    },
    onSwitch(cb) {
      switchCallbacks.push(cb);
    },
    destroy() {
      switchCallbacks.length = 0;
      container.destroy();
    },
  };
}

// ── Rule ──────────────────────────────────────────────────────────────────

export interface RuleOptions {
  /** Character to repeat. Default: "─" */
  char?: string;
  /** Height in rows. Default: 1 */
  height?: number;
  /** Position from top. Default: undefined (auto) */
  top?: number | string;
}

export interface RuleHandle {
  element: blessed.Widgets.BoxElement;
  update(opts: Partial<RuleOptions>): void;
  destroy(): void;
}

/**
 * Horizontal divider line. Uses theme().muted tokens.
 */
export function createRule(
  parent: blessed.Widgets.BoxElement,
  opts: RuleOptions = {},
): RuleHandle {
  let char = opts.char ?? "─";
  const t = theme();

  const el = blessed.box({
    parent,
    top: opts.top,
    left: 0,
    right: 0,
    height: opts.height ?? 1,
    style: { fg: t.muted.fg, bg: t.muted.bg },
    content: "",
  });

  function render() {
    const w = (el.width as number) || 40;
    el.setContent(char.repeat(w));
  }

  render();

  return {
    element: el,
    update(o) {
      if (o.char !== undefined) char = o.char;
      const t2 = theme();
      el.style.fg = t2.muted.fg;
      el.style.bg = t2.muted.bg;
      render();
    },
    destroy() {
      el.destroy();
    },
  };
}

// ── InputLine ─────────────────────────────────────────────────────────────

export interface InputLineOptions {
  /** Placeholder text. Default: "" */
  placeholder?: string;
  /** Reserve bottom rows. Default: 0 (sits at bottom by default) */
  bottom?: number;
}

export interface InputLineHandle {
  element: blessed.Widgets.BoxElement;
  getValue(): string;
  setValue(text: string): void;
  focus(): void;
  onSubmit(cb: (value: string) => void): void;
  destroy(): void;
}

/**
 * Single-line text input. Uses theme().input tokens. Emits submit on enter.
 */
export function createInputLine(
  parent: blessed.Widgets.BoxElement,
  opts: InputLineOptions = {},
): InputLineHandle {
  const t = theme();
  const submitCallbacks: ((value: string) => void)[] = [];

  const el = blessed.textbox({
    parent,
    bottom: opts.bottom ?? 0,
    left: 0,
    right: 0,
    height: 1,
    mouse: true,
    keys: true,
    inputOnFocus: true,
    style: t.input ?? t.body,
  } as Record<string, unknown>);

  if (opts.placeholder) {
    el.setContent(opts.placeholder);
  }

  el.on("submit", (value: string) => {
    for (const cb of submitCallbacks) cb(value);
    el.clearValue();
    el.focus();
  });

  return {
    element: el as blessed.Widgets.BoxElement,
    getValue() {
      return el.getValue();
    },
    setValue(text) {
      el.setValue(text);
    },
    focus() {
      el.focus();
    },
    onSubmit(cb) {
      submitCallbacks.push(cb);
    },
    destroy() {
      submitCallbacks.length = 0;
      el.destroy();
    },
  };
}

// ── Canvas ────────────────────────────────────────────────────────────────

export interface CanvasOptions {
  /** Reserve top rows. Default: 0 */
  topOffset?: number;
  /** Reserve bottom rows. Default: 0 */
  bottomOffset?: number;
  /** Enable blessed tags for ANSI content. Default: true */
  tags?: boolean;
}

export interface CanvasHandle {
  /** The raw blessed box — render engines write frames to this via setContent() */
  element: blessed.Widgets.BoxElement;
  /** Update content (shorthand for element.setContent) */
  setContent(content: string): void;
  /** Get current dimensions */
  getSize(): { width: number; height: number };
  destroy(): void;
}

/**
 * Canvas — a themed blessed box for render engines to draw frames into.
 *
 * Provides a raw blessed element that render engines can setContent() on directly.
 * This is the SDK-sanctioned way to do canvas-level rendering without importing blessed.
 *
 * Use for: plasma, contour, generative art, terrain, any animation that composes
 * its own text frames rather than using layout primitives.
 */
export function createCanvas(
  parent: blessed.Widgets.BoxElement,
  opts: CanvasOptions = {},
): CanvasHandle {
  const t = theme();
  const el = blessed.box({
    parent,
    top: opts.topOffset ?? 0,
    left: 0,
    right: 0,
    bottom: opts.bottomOffset ?? 0,
    tags: opts.tags ?? true,
    style: { fg: t.body.fg, bg: t.body.bg },
  });

  return {
    element: el,
    setContent(content) {
      el.setContent(content);
    },
    getSize() {
      return {
        width: Math.max(1, Number(el.width) || 40),
        height: Math.max(1, Number(el.height) || 20),
      };
    },
    destroy() {
      el.destroy();
    },
  };
}
