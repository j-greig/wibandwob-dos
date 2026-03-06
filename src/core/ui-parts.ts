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
