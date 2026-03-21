/**
 * layout.ts — Layout engine primitives.
 * Types, Stack, Row, Grid, responsive breakpoints, rect helpers.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import type { Rect, LayoutPart, FlexBasis, TrackSize, AxisAlign } from "./types.js";

export type { Rect, LayoutPart, FlexBasis, TrackSize, AxisAlign } from "./types.js";


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
  // NOTE: LayoutPart<unknown> (not <any>) — prevents CompositionHelper handles
  // from silently passing here. CompositionHelpers lack .node and .layout(rect)
  // which LayoutPart requires. With <any>, TypeScript's structural check was loose
  // enough to accept them, causing silent blank-window bugs at runtime.
  part: LayoutPart<unknown>;
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

export function clampSize(value: number): number {
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

export function clipText(value: string, width: number): string {
  return width <= 0 ? "" : value.slice(0, width);
}

export function padLine(value: string, width: number): string {
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

export function wrapIndentedText(text: string, width: number, paddingLeft: number, paddingTop: number): string {
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

export function renderAlignedBar(left: string, right: string | undefined, width: number, leftInset = 0): string {
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

/** Options for createStack / createRow. */
export interface LinearLayoutOptions {
  /** Gap in character cells between children. Default 0. */
  gap?: number;
}

function createLinearLayout(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  axis: Axis,
  opts?: LinearLayoutOptions,
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
    const gap = opts?.gap ?? 0;
    const activeChildren = children.filter((child) => child.visible?.() !== false);
    const totalGap = Math.max(0, activeChildren.length - 1) * gap;
    const fixedTotal = activeChildren.reduce((sum, child) => {
      return sum + (typeof child.basis === "number" ? Math.max(0, child.basis) : 0);
    }, 0);
    const totalFr = activeChildren.reduce((sum, child) => {
      return sum + (parseFractionBasis(child.basis) ?? 0);
    }, 0);
    let remaining = Math.max(0, totalExtent - fixedTotal - totalGap);
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
      cursor += cappedExtent + gap;
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
export function createStack(parent: blessed.Widgets.Node, children: FlexChild[], opts?: LinearLayoutOptions): LayoutPart<void> {
  return createLinearLayout(parent, children, "vertical", opts);
}

/** @primitive */
export function createRow(parent: blessed.Widgets.Node, children: FlexChild[], opts?: LinearLayoutOptions): LayoutPart<void> {
  return createLinearLayout(parent, children, "horizontal", opts);
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

