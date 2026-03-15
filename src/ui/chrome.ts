/**
 * chrome.ts — Chrome molecule components.
 * HeaderBar, StatusBar, TextBlock, InputLine, MessageHistory,
 * Rule, FigletDisplay, AnimatedPanel, ButtonBar.
 */
import blessed from "blessed";
import type { FramePlayer } from "../services/animation-service.js";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar, safeSetStyle, scrollableStyle } from "../core/ui-primitives.js";
import type { Rect, LayoutPart } from "./types.js";
import { applyRect, clamp, clampSize, clipText, padLine, renderAlignedBar, wrapIndentedText } from "./layout.js";

export function createHeaderBar(
  parent: blessed.Widgets.Node,
  opts: { leftInset?: number } = {}
): LayoutPart<{ left: string; right?: string }> {
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
): LayoutPart<{ left?: string; right?: string }> {
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
): LayoutPart<{ text: string }> {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 1,
    height: 0,
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: scrollableStyle(theme().body),
  });

  let lastRect: Rect = { top: 0, left: 0, width: 1, height: 0 };
  let lastProps = { text: "" };

  const render = () => {
    // Guard: blessed crashes if scrollable box has zero width
    if (lastRect.width < 1) return;
    node.setContent(
      wrapIndentedText(lastProps.text, lastRect.width, opts.paddingLeft ?? 0, opts.paddingTop ?? 0)
    );
  };

  return {
    node,
    layout(rect) {
      // Clamp width to minimum 1 — blessed scrollable boxes crash at 0 width
      lastRect = { ...rect, width: Math.max(1, rect.width) };
      applyRect(node, lastRect);
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
): LayoutPart<InputLineProps> {
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
): LayoutPart<MessageHistoryProps> {
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
): LayoutPart<{ visible: boolean }> {
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
): LayoutPart<{ value: string }> {
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
): LayoutPart<void> {
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
export type ButtonBarPart<Id extends string> =
  LayoutPart<{ leftText: string; activeId: Id }> & {
    /** Mutate a button's displayed label in place. */
    updateLabel(id: Id, label: string): void;
  };

export function createButtonBar<Id extends string>(
  parent: blessed.Widgets.Node,
  buttons: ReadonlyArray<{ id: Id; label: string }>,
  onSelect: (id: Id) => void,
): ButtonBarPart<Id> {
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
    updateLabel(id: Id, label: string) {
      const idx = (buttons as Array<{ id: Id; label: string }>).findIndex(b => b.id === id);
      if (idx < 0) return;
      (buttons as Array<{ id: Id; label: string }>)[idx]!.label = label;
      buttonNodes[idx]!.setContent(` ${label} `);
    },
    restyle() {
      this.update(lastProps);
    },
    destroy() {
      bar.destroy();
    },
  };
}

