import blessed from "blessed";

import type { FramePlayer } from "../services/animation-service.js";
import { theme } from "./theme/resolver.js";
import { createScrollbar, safeSetStyle, scrollableStyle } from "./ui-primitives.js";

/** @primitive */
export type Rect = { top: number; left: number; width: number; height: number };

/** @primitive */
export type UiPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

/** @primitive */
export type StackChild = {
  key: string;
  basis: number | string;
  part: UiPart<any>;
  visible?: () => boolean;
};

type Axis = "vertical" | "horizontal";

function clampSize(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function applyRect(node: blessed.Widgets.BoxElement, rect: Rect): void {
  node.top = rect.top;
  node.left = rect.left;
  node.width = clampSize(rect.width);
  node.height = clampSize(rect.height);
}

/** Wrap a raw blessed box as a UiPart so it can participate in createStack/createColumns layout. */
export function createNodePart(
  node: blessed.Widgets.BoxElement,
  opts?: { restyle?: () => void }
): UiPart<Record<string, never>> {
  return {
    node,
    layout(rect) { applyRect(node, rect); },
    update() {},
    restyle() { opts?.restyle?.(); },
    destroy() { node.destroy(); },
  };
}

function parseFractionBasis(basis: number | string): number | null {
  if (typeof basis === "number") {
    return null;
  }

  const match = /^(\d+(?:\.\d+)?)fr$/.exec(basis.trim());
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clipText(value: string, width: number): string {
  return width <= 0 ? "" : value.slice(0, width);
}

function padLine(value: string, width: number): string {
  return width <= 0 ? "" : clipText(value, width).padEnd(width, " ");
}

function wrapIndentedLine(raw: string, width: number): string[] {
  if (width <= 0) {
    return [""];
  }

  if (raw.length <= width) {
    return [raw];
  }

  const indent = raw.match(/^\s*/)?.[0] ?? "";
  const lines: string[] = [];
  let remaining = raw;

  while (remaining.length > width) {
    const segment = remaining.slice(0, width);
    let breakAt = segment.lastIndexOf(" ");
    if (breakAt <= indent.length) {
      breakAt = width;
    }

    const line = remaining.slice(0, breakAt).replace(/\s+$/, "");
    lines.push(line);

    const rest = remaining.slice(breakAt).trimStart();
    remaining = rest.length > 0 ? indent + rest : indent;
    if (remaining === indent) {
      break;
    }
  }

  lines.push(remaining);
  return lines;
}

function wrapIndentedText(text: string, width: number, paddingLeft: number, paddingTop: number): string {
  const usableWidth = Math.max(1, width - paddingLeft);
  const leftPad = " ".repeat(Math.max(0, paddingLeft));
  const topPad = Array.from({ length: Math.max(0, paddingTop) }, () => "").join("\n");
  const wrappedLines = text
    .split("\n")
    .flatMap((line) => wrapIndentedLine(line, usableWidth))
    .map((line) => `${leftPad}${line}`);

  const body = wrappedLines.join("\n");
  return topPad ? `${topPad}\n${body}` : body;
}

function renderAlignedBar(left: string, right: string | undefined, width: number, leftInset = 0): string {
  if (width <= 0) {
    return "";
  }

  const inset = " ".repeat(Math.max(0, leftInset));
  const leftValue = `${inset}${left}`;

  if (!right) {
    return padLine(leftValue, width);
  }

  const maxLeftWidth = Math.max(0, width - right.length - 1);
  const clippedLeft = clipText(leftValue, maxLeftWidth);
  const gap = Math.max(1, width - clippedLeft.length - right.length);
  return padLine(`${clippedLeft}${" ".repeat(gap)}${right}`, width);
}

function createLinearLayout(
  parent: blessed.Widgets.Node,
  children: StackChild[],
  axis: Axis
): UiPart<void> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    style: theme().body,
  });

  for (const child of children) {
    node.append(child.part.node);
  }

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };
  let laying = false;

  const relayout = () => { if (!laying) layoutChildren(lastRect); };

  const layoutChildren = (rect: Rect) => {
    laying = true;
    lastRect = {
      top: rect.top,
      left: rect.left,
      width: clampSize(rect.width),
      height: clampSize(rect.height),
    };
    applyRect(node, lastRect);

    const totalExtent = axis === "vertical" ? lastRect.height : lastRect.width;
    const activeChildren = children.filter((child) => child.visible?.() !== false);
    const fixedTotal = activeChildren.reduce((sum, child) => {
      return sum + (typeof child.basis === "number" ? Math.max(0, child.basis) : 0);
    }, 0);
    const totalFr = activeChildren.reduce((sum, child) => {
      return sum + (parseFractionBasis(child.basis) ?? 0);
    }, 0);
    let remaining = Math.max(0, totalExtent - fixedTotal);
    let remainingFr = totalFr;
    let cursor = 0;

    for (const child of children) {
      const isVisible = child.visible?.() !== false;
      if (!isVisible) {
        child.part.node.hide();
        child.part.layout({ top: 0, left: 0, width: 0, height: 0 });
        continue;
      }

      child.part.node.show();

      let extent = 0;
      if (typeof child.basis === "number") {
        extent = Math.max(0, child.basis);
      } else {
        const fr = parseFractionBasis(child.basis) ?? 0;
        if (remainingFr <= 0 || fr <= 0) {
          extent = 0;
        } else if (fr === remainingFr) {
          extent = remaining;
        } else {
          extent = Math.floor((remaining * fr) / remainingFr);
        }
        remaining -= extent;
        remainingFr -= fr;
      }

      const cappedExtent = Math.max(0, Math.min(extent, totalExtent - cursor));
      const childRect =
        axis === "vertical"
          ? { top: cursor, left: 0, width: lastRect.width, height: cappedExtent }
          : { top: 0, left: cursor, width: cappedExtent, height: lastRect.height };

      child.part.layout(childRect);
      cursor += cappedExtent;
    }
    laying = false;
  };

  (node as blessed.Widgets.Node).on?.("resize", relayout);
  parent.on?.("resize", relayout);

  return {
    node,
    layout(rect) {
      layoutChildren(rect);
    },
    update() {},
    restyle() {
      safeSetStyle(node, theme().body);
      for (const child of children) {
        child.part.restyle();
      }
    },
    destroy() {
      for (const child of children) {
        child.part.destroy();
      }
      node.destroy();
    },
  };
}

/** @primitive */
export function createStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "vertical");
}

/** @primitive */
export function createColumns(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "horizontal");
}

/** @primitive */
export function createHeaderBar(
  parent: blessed.Widgets.Node,
  opts: { leftInset?: number } = {}
): UiPart<{ left: string; right?: string }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 1,
    style: theme().header,
  });

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 1 };
  let lastProps: { left: string; right?: string } = { left: "" };

  const render = () => {
    node.setContent(renderAlignedBar(lastProps.left, lastProps.right, lastRect.width, opts.leftInset ?? 0));
  };

  return {
    node,
    layout(rect) {
      lastRect = { ...rect, height: Math.max(1, rect.height) };
      applyRect(node, lastRect);
      render();
    },
    update(props) {
      lastProps = props;
      render();
    },
    restyle() {
      safeSetStyle(node, theme().header);
      render();
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export function createStatusBar(
  parent: blessed.Widgets.Node,
  opts: { leftInset?: number } = {}
): UiPart<{ left?: string; right?: string }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 1,
    style: theme().header,
  });

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 1 };
  let lastProps: { left?: string; right?: string } = {};

  const render = () => {
    node.setContent(renderAlignedBar(lastProps.left ?? "", lastProps.right, lastRect.width, opts.leftInset ?? 0));
  };

  return {
    node,
    layout(rect) {
      lastRect = { ...rect, height: Math.max(1, rect.height) };
      applyRect(node, lastRect);
      render();
    },
    update(props) {
      lastProps = props;
      render();
    },
    restyle() {
      safeSetStyle(node, theme().header);
      render();
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export function createTextBlock(
  parent: blessed.Widgets.Node,
  opts: { paddingLeft?: number; paddingTop?: number } = {}
): UiPart<{ text: string }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(theme().body),
  });

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };
  let lastProps = { text: "" };

  const render = () => {
    node.setContent(
      wrapIndentedText(lastProps.text, lastRect.width, opts.paddingLeft ?? 0, opts.paddingTop ?? 0)
    );
  };

  return {
    node,
    layout(rect) {
      lastRect = rect;
      applyRect(node, rect);
      render();
    },
    update(props) {
      lastProps = props;
      render();
    },
    restyle() {
      safeSetStyle(node, scrollableStyle(theme().body));
      render();
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export interface InputLineProps {
  placeholder?: string;
}

/** @primitive */
export function createInputLine(
  screen: blessed.Widgets.Screen,
  onSubmit: (value: string) => void
): UiPart<InputLineProps> {
  const node = blessed.textbox({
    parent: screen,
    top: 0,
    left: 0,
    width: 0,
    height: 1,
    mouse: true,
    keys: true,
    inputOnFocus: true,
    style: theme().input ?? theme().body,
  });

  let placeholder = "";

  const renderPlaceholder = () => {
    if (!node.getValue() && placeholder) {
      node.setContent(placeholder);
    } else if (!node.getValue()) {
      node.setContent("");
    }
  };

  node.on("submit", (value) => {
    onSubmit((value ?? "").trim());
    node.clearValue();
    renderPlaceholder();
    screen.render();
  });

  return {
    node,
    layout(rect) {
      applyRect(node, { ...rect, height: 1 });
    },
    update(props) {
      placeholder = props.placeholder ?? "";
      renderPlaceholder();
      screen.render();
    },
    restyle() {
      safeSetStyle(node, theme().input ?? theme().body);
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export interface MessageHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

/** @primitive */
export interface MessageHistoryProps {
  entries: MessageHistoryEntry[];
}

/** @primitive */
export function createMessageHistory(
  screen: blessed.Widgets.Screen
): UiPart<MessageHistoryProps> {
  const node = blessed.list({
    parent: screen,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(theme().body),
  });

  return {
    node,
    layout(rect) {
      applyRect(node, rect);
    },
    update(props) {
      const formatted = props.entries.map((entry) => {
        return entry.role === "user" ? `> ${entry.content}` : entry.content;
      });
      node.setItems(formatted);
      node.setScrollPerc(100);
      screen.render();
    },
    restyle() {
      safeSetStyle(node, scrollableStyle(theme().body));
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export function createRule(
  parent: blessed.Widgets.Node,
  opts: { axis: "horizontal" | "vertical"; inset?: number }
): UiPart<{ visible: boolean }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    style: theme().muted,
  });

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };
  let isVisible = true;

  const render = () => {
    if (!isVisible) {
      node.hide();
      node.setContent("");
      return;
    }

    node.show();

    if (opts.axis === "horizontal") {
      const inset = Math.max(0, opts.inset ?? 0);
      const width = Math.max(0, lastRect.width - inset * 2);
      node.setContent(`${" ".repeat(inset)}${"─".repeat(width)}${" ".repeat(inset)}`);
      return;
    }

    node.setContent(Array.from({ length: Math.max(0, lastRect.height) }, () => "│").join("\n"));
  };

  return {
    node,
    layout(rect) {
      lastRect = rect;
      applyRect(node, rect);
      render();
    },
    update(props) {
      isVisible = props.visible;
      render();
    },
    restyle() {
      safeSetStyle(node, theme().muted);
      render();
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export function createFigletDisplay(
  parent: blessed.Widgets.Node,
  opts: { renderText: (value: string) => string; leftInset?: number }
): UiPart<{ value: string }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(theme().body),
  });

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };
  let lastProps = { value: "" };

  const render = () => {
    const inset = " ".repeat(Math.max(0, opts.leftInset ?? 0));
    node.setContent(opts.renderText(lastProps.value).split("\n").map(l => `${inset}${l}`).join("\n"));
  };

  return {
    node,
    layout(rect) {
      lastRect = rect;
      applyRect(node, rect);
      render();
    },
    update(props) {
      lastProps = props;
      render();
    },
    restyle() {
      safeSetStyle(node, scrollableStyle(theme().body));
      render();
    },
    destroy() {
      node.destroy();
    },
  };
}

/** @primitive */
export function createAnimatedPanel(
  parent: blessed.Widgets.Node,
  opts: { player: FramePlayer }
): UiPart<void> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    style: theme().body,
  });

  const playerWithMount = opts.player as FramePlayer & {
    attachTarget?: (target: blessed.Widgets.BoxElement) => void;
    mount?: (target: blessed.Widgets.BoxElement) => void;
  };

  playerWithMount.attachTarget?.(node);
  playerWithMount.mount?.(node);

  return {
    node,
    layout(rect) {
      applyRect(node, rect);
    },
    update() {},
    restyle() {
      safeSetStyle(node, theme().body);
    },
    destroy() {
      opts.player.destroy();
      node.destroy();
    },
  };
}

/**
 * A 1-row bar with a left text area and N right-aligned clickable buttons.
 * Active button is shown inverse. Suitable for mode switchers in microapps.
 *
 * @example
 * const bar = createButtonBar(win.body, buttons, (id) => { mode = id; render(); });
 * // in render():
 * bar.update({ leftText: hintText, activeId: currentMode });
 */
export function createButtonBar<Id extends string>(
  parent: blessed.Widgets.Node,
  buttons: ReadonlyArray<{ id: Id; label: string }>,
  onSelect: (id: Id) => void,
): UiPart<{ leftText: string; activeId: Id }> {
  // Static button widths: label + 1 space padding each side; 1 gap between buttons.
  const buttonWidths = buttons.map(b => b.label.length + 2);
  const buttonsAreaWidth = buttonWidths.reduce((sum, w, i) => sum + w + (i > 0 ? 1 : 0), 0);

  const bar = blessed.box({
    parent,
    top: 0, left: 0, width: 0, height: 1,
    style: theme().footer,
  });

  const leftLabel = blessed.box({
    parent: bar,
    top: 0, left: 0, right: buttonsAreaWidth, height: 1,
    tags: true,
    style: theme().footer,
  });

  const buttonNodes = buttons.map((btn, i) => {
    const node = blessed.box({
      parent: bar,
      top: 0, left: 0,
      width: buttonWidths[i],
      height: 1,
      mouse: true,
      clickable: true,
      tags: true,
      content: ` ${btn.label} `,
      style: theme().footer,
    });
    node.on("click", () => onSelect(btn.id));
    return node;
  });

  let lastProps: { leftText: string; activeId: Id } = {
    leftText: "",
    activeId: buttons[0]?.id as Id,
  };

  return {
    node: bar,
    layout(rect) {
      applyRect(bar, rect);
      const barWidth = clampSize(rect.width);
      const leftWidth = Math.max(0, barWidth - buttonsAreaWidth);
      applyRect(leftLabel, { top: 0, left: 0, width: leftWidth, height: 1 });
      let cursor = barWidth;
      for (let i = buttonNodes.length - 1; i >= 0; i--) {
        const node = buttonNodes[i]!;
        const w = buttonWidths[i]!;
        cursor -= w;
        applyRect(node, { top: 0, left: Math.max(0, cursor), width: w, height: 1 });
        if (i > 0) cursor -= 1;
      }
    },
    update(props) {
      lastProps = props;
      leftLabel.setContent(props.leftText);
      safeSetStyle(bar, theme().footer);
      safeSetStyle(leftLabel, theme().footer);
      for (let i = 0; i < buttonNodes.length; i++) {
        const isActive = buttons[i]!.id === props.activeId;
        safeSetStyle(buttonNodes[i]!, isActive ? { ...theme().footer, inverse: true } : theme().footer);
      }
    },
    restyle() {
      this.update(lastProps);
    },
    destroy() {
      bar.destroy();
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

export type BorderedPanelHandle = UiPart<void> & {
  /** The inner content node — attach child widgets here */
  content: blessed.Widgets.BoxElement;
  /** Switch active/inactive border style and theme colour */
  setActive(active: boolean): void;
};

/**
 * A UiPart with a manually-drawn border that switches style on setActive().
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
  getTheme: () => import("./theme/types.js").ThemeTokens,
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
    (outer as any).style    = { fg: borderFg, bg: th.body.bg };
    (titleBox as any).style = active
      ? { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg, bold: true }
      : th.body;
    (inner as any).style = th.body;
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
export type CollapsibleBlockHandle = UiPart<CollapsibleBlockProps> & {
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
    raw = Math.max(lo, Math.min(hi, computed));
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
      sidebar.width = sw as any;
      sidebar.height = "100%" as any;
      if (side === "left") {
        sidebar.left = 0 as any;
        (sidebar as any).right = undefined;
      } else {
        sidebar.left = mw as any;
        (sidebar as any).right = undefined;
      }
      if (dividerNode) {
        dividerNode.show();
        dividerNode.left = dLeft as any;
        dividerNode.width = 1 as any;
        dividerNode.height = "100%" as any;
      }
    } else {
      sidebar.hide();
      if (dividerNode) dividerNode.hide();
    }

    main.left = mLeft as any;
    main.width = mw as any;
    main.height = "100%" as any;
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
