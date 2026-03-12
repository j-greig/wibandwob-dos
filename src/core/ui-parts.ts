/**
 * ui-parts.ts — internal layout primitives.
 *
 * Module authors: do NOT import from this file directly.
 * Use ../../src/services/microapp-sdk.js instead, which re-exports
 * everything here under a stable public surface.
 */
import blessed from "blessed";

import type { FramePlayer } from "../services/animation-service.js";
import { theme } from "./theme/resolver.js";
import { createScrollbar, safeSetStyle, scrollableStyle } from "./ui-primitives.js";

// Re-export form controls
export {
  createButton, createCheckbox, createRadioGroup, createSelect,
} from "./ui-parts-forms.js";
export type {
  ButtonOptions, ButtonHandle, CheckboxOptions, CheckboxHandle,
  RadioOption, RadioGroupOptions, RadioGroupHandle,
  SelectOption, SelectOptions, SelectHandle,
  ChangeEvent, SelectEvent,
} from "./ui-parts-forms.js";

// Re-export feedback components
export { createProgressBar, createSpinner } from "./ui-parts-feedback.js";
export type {
  ProgressBarOptions, ProgressBarHandle,
  SpinnerOptions, SpinnerHandle,
} from "./ui-parts-feedback.js";

/** @primitive */
export type Rect = { top: number; left: number; width: number; height: number };

/** @primitive */
export type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

/** @primitive */
export type FlexBasis = number | `${number}fr`;

/** @primitive */
export type TrackSize = number | `${number}fr`;

/** @primitive — reserved for future use; not yet applied by layout functions. */
export type AxisAlign = "start" | "center" | "end";

/** @primitive — reserved for future use; not yet applied by layout functions. */
export type Alignment = {
  justify?: AxisAlign; // horizontal (not yet implemented)
  align?: AxisAlign;   // vertical (not yet implemented)
};

/** @primitive */
export type Gap = number | {
  row?: number;
  column?: number;
};

/** @primitive */
export type FlexChild = {
  key: string;
  basis: FlexBasis;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: Alignment;
};

/** @primitive */
export type GridChild = {
  key: string;
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: Alignment;
};

type Axis = "vertical" | "horizontal";

/** Clamp n between lo and hi (inclusive). */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampSize(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function applyRect(node: blessed.Widgets.BoxElement, rect: Rect): void {
  node.top = rect.top;
  node.left = rect.left;
  node.width = clampSize(rect.width);
  node.height = clampSize(rect.height);
}

/** Wrap a raw blessed box as a LayoutPart so it can participate in createStack/createRow layout. */
export function createNodePart(
  node: blessed.Widgets.BoxElement,
  opts?: { restyle?: () => void }
): LayoutPart<Record<string, never>> {
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
  children: FlexChild[],
  axis: Axis
): LayoutPart<void> {
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

  const layoutChildren = (rect: Rect) => {
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

      const cappedExtent = clamp(extent, 0, totalExtent - cursor);
      const childRect =
        axis === "vertical"
          ? { top: cursor, left: 0, width: lastRect.width, height: cappedExtent }
          : { top: 0, left: cursor, width: cappedExtent, height: lastRect.height };

      child.part.layout(childRect);
      cursor += cappedExtent;
    }
  };

  // NOTE: Internal resize listeners removed to prevent double-fire.
  // Modules should call root.layout(...) from win.onResize() — that is
  // the canonical pattern and avoids cascading relayouts.

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
export function createStack(parent: blessed.Widgets.Node, children: FlexChild[]): LayoutPart<void> {
  return createLinearLayout(parent, children, "vertical");
}

/** @primitive */
export function createRow(parent: blessed.Widgets.Node, children: FlexChild[]): LayoutPart<void> {
  return createLinearLayout(parent, children, "horizontal");
}

// ── Responsive helpers ────────────────────────────────────────────────────

/** @primitive */
export type BreakpointName = "xs" | "sm" | "md" | "lg" | "xl";

/** @primitive */
export type BreakpointEntry<T extends string = BreakpointName> = {
  name: T;
  minWidth: number;
};

/**
 * Standard breakpoints for terminal layouts.
 * Modules can use these directly or define custom entries.
 */
export const DEFAULT_BREAKPOINTS: BreakpointEntry[] = [
  { name: "xs", minWidth: 0 },
  { name: "sm", minWidth: 40 },
  { name: "md", minWidth: 60 },
  { name: "lg", minWidth: 80 },
  { name: "xl", minWidth: 120 },
];

/**
 * Pick the best matching breakpoint for a given width.
 *
 * Entries must be sorted ascending by minWidth (largest matching wins).
 * Returns the name of the matched breakpoint.
 *
 * @example
 * const mode = pickBreakpoint(width, [
 *   { name: "sm", minWidth: 0 },
 *   { name: "md", minWidth: 50 },
 *   { name: "lg", minWidth: 80 },
 * ]);
 *
 * @example
 * // Using default breakpoints:
 * const mode = pickBreakpoint(width);
 *
 * @primitive
 */
export function pickBreakpoint<T extends string>(
  width: number,
  entries?: BreakpointEntry<T>[],
): T {
  const bp = entries ?? (DEFAULT_BREAKPOINTS as BreakpointEntry<T>[]);
  if (bp.length === 0) return (DEFAULT_BREAKPOINTS[0] as BreakpointEntry<T>).name;
  let matched = bp[0]!.name;
  for (const entry of bp) {
    if (width >= entry.minWidth) {
      matched = entry.name;
    }
  }
  return matched;
}

// ── createGrid ────────────────────────────────────────────────────────────

/** @primitive */
export type GridOptions = {
  rows: number;
  columns: number;
  templateRows?: TrackSize[];
  templateColumns?: TrackSize[];
  gap?: Gap;
  align?: Alignment;
};

/** @primitive */
export type GridHandle = LayoutPart<void> & {
  set(child: GridChild): void;
  remove(key: string): void;
};

/**
 * Resolve an array of TrackSize values into pixel sizes for a given total extent.
 * Fixed values are taken first, then remaining space is distributed among fr values.
 */
function resolveTrackSizes(templates: TrackSize[], count: number, total: number): number[] {
  // Build effective template array padded/truncated to `count`
  const specs: TrackSize[] = [];
  for (let i = 0; i < count; i++) {
    specs.push(templates[i] ?? "1fr");
  }

  let fixedTotal = 0;
  let frTotal = 0;
  for (const spec of specs) {
    const fr = parseFractionBasis(spec);
    if (fr !== null) {
      frTotal += fr;
    } else {
      fixedTotal += typeof spec === "number" ? Math.max(0, spec) : 0;
    }
  }

  let remaining = Math.max(0, total - fixedTotal);
  let remainingFr = frTotal;
  const sizes: number[] = [];

  for (const spec of specs) {
    const fr = parseFractionBasis(spec);
    if (fr !== null) {
      if (remainingFr <= 0 || fr <= 0) {
        sizes.push(0);
      } else if (fr === remainingFr) {
        sizes.push(remaining);
        remaining = 0;
        remainingFr = 0;
      } else {
        const size = Math.floor((remaining * fr) / remainingFr);
        sizes.push(size);
        remaining -= size;
        remainingFr -= fr;
      }
    } else {
      sizes.push(typeof spec === "number" ? Math.max(0, spec) : 0);
    }
  }

  return sizes;
}

function resolveGap(gap: Gap | undefined): { rowGap: number; columnGap: number } {
  if (gap === undefined) return { rowGap: 0, columnGap: 0 };
  if (typeof gap === "number") return { rowGap: gap, columnGap: gap };
  return { rowGap: gap.row ?? 0, columnGap: gap.column ?? 0 };
}

/** @primitive */
export function createGrid(
  parent: blessed.Widgets.Node,
  options: GridOptions,
): GridHandle {
  const { rows, columns, gap: gapOpt, align: gridAlign } = options;
  const templateRows = options.templateRows ?? [];
  const templateColumns = options.templateColumns ?? [];

  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    style: theme().body,
  });

  const childrenMap = new Map<string, GridChild>();

  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function layoutChildren(rect: Rect) {
    lastRect = {
      top: rect.top,
      left: rect.left,
      width: clampSize(rect.width),
      height: clampSize(rect.height),
    };
    applyRect(node, lastRect);

    const { rowGap, columnGap } = resolveGap(gapOpt);

    // Total gaps
    const totalRowGap = Math.max(0, (rows - 1) * rowGap);
    const totalColGap = Math.max(0, (columns - 1) * columnGap);

    // Resolve track sizes
    const colSizes = resolveTrackSizes(templateColumns, columns, lastRect.width - totalColGap);
    const rowSizes = resolveTrackSizes(templateRows, rows, lastRect.height - totalRowGap);

    // Compute cumulative offsets
    const colOffsets: number[] = [0];
    for (let c = 0; c < columns; c++) {
      colOffsets.push(colOffsets[c]! + colSizes[c]! + (c < columns - 1 ? columnGap : 0));
    }
    const rowOffsets: number[] = [0];
    for (let r = 0; r < rows; r++) {
      rowOffsets.push(rowOffsets[r]! + rowSizes[r]! + (r < rows - 1 ? rowGap : 0));
    }

    // Layout each child
    for (const child of childrenMap.values()) {
      const isVisible = child.visible?.() !== false;
      if (!isVisible) {
        child.part.node.hide();
        child.part.layout({ top: 0, left: 0, width: 0, height: 0 });
        continue;
      }

      child.part.node.show();

      const r = clamp(child.row, 0, rows - 1);
      const c = clamp(child.column, 0, columns - 1);
      const rSpan = clamp(child.rowSpan ?? 1, 1, rows - r);
      const cSpan = clamp(child.columnSpan ?? 1, 1, columns - c);

      const cellTop = rowOffsets[r]!;
      const cellLeft = colOffsets[c]!;
      const cellWidth = (colOffsets[c + cSpan] ?? colOffsets[columns]!) - cellLeft -
        (c + cSpan < columns ? columnGap : 0);
      const cellHeight = (rowOffsets[r + rSpan] ?? rowOffsets[rows]!) - cellTop -
        (r + rSpan < rows ? rowGap : 0);

      // Apply alignment within the cell
      const align = child.align ?? gridAlign;
      let childLeft = cellLeft;
      let childTop = cellTop;
      let childWidth = Math.max(0, cellWidth);
      let childHeight = Math.max(0, cellHeight);

      // Alignment only adjusts position, not size for grid cells
      // (size fills the cell unless explicitly constrained — future enhancement)

      child.part.layout({
        top: childTop,
        left: childLeft,
        width: childWidth,
        height: childHeight,
      });
    }
  }

  return {
    node,
    layout(rect) {
      layoutChildren(rect);
    },
    update() {},
    restyle() {
      safeSetStyle(node, theme().body);
      for (const child of childrenMap.values()) {
        child.part.restyle();
      }
    },
    destroy() {
      for (const child of childrenMap.values()) {
        child.part.destroy();
      }
      node.destroy();
    },
    set(child: GridChild) {
      // Remove existing child with same key
      const existing = childrenMap.get(child.key);
      if (existing && existing.part !== child.part) {
        existing.part.destroy();
      }
      childrenMap.set(child.key, child);
      if (child.part.node.parent !== node) {
        node.append(child.part.node);
      }
      // Re-layout if we have dimensions
      if (lastRect.width > 0 || lastRect.height > 0) {
        layoutChildren(lastRect);
      }
    },
    remove(key: string) {
      const child = childrenMap.get(key);
      if (child) {
        child.part.destroy();
        childrenMap.delete(key);
        if (lastRect.width > 0 || lastRect.height > 0) {
          layoutChildren(lastRect);
        }
      }
    },
  };
}

/** @primitive */
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
        width: "100%" as any,
        height: headerHeight,
        style: theme().header,
      })
    : null;

  const viewport = blessed.box({
    parent: container,
    top: headerHeight,
    left: 0,
    width: "100%" as any,
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
        width: "100%" as any,
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
      return (viewport as any).getScrollPerc?.() ?? 0;
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
export function createTabs(
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
    (parent as any).input = true;
    (parent as any).keys = true;
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

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN GENERATORS — reusable animated text fill functions
// ═══════════════════════════════════════════════════════════════════════════

export type PatternGenerator = (w: number, h: number, tick: number) => string[];

/** Shifting block gradient ░▒▓█ */
export const patternBlockGradient: PatternGenerator = (w, h, t) => {
  const chars = "░▒▓█▓▒";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Diagonal hatching ╱╲ */
export const patternDiagonalHatch: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "╱" : "╲";
    lines.push(line);
  }
  return lines;
};

/** Diamond grid of assorted chars */
export const patternDiamondGrid: PatternGenerator = (w, h, t) => {
  const chars = "<>v^*+.o";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Braille dot animation */
export const patternBraille: PatternGenerator = (w, h, t) => {
  const braille = "⠁⠂⠄⡀⢀⠠⠐⠈";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += braille[(x * 3 + y * 7 + t * 2) % braille.length];
    lines.push(line);
  }
  return lines;
};

/** Cross-stitch ┼─│ grid */
export const patternCrossStitch: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      if ((x + t) % 4 === 0 && (y + t) % 3 === 0) line += "┼";
      else if ((y + t) % 3 === 0) line += "─";
      else if ((x + t) % 4 === 0) line += "│";
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
};

/** Sine wave ~-_ */
export const patternWave: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    const phase = Math.floor(Math.sin((y + t) * 0.5) * 3);
    for (let x = 0; x < w; x++) {
      const v = Math.sin((x + phase + t) * 0.4);
      line += v > 0.3 ? "~" : v > -0.3 ? "-" : "_";
    }
    lines.push(line);
  }
  return lines;
};

/** Hash interference #=:.| */
export const patternHashInterference: PatternGenerator = (w, h, t) => {
  const chars = "#=:.|";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x * 3 + y * 7 + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Checkerboard ▄▀ */
export const patternCheckerboard: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "▄" : "▀";
    lines.push(line);
  }
  return lines;
};

/** Pipe maze +-|.: */
export const patternPipeMaze: PatternGenerator = (w, h, t) => {
  const c = "+-|.+-|:";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += c[(x * 3 + y * 5 + t) % c.length];
    lines.push(line);
  }
  return lines;
};

/** Braille density field ⣿⣷⣶...⡀ */
export const patternBrailleDensity: PatternGenerator = (w, h, t) => {
  const dots = "⣿⣷⣶⣦⣤⣄⣀⡀ ";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const d = Math.sin((x + t) * 0.4) * Math.cos((y + t) * 0.3);
      const idx = Math.floor((d + 1) * 0.5 * (dots.length - 1));
      line += dots[Math.max(0, Math.min(dots.length - 1, idx))];
    }
    lines.push(line);
  }
  return lines;
};

/** Concentric rings .,:;!|#@ */
export const patternConcentricRings: PatternGenerator = (w, h, t) => {
  const chars = " .,:;!|#@";
  const lines: string[] = [];
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + ((y - cy) * 2) ** 2);
      const idx = Math.floor(dist + t) % chars.length;
      line += chars[idx];
    }
    lines.push(line);
  }
  return lines;
};

/** All built-in patterns as an ordered array. */
export const PATTERNS: PatternGenerator[] = [
  patternBlockGradient,
  patternDiagonalHatch,
  patternDiamondGrid,
  patternBraille,
  patternCrossStitch,
  patternWave,
  patternHashInterference,
  patternCheckerboard,
  patternPipeMaze,
  patternBrailleDensity,
  patternConcentricRings,
];

// ═══════════════════════════════════════════════════════════════════════════
// DATA SIMULATION HELPERS — fake data for dashboards and demos
// ═══════════════════════════════════════════════════════════════════════════

/** Generate a sine wave array. */
export function sinWave(offset: number, len: number, amp: number, freq: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(amp * Math.sin(freq * (i + offset)));
  return out;
}

/** Generate a random-walk history series. */
export function randHistory(len: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  let v = lo + Math.random() * (hi - lo);
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.5) * (hi - lo) * 0.15;
    v = Math.max(lo, Math.min(hi, v));
    out.push(Math.round(v));
  }
  return out;
}

/** Generate numeric x-axis labels ["0", "1", ...]. */
export function xLabels(len: number): string[] {
  return Array.from({ length: len }, (_, i) => `${i}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOUR HELPERS — ANSI gradient rendering
// ═══════════════════════════════════════════════════════════════════════════

/** Convert HSL (h 0-1, s 0-1, l 0-1) to RGB [0-255, 0-255, 0-255]. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Render a single line of ANSI true-colour gradient blocks. hueStart/hueEnd in degrees 0-360. */
export function ansiGradientLine(width: number, hueStart: number, hueEnd: number): string {
  let line = "";
  for (let i = 0; i < width; i++) {
    const t = i / Math.max(1, width - 1);
    const h = hueStart + t * (hueEnd - hueStart);
    const [r, g, b] = hslToRgb(h / 360, 0.8, 0.5);
    line += `\x1b[38;2;${r};${g};${b}m█`;
  }
  return line + "\x1b[0m";
}
