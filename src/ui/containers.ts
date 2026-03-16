/**
 * containers.ts — Container organism components.
 * ScrollViewport, BorderedPanel, CollapsibleBlock, ContentStack,
 * SidebarPanel, SelectableList, InlineSearch, RestyleBundle, Tabs.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar, safeSetStyle, scrollableStyle } from "../core/ui-primitives.js";
import type { Rect, LayoutPart } from "./types.js";
import { applyRect, clamp, clampSize } from "./layout.js";

// ── Scroll viewport ───────────────────────────────────────────────────────────

/** @primitive */
export type ScrollViewportOptions = {
  /** Fixed header height in rows (0 = no header). */
  headerHeight?: number;
  /** Fixed footer height in rows (0 = no footer). */
  footerHeight?: number;
};

/** @primitive */
export type ScrollViewportHandle = LayoutPart<void> & {
  /** The fixed header region (if headerHeight > 0). Attach header content here. */
  header: blessed.Widgets.BoxElement | null;
  /** The scrollable middle viewport. Attach scrollable content here. */
  viewport: blessed.Widgets.BoxElement;
  /** The fixed footer region (if footerHeight > 0). Attach footer content here. */
  footer: blessed.Widgets.BoxElement | null;
  /** Scroll to the bottom of the viewport. */
  scrollToBottom(): void;
  /** Scroll to the top of the viewport. */
  scrollToTop(): void;
  /** Current scroll position as percentage (0-100). */
  scrollPercent(): number;
};

/**
 * Creates a scrollable viewport with optional fixed header and footer.
 *
 * The viewport is the scrollable middle region. Content appended to it
 * can grow beyond the visible height and will scroll with mouse wheel
 * and arrow keys (blessed default key/mouse handling).
 *
 * @primitive
 */
export function createScrollViewport(
  parent: blessed.Widgets.Node,
  options?: ScrollViewportOptions,
): ScrollViewportHandle {
  const headerHeight = options?.headerHeight ?? 0;
  const footerHeight = options?.footerHeight ?? 0;

  const container = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    style: theme().body,
  });

  const headerNode = headerHeight > 0
    ? blessed.box({
        parent: container,
        top: 0,
        left: 0,
        width: "100%" as unknown as number,
        height: headerHeight,
        style: theme().header,
      })
    : null;

  const viewport = blessed.box({
    parent: container,
    top: headerHeight,
    left: 0,
    width: "100%" as unknown as number,
    height: 0,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(theme().body),
  });

  const footerNode = footerHeight > 0
    ? blessed.box({
        parent: container,
        bottom: 0,
        left: 0,
        width: "100%" as unknown as number,
        height: footerHeight,
        style: theme().header,
      })
    : null;

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function layoutInternal(rect: Rect) {
    lastRect = rect;
    applyRect(container, rect);

    const totalHeight = clampSize(rect.height);
    const viewportHeight = Math.max(0, totalHeight - headerHeight - footerHeight);

    if (headerNode) {
      headerNode.top = 0;
      headerNode.left = 0;
      headerNode.width = rect.width;
      headerNode.height = headerHeight;
    }

    viewport.top = headerHeight;
    viewport.left = 0;
    viewport.width = rect.width;
    viewport.height = viewportHeight;

    if (footerNode) {
      footerNode.top = headerHeight + viewportHeight;
      footerNode.left = 0;
      footerNode.width = rect.width;
      footerNode.height = footerHeight;
    }
  }

  return {
    node: container,
    header: headerNode,
    viewport,
    footer: footerNode,

    layout(rect) {
      layoutInternal(rect);
    },

    update() {},

    restyle() {
      safeSetStyle(container, theme().body);
      if (headerNode) safeSetStyle(headerNode, theme().header);
      safeSetStyle(viewport, scrollableStyle(theme().body));
      if (footerNode) safeSetStyle(footerNode, theme().header);
    },

    destroy() {
      if (headerNode) headerNode.destroy();
      viewport.destroy();
      if (footerNode) footerNode.destroy();
      container.destroy();
    },

    scrollToBottom() {
      viewport.setScrollPerc(100);
    },

    scrollToTop() {
      viewport.setScrollPerc(0);
    },

    scrollPercent() {
      return (viewport as Record<string, any>).getScrollPerc?.() ?? 0;
    },
  };
}

// ── Border styles ─────────────────────────────────────────────────────────────

export type BorderStyle = "single" | "double" | "bold" | "thin";

const BORDER_CHARS: Record<BorderStyle, { tl: string; tr: string; bl: string; br: string; hz: string; vt: string }> = {
  single: { tl: "┌", tr: "┐", bl: "└", br: "┘", hz: "─", vt: "│" },
  double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", hz: "═", vt: "║" },
  bold:   { tl: "┏", tr: "┓", bl: "┗", br: "┛", hz: "━", vt: "┃" },
  thin:   { tl: "╌", tr: "╌", bl: "╌", br: "╌", hz: "╌", vt: "╎" },
};

export interface BorderedPanelOpts {
  title?: string;
  /** Border style when inactive. Default: "single" */
  inactiveStyle?: BorderStyle;
  /** Border style when active. Default: "double" */
  activeStyle?: BorderStyle;
}

export type BorderedPanelHandle = LayoutPart<void> & {
  /** The inner content node — attach child widgets here */
  content: blessed.Widgets.BoxElement;
  /** Switch active/inactive border style and theme colour */
  setActive(active: boolean): void;
};

/**
 * A LayoutPart with a manually-drawn border that switches style on setActive().
 *
 * Key implementation notes:
 * - wrap:false on outer box prevents blessed wrapping the border line
 * - No ANSI codes in setContent() — colour via style.fg only (ANSI confuses
 *   blessed's line-width calculation causing corner chars to wrap to col 0)
 * - Title rendered in a separate child box at top:0,left:2 to overlay the border
 * - Inner content box inset 1 cell on all sides
 *
 * @param parent  Blessed parent node
 * @param opts    Title, inactive/active border styles
 * @param getTheme  Returns current ThemeTokens — called on every restyle
 */
export function createBorderedPanel(
  parent: blessed.Widgets.Node,
  opts: BorderedPanelOpts,
  getTheme: () => import("../core/theme/types.js").ThemeTokens,
): BorderedPanelHandle {
  const { title = "", inactiveStyle = "single", activeStyle = "double" } = opts;

  const t = getTheme();
  const outer = blessed.box({
    parent,
    top: 0, left: 0, width: 0, height: 0,
    tags: false,
    wrap: false,
    style: { fg: t.windowBorderUnfocused.fg, bg: t.body.bg },
  });

  const titleBox = blessed.box({
    parent: outer,
    top: 0, left: 2, width: "shrink", height: 1,
    tags: false,
    content: title ? ` ${title} ` : "",
    style: t.body,
  });

  const inner = blessed.box({
    parent: outer,
    top: 1, left: 1, right: 1, bottom: 1,
    tags: false,
    style: t.body,
  });

  let active = false;
  let lastW = 0;
  let lastH = 0;

  function drawBorder() {
    const w = lastW;
    const h = lastH;
    if (w < 2 || h < 2) return;
    const chars = BORDER_CHARS[active ? activeStyle : inactiveStyle]!;
    const topLine = chars.tl + chars.hz.repeat(w - 2) + chars.tr;
    const midLine = chars.vt + " ".repeat(w - 2) + chars.vt;
    const botLine = chars.bl + chars.hz.repeat(w - 2) + chars.br;
    const rows = [topLine];
    for (let i = 1; i < h - 1; i++) rows.push(midLine);
    rows.push(botLine);
    outer.setContent(rows.join("\n"));
  }

  function applyColors() {
    const th = getTheme();
    const borderFg = active ? th.titleBarFocused.bg : th.windowBorderUnfocused.fg;
    (outer as Record<string, any>).style    = { fg: borderFg, bg: th.body.bg };
    (titleBox as Record<string, any>).style = active
      ? { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg, bold: true }
      : th.body;
    (inner as Record<string, any>).style = th.body;
  }

  return {
    node: outer,
    content: inner,

    layout(rect: Rect) {
      lastW = rect.width;
      lastH = rect.height;
      applyRect(outer, rect);
      inner.top    = 1;
      inner.left   = 1;
      inner.width  = Math.max(1, rect.width  - 2);
      inner.height = Math.max(1, rect.height - 2);
      drawBorder();
    },

    update() {},

    setActive(a: boolean) {
      active = a;
      applyColors();
      drawBorder();
    },

    restyle() {
      applyColors();
      drawBorder();
    },

    destroy() {
      titleBox.destroy();
      inner.destroy();
      outer.destroy();
    },
  };
}

// ── Collapsible block ─────────────────────────────────────────────────────────

/** @primitive */
export interface CollapsibleBlockProps {
  /** Single line shown when collapsed (blessed {tag} markup OK). */
  summary: string;
  /** Full content shown when expanded (blessed {tag} markup OK, may be multi-line). */
  detail: string;
  /** Optional badge always visible even when collapsed (e.g. "✗ 2 failed"). */
  badge?: string;
}

/** @primitive */
export type CollapsibleBlockHandle = LayoutPart<CollapsibleBlockProps> & {
  toggle(): void;
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
  /** Current content height in rows (1 when collapsed, N when expanded). */
  contentHeight(): number;
};

/**
 * A block that toggles between a one-line summary and full detail on click.
 * Calls `onChange` when height changes so the parent layout can reflow.
 *
 * @primitive
 */
export function createCollapsibleBlock(
  parent: blessed.Widgets.Node,
  opts?: {
    collapsed?: boolean;
    onChange?: () => void;
  },
): CollapsibleBlockHandle {
  let collapsed = opts?.collapsed ?? true;

  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 1,
    tags: true,
    mouse: true,
    clickable: true,
    style: theme().body,
  });

  let lastProps: CollapsibleBlockProps = { summary: "", detail: "" };
  let lastWidth = 0;

  const render = () => {
    const chevron = collapsed ? "▸" : "▾";
    if (collapsed) {
      const badge = lastProps.badge ? `  ${lastProps.badge}` : "";
      node.setContent(`${chevron}${lastProps.summary}${badge}`);
      node.height = 1;
    } else {
      const badge = lastProps.badge ? `  ${lastProps.badge}` : "";
      const header = `${chevron}${lastProps.summary}${badge}`;
      const full = lastProps.detail ? `${header}\n${lastProps.detail}` : header;
      node.setContent(full);
      const lineCount = full.split("\n").length;
      node.height = lineCount;
    }
  };

  node.on("click", () => {
    collapsed = !collapsed;
    render();
    opts?.onChange?.();
  });

  return {
    node,
    layout(rect) {
      lastWidth = rect.width;
      node.top = rect.top;
      node.left = rect.left;
      node.width = clampSize(rect.width);
      render();
    },
    update(props) {
      lastProps = props;
      render();
    },
    restyle() {
      safeSetStyle(node, theme().body);
      render();
    },
    destroy() {
      node.destroy();
    },
    toggle() {
      collapsed = !collapsed;
      render();
      opts?.onChange?.();
    },
    setCollapsed(value: boolean) {
      if (collapsed === value) return;
      collapsed = value;
      render();
      opts?.onChange?.();
    },
    isCollapsed() {
      return collapsed;
    },
    contentHeight() {
      return Number(node.height) || 1;
    },
  };
}

// ── Content stack ─────────────────────────────────────────────────────────────

/**
 * A child in a content stack. Each child exposes a blessed node and a way to
 * query its current height in rows. The stack positions children top-to-bottom
 * inside a scrollable container.
 *
 * @primitive
 */
export interface ContentStackChild {
  key: string;
  node: blessed.Widgets.BoxElement;
  contentHeight(): number;
}

/** @primitive */
export interface ContentStackHandle {
  /** The scrollable container node — use as parent in createStack or similar. */
  node: blessed.Widgets.BoxElement;
  /** Replace the child list and relayout. */
  setChildren(children: ContentStackChild[]): void;
  /** Append a child and relayout (avoids full rebuild on each new message). */
  appendChild(child: ContentStackChild): void;
  /** Recalculate all child positions. Call after any child height change. */
  relayout(): void;
  /** Scroll to the bottom of the content. */
  scrollToBottom(): void;
  /** Clean up. */
  restyle(): void;
  destroy(): void;
}

/**
 * Manages variable-height children stacked vertically inside a scrollable
 * blessed box. Children are positioned with manual `top` values that
 * accumulate. Call `relayout()` whenever a child changes height.
 *
 * @primitive
 */
export function createContentStack(
  parent: blessed.Widgets.Node,
  stackOpts?: { style?: Record<string, any> },
): ContentStackHandle {
  const baseStyle = stackOpts?.style ?? theme().body;
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: true,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(baseStyle),
  });

  let children: ContentStackChild[] = [];

  const relayout = () => {
    let cursor = 0;
    for (const child of children) {
      child.node.top = cursor;
      child.node.left = 0;
      child.node.width = Math.max(1, Number(node.width) || 1);
      const h = child.contentHeight();
      child.node.height = h;
      cursor += h;
    }
  };

  return {
    node,

    setChildren(newChildren: ContentStackChild[]) {
      // Detach old children that aren't in the new list
      const newKeys = new Set(newChildren.map((c) => c.key));
      for (const old of children) {
        if (!newKeys.has(old.key)) {
          old.node.detach();
        }
      }
      // Attach new children that aren't already parented
      for (const child of newChildren) {
        if (child.node.parent !== node) {
          node.append(child.node);
        }
      }
      children = newChildren;
      relayout();
    },

    appendChild(child: ContentStackChild) {
      node.append(child.node);
      children.push(child);
      relayout();
    },

    relayout,

    scrollToBottom() {
      node.setScrollPerc(100);
    },

    restyle() {
      safeSetStyle(node, scrollableStyle(stackOpts?.style ?? theme().body));
    },

    destroy() {
      for (const child of children) {
        child.node.destroy();
      }
      node.destroy();
    },
  };
}

// ── createSidebarPanel ────────────────────────────────────────────────────
// Shared sidebar primitive for all sidebar-bearing windows (P01).
// Handles width policy (fixed | percent with min/max), overflow guard,
// optional divider, and open/close toggle.

export type SidebarWidthFixed = { fixed: number };
export type SidebarWidthPercent = { percent: number; min?: number; max?: number };
export type SidebarWidth = SidebarWidthFixed | SidebarWidthPercent;

export interface SidebarPanelOptions {
  parent: blessed.Widgets.BoxElement;
  side: "left" | "right";
  width: SidebarWidth;
  divider?: boolean;       // default true
  open?: boolean;          // default true
  mainMinWidth?: number;   // default 12, overflow guard
  style?: {
    sidebar?: blessed.Widgets.BoxOptions["style"];
    main?: blessed.Widgets.BoxOptions["style"];
    divider?: blessed.Widgets.BoxOptions["style"];
  };
}

export interface SidebarPanel {
  /** The main content area (opposite side from sidebar). */
  main: blessed.Widgets.BoxElement;
  /** The sidebar panel. */
  sidebar: blessed.Widgets.BoxElement;
  /** Optional 1-char divider between sidebar and main. */
  divider?: blessed.Widgets.BoxElement;
  toggle(): void;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /** Re-apply layout to parent's current dimensions. Call from parent resize handler. */
  layout(): void;
  sidebarWidth(): number;
  mainWidth(): number;
}

/**
 * Resolve sidebar pixel width given total available columns.
 * Applies overflow guard: if sidebar + divider + mainMinWidth > total,
 * shrink sidebar so main has at least mainMinWidth columns.
 */
export function resolveSidebarWidth(
  total: number,
  widthPolicy: SidebarWidth,
  hasDivider: boolean,
  mainMinWidth: number,
): number {
  let raw: number;
  if ("fixed" in widthPolicy) {
    raw = widthPolicy.fixed;
  } else {
    const pct = widthPolicy.percent;
    const computed = Math.floor(total * pct);
    const lo = widthPolicy.min ?? 0;
    const hi = widthPolicy.max ?? Infinity;
    raw = clamp(computed, lo, hi);
  }
  const dividerCost = hasDivider ? 1 : 0;
  const maxAllowed = Math.max(0, total - dividerCost - mainMinWidth);
  return Math.min(raw, maxAllowed);
}

export function createSidebarPanel(opts: SidebarPanelOptions): SidebarPanel {
  const {
    parent,
    side,
    width: widthPolicy,
    divider: hasDivider = true,
    open: initialOpen = true,
    mainMinWidth = 12,
    style = {},
  } = opts;

  let isOpenState = initialOpen;

  const sidebar = blessed.box({
    parent,
    top: 0,
    left: side === "left" ? 0 : undefined,
    right: side === "right" ? 0 : undefined,
    width: 1,
    height: "100%",
    hidden: !isOpenState,
    style: style.sidebar ?? theme().body,
  });

  const dividerNode = hasDivider
    ? blessed.box({
        parent,
        top: 0,
        left: 0,
        width: 1,
        height: "100%",
        hidden: !isOpenState,
        content: Array(100).fill("│").join("\n"),
        style: style.divider ?? theme().body,
      })
    : undefined;

  const main = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 1,
    height: "100%",
    style: style.main ?? theme().body,
  });

  function currentTotal(): number {
    return Math.max(1, Number(parent.width) || 80);
  }

  function computeWidths(): { sw: number; dw: number; mw: number; mLeft: number; dLeft: number } {
    const total = currentTotal();
    if (!isOpenState) {
      return { sw: 0, dw: 0, mw: total, mLeft: 0, dLeft: 0 };
    }
    const sw = resolveSidebarWidth(total, widthPolicy, hasDivider, mainMinWidth);
    const dw = hasDivider ? 1 : 0;
    const mw = Math.max(0, total - sw - dw);
    const mLeft = side === "left" ? sw + dw : 0;
    const dLeft = side === "left" ? sw : mw;
    return { sw, dw, mw, mLeft, dLeft };
  }

  function applyLayout() {
    const { sw, mw, mLeft, dLeft } = computeWidths();

    if (isOpenState) {
      sidebar.show();
      sidebar.width = sw as unknown as number;
      sidebar.height = "100%" as unknown as number;
      if (side === "left") {
        sidebar.left = 0 as unknown as number;
        (sidebar as Record<string, any>).right = undefined;
      } else {
        sidebar.left = mw as unknown as number;
        (sidebar as Record<string, any>).right = undefined;
      }
      if (dividerNode) {
        dividerNode.show();
        dividerNode.left = dLeft as unknown as number;
        dividerNode.width = 1 as unknown as number;
        dividerNode.height = "100%" as unknown as number;
      }
    } else {
      sidebar.hide();
      if (dividerNode) dividerNode.hide();
    }

    main.left = mLeft as unknown as number;
    main.width = mw as unknown as number;
    main.height = "100%" as unknown as number;
  }

  applyLayout();

  return {
    main,
    sidebar,
    divider: dividerNode,

    toggle() {
      isOpenState = !isOpenState;
      applyLayout();
    },

    setOpen(open: boolean) {
      if (isOpenState !== open) {
        isOpenState = open;
        applyLayout();
      }
    },

    isOpen() {
      return isOpenState;
    },

    layout() {
      applyLayout();
    },

    sidebarWidth() {
      const { sw } = computeWidths();
      return sw;
    },

    mainWidth() {
      const { mw } = computeWidths();
      return mw;
    },
  };
}

// ── createSelectableList ──────────────────────────────────────────────────
// Shared selectable list primitive (P04).
// Wraps blessed.list with canonical keys/vi/mouse/scrollbar defaults baked in.

export interface SelectableListOptions {
  parent: blessed.Widgets.BoxElement;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  width?: number | string;
  height?: number | string;
  items?: string[];
  style?: blessed.Widgets.BoxOptions["style"];
}

export interface SelectableListHandle {
  node: blessed.Widgets.ListElement;
  setItems(items: string[]): void;
  selected(): number;
  select(index: number): void;
  onSelect(fn: (index: number, item: string) => void): void;
  onSelectItem(fn: () => void): void;
  focus(): void;
}

export function createSelectableList(opts: SelectableListOptions): SelectableListHandle {
  const {
    parent,
    top = 0,
    left = 0,
    right,
    bottom,
    width,
    height,
    items = [],
    style,
  } = opts;

  const listStyle = style ?? { ...theme().body, selected: theme().selected };

  const node = blessed.list({
    parent,
    top,
    left,
    ...(right !== undefined ? { right } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    items,
    style: listStyle,
  } as blessed.Widgets.ListOptions<blessed.Widgets.BoxOptions["style"]>);

  return {
    node,

    setItems(newItems: string[]) {
      (node as any).setItems(newItems);
    },

    selected() {
      return (node as any).selected ?? 0;
    },

    select(index: number) {
      node.select(index);
    },

    onSelect(fn: (index: number, item: string) => void) {
      node.on("select", (_item: blessed.Widgets.BlessedElement, index: number) => fn(index, items[index] ?? ""));
    },

    onSelectItem(fn: () => void) {
      node.on("select item", fn);
    },

    focus() {
      node.focus();
    },
  };
}

// ── createInlineSearch ────────────────────────────────────────────────────
// Bottom-anchored inline search overlay (P06).
// Shared by zine and sy2-chronicles (and any future module with in-canvas search).

export interface InlineSearchOptions {
  parent: blessed.Widgets.BoxElement;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  afterClose?: () => void;
  /** Bottom inset from parent bottom edge (default 1). */
  bottom?: number;
}

export interface InlineSearchHandle {
  /** Mount the search bar (creates blessed nodes). Idempotent — no-ops if already open. */
  open(): void;
  /** Tear down the search bar. Idempotent — no-ops if already closed. */
  close(): void;
  isOpen(): boolean;
  setValue(value: string): void;
}

export function createInlineSearch(opts: InlineSearchOptions): InlineSearchHandle {
  const {
    parent,
    placeholder = "search…",
    initialValue = "",
    onSubmit,
    onCancel,
    afterClose,
    bottom = 1,
  } = opts;

  let isOpenState = false;
  let bar: blessed.Widgets.BoxElement | undefined;
  let inputNode: blessed.Widgets.TextboxElement | undefined;

  function mount() {
    const CLOSE_W = 5; // " [×] "
    const bg = theme().selected.bg ?? "blue";
    const fg = theme().body.fg ?? "white";
    const hfg = theme().highlight.fg ?? "yellow";

    bar = blessed.box({
      parent,
      bottom,
      left: 0,
      right: 0,
      height: 1,
      style: { fg, bg },
    });

    inputNode = blessed.textbox({
      parent: bar,
      top: 0,
      left: 0,
      right: CLOSE_W,
      height: 1,
      inputOnFocus: true,
      style: { fg, bg },
    }) as blessed.Widgets.TextboxElement;

    const closeBtn = blessed.box({
      parent: bar,
      top: 0,
      right: 0,
      width: CLOSE_W,
      height: 1,
      content: " [×] ",
      mouse: true,
      clickable: true,
      style: { fg: hfg, bg },
    });

    if (initialValue) (inputNode as any).setValue(initialValue);

    closeBtn.on("click", () => handle.close());
    inputNode.key(["escape"], () => { onCancel(); handle.close(); });
    inputNode.key(["enter"], () => {
      const val = ((inputNode as any).value ?? "").trim();
      onSubmit(val);
      handle.close();
    });
    inputNode.key(["C-u"], () => { (inputNode as any).clearValue(); });

    inputNode.focus();
  }

  function unmount() {
    bar?.destroy();
    bar = undefined;
    inputNode = undefined;
    afterClose?.();
  }

  const handle: InlineSearchHandle = {
    open() {
      if (isOpenState) return;
      isOpenState = true;
      mount();
    },

    close() {
      if (!isOpenState) return;
      isOpenState = false;
      unmount();
    },

    isOpen() {
      return isOpenState;
    },

    setValue(value: string) {
      if (inputNode) (inputNode as any).setValue(value);
    },
  };

  return handle;
}

// ── createRestyleBundle ───────────────────────────────────────────────────
// Declarative restyle coverage for windows (P03).
// Replaces 24 hand-rolled frame.onRestyle blocks with a single declaration.

/** A widget + style-getter pair. The getter is called at restyle time so it always uses current theme. */
export type RestyleEntry = [
  widget: blessed.Widgets.BlessedElement,
  styleGetter: () => Record<string, any>,
];

export interface RestyleBundleHandle {
  /** Call this as frame.onRestyle = bundle.restyle (or bundle.restyle()). */
  restyle: () => void;
  /** Add an additional entry after creation. */
  add(entry: RestyleEntry): void;
}

export function createRestyleBundle(entries: RestyleEntry[]): RestyleBundleHandle {
  const list: RestyleEntry[] = [...entries];
  return {
    restyle() {
      for (const [widget, getStyle] of list) {
        safeSetStyle(widget, getStyle());
      }
    },
    add(entry: RestyleEntry) {
      list.push(entry);
    },
  };
}

/**
 * deferRender — schedule fn after the current paint cycle completes (P-S25).
 * Replaces scattered setTimeout(fn, 0) defers so intent is explicit.
 */
export function deferRender(fn: () => void): void {
  setTimeout(fn, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TABBED CONTAINER — reusable tab bar + switchable content panels
// ═══════════════════════════════════════════════════════════════════════════

export interface TabDef {
  name: string;
  build: (container: blessed.Widgets.BoxElement) => void;
  update?: () => void;
  cleanup?: () => void;
}

export interface TabbedContainerHandle {
  /** Switch to tab by zero-based index. */
  switchTo(idx: number): void;
  /** Current active tab index. */
  readonly active: number;
  /** Call update() on the active tab (for tick loops). */
  tickActive(): void;
  /** Register a callback when tab switches. */
  onSwitch(fn: (idx: number) => void): void;
  /** Destroy all tabs and the tab bar. */
  destroy(): void;
  /** Re-render the tab bar (e.g. after restyle). */
  renderBar(): void;
}

/** @primitive */
export function createLayoutTabs(
  parent: blessed.Widgets.BoxElement,
  tabs: TabDef[],
  opts?: { keys?: boolean },
): TabbedContainerHandle {
  let activeIdx = 0;
  const switchHandlers: Array<(idx: number) => void> = [];

  const tabBar = blessed.box({
    parent,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: "white", bg: "black" },
  });

  const contentArea = blessed.box({
    parent,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0,
  });

  const containers: blessed.Widgets.BoxElement[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const c = blessed.box({
      parent: contentArea,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
    if (i !== 0) c.hide();
    containers.push(c);
    tabs[i]!.build(c);
  }

  function renderBar() {
    const names = tabs.map((t, i) =>
      i === activeIdx
        ? `{inverse} ${i + 1}:${t.name} {/inverse}`
        : ` ${i + 1}:${t.name} `,
    );
    const hint = tabs.length <= 9 ? `  {gray-fg}[1-${tabs.length}] switch{/gray-fg}` : "";
    tabBar.setContent(`{bold}${names.join("│")}${hint}{/bold}`);
  }

  function switchTo(idx: number) {
    if (idx < 0 || idx >= tabs.length || idx === activeIdx) return;
    containers[activeIdx]!.hide();
    activeIdx = idx;
    containers[activeIdx]!.show();
    renderBar();
    try { tabs[activeIdx]?.update?.(); } catch { /* ignore */ }
    for (const fn of switchHandlers) fn(idx);
  }

  // Wire number keys
  if (opts?.keys !== false) {
    for (let i = 0; i < Math.min(tabs.length, 9); i++) {
      const idx = i;
      parent.key([`${i + 1}`], () => switchTo(idx));
    }
    (parent as Record<string, any>).input = true;
    (parent as Record<string, any>).keys = true;
  }

  renderBar();

  return {
    switchTo,
    get active() { return activeIdx; },
    tickActive() { try { tabs[activeIdx]?.update?.(); } catch { /* ignore */ } },
    onSwitch(fn) { switchHandlers.push(fn); },
    destroy() {
      for (const t of tabs) t.cleanup?.();
      for (const c of containers) c.destroy();
      tabBar.destroy();
      contentArea.destroy();
    },
    renderBar,
  };
}

