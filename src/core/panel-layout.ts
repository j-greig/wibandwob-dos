/**
 * panel-layout.ts — Magazine-style panel layout primitives.
 *
 * Types and functions for laying out rectangular panels in a multi-column,
 * row-flowing grid. Used by microapps that render panel-based UIs like
 * §y² Chronicles.
 *
 * Extracted from microapps/sy2-chronicles/index.ts.
 */

import type blessed from "blessed";
import { clamp } from "./ui-parts.js";

export type PanelDef = {
  id: string;
  title: string;
  w: number;
  h: number;
  col: 0 | 1 | 2;
  live?: boolean;
  content: (tick: number, w: number, h: number) => string;
};

export type PanelNode = {
  def: PanelDef;
  frame: blessed.Widgets.BoxElement;
  titleBar: blessed.Widgets.BoxElement;
  content: blessed.Widgets.BoxElement;
  x: number;
  y: number;
};

export type LayoutResult = {
  contentWidth: number;
  contentHeight: number;
  placements: Array<{ id: string; x: number; y: number }>;
};

export const COL_GAP = 2;

/**
 * Column-first layout: group panels by `col`, stack each column vertically,
 * place columns side by side. Use when panels have meaningful col assignments.
 */
// ── Column layout types and defaults ──────────────────────────────────────

import type { ZineItem, ZineLayoutResult } from "./canvas-types.js";
export type { ZineItem, ZineLayoutResult } from "./canvas-types.js";

/** @deprecated Use ZineItem with type:"header" instead. */
export type ColumnHeader = { col: number; text: string; x: number; y: number; width: number };

/** Result from layoutColumns — extends LayoutResult with header positions. */
type ColumnLayoutResult = LayoutResult & { headers: ColumnHeader[] };

/** Options for column layout. All optional — sensible defaults applied. */
export interface ColumnLayoutOptions {
  /** Maximum number of columns before wrapping (default: 6). */
  maxColumns?: number;
  /** Horizontal gap between columns in chars (default: COL_GAP = 2). */
  columnGap?: number;
  /** Vertical gap between panels within a column (default: 1). */
  panelGap?: number;
  /** Vertical gap between wrapped column-rows (default: 2). */
  rowGap?: number;
  /** Minimum column width in chars (default: 3). */
  minColumnWidth?: number;
  /** Minimum panel height in chars (default: 3). */
  minPanelHeight?: number;
  /** Column header text keyed by col index. Omit for no headers. */
  columnHeaders?: Map<number, string>;
}

const COLUMN_DEFAULTS: Required<Omit<ColumnLayoutOptions, "columnHeaders">> = {
  maxColumns: 6,
  columnGap: COL_GAP,
  panelGap: 1,
  rowGap: 2,
  minColumnWidth: 3,
  minPanelHeight: 3,
};

/**
 * Column-first layout: group panels by `col`, stack each column vertically,
 * place columns side by side. Wraps when columns exceed maxWidth.
 *
 * Options with defaults:
 * - maxColumns: 6 (columns beyond this always wrap)
 * - columnGap: 2 (chars between columns)
 * - panelGap: 1 (rows between panels in a column)
 * - rowGap: 2 (rows between wrapped column-rows)
 * - columnHeaders: Map<col, text> (renders header + rule above column)
 */
export function layoutColumns(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult {
  const {
    maxColumns,
    columnGap,
    panelGap,
    rowGap,
    minColumnWidth,
    minPanelHeight,
  } = { ...COLUMN_DEFAULTS, ...opts };
  const columnHeaders = opts?.columnHeaders;

  const safeWidth = Math.max(20, Math.floor(maxWidth));
  const items: ZineItem[] = [];

  // Group by col
  const cols = new Map<number, PanelDef[]>();
  for (const p of panels) {
    const c = p.col ?? 0;
    if (!cols.has(c)) cols.set(c, []);
    cols.get(c)!.push(p);
  }

  const sortedCols = [...cols.keys()].sort((a, b) => a - b);

  // Pre-measure each column (natural widths)
  const naturalWidths: number[] = [];
  const colHeights: number[] = [];
  for (const colIdx of sortedCols) {
    const colPanels = cols.get(colIdx)!;
    let maxW = 0;
    let totalH = 0;
    for (let i = 0; i < colPanels.length; i++) {
      const p = colPanels[i]!;
      const w = clamp(p.w, minColumnWidth, safeWidth);
      const h = Math.max(minPanelHeight, p.h);
      if (w > maxW) maxW = w;
      totalH += h + (i < colPanels.length - 1 ? panelGap : 0);
    }
    naturalWidths.push(maxW);
    colHeights.push(totalH);
  }

  // Responsive shrink: if all columns at natural width don't fit, shrink
  // proportionally so they do. This prevents wrapping to single column.
  const totalNatural = naturalWidths.reduce((s, w) => s + w, 0)
    + (naturalWidths.length - 1) * columnGap;
  let colWidths: number[];
  if (totalNatural > safeWidth && naturalWidths.length > 1) {
    const availableForCols = safeWidth - (naturalWidths.length - 1) * columnGap;
    const totalW = naturalWidths.reduce((s, w) => s + w, 0);
    colWidths = naturalWidths.map(w =>
      Math.max(minColumnWidth, Math.floor((w / totalW) * availableForCols))
    );
  } else {
    colWidths = [...naturalWidths];
  }

  // Place columns left-to-right, wrapping at maxWidth or maxColumns
  const headerHeight = columnHeaders?.size ? 3 : 0; // text + rule + blank line
  let cursorX = 0;
  let rowBaseY = 0;
  let rowMaxH = 0;
  let colsInRow = 0;
  let contentWidth = 0;
  let contentHeight = 1;

  for (let i = 0; i < sortedCols.length; i++) {
    const colIdx = sortedCols[i]!;
    const colW = colWidths[i]!;
    const colH = colHeights[i]!;
    const colPanels = cols.get(colIdx)!;

    // Wrap: exceeds width or maxColumns per row
    const wouldExceed = cursorX > 0 && cursorX + colW > safeWidth;
    const wouldExceedMax = colsInRow >= maxColumns;
    if (wouldExceed || wouldExceedMax) {
      rowBaseY += rowMaxH + headerHeight + rowGap;
      cursorX = 0;
      rowMaxH = 0;
      colsInRow = 0;
    }

    // Column header → ZineItem type:"header"
    const headerText = columnHeaders?.get(colIdx);
    if (headerText) {
      items.push({
        id: `__header_col${colIdx}`,
        type: "header",
        x: cursorX, y: rowBaseY,
        w: colW, h: 2,
        col: colIdx,
        title: headerText,
        headerText,
      });
    }

    // Panels → ZineItem type:"panel"
    let cursorY = rowBaseY + headerHeight;
    for (let j = 0; j < colPanels.length; j++) {
      const panel = colPanels[j]!;
      const w = clamp(panel.w, minColumnWidth, colW);  // shrink to column width
      const h = Math.max(minPanelHeight, panel.h);
      items.push({
        id: panel.id,
        type: "panel",
        x: cursorX, y: cursorY,
        w, h,
        col: colIdx,
        title: panel.title,
        content: panel.content,
        live: panel.live,
      });
      cursorY += h + (j < colPanels.length - 1 ? panelGap : 0);
    }

    const totalColH = colH + headerHeight;
    if (totalColH > rowMaxH) rowMaxH = totalColH;
    contentWidth = Math.max(contentWidth, cursorX + colW);
    contentHeight = Math.max(contentHeight, rowBaseY + totalColH);
    cursorX += colW + columnGap;
    colsInRow++;
  }

  return {
    items,
    contentWidth: Math.max(contentWidth, safeWidth),
    contentHeight: Math.max(contentHeight, 1),
  };
}

/** Row-flow layout: pack panels left-to-right, wrapping at maxWidth. */
export function layoutPanels(panels: PanelDef[], maxWidth: number): LayoutResult {
  const placements: Array<{ id: string; x: number; y: number }> = [];
  let contentWidth = 0;
  const safeWidth = Math.max(20, Math.floor(maxWidth));
  const normalizedPanels = panels.map((panel, index) => ({
    ...panel,
    w: clamp(panel.w, 3, safeWidth),
    h: Math.max(3, panel.h),
    _index: index,
  }));
  const rows: Array<typeof normalizedPanels> = [];
  let row: typeof normalizedPanels = [];
  let rowWidth = 0;

  for (const panel of normalizedPanels) {
    const nextWidth = row.length === 0 ? panel.w : rowWidth + COL_GAP + panel.w;
    if (row.length > 0 && nextWidth > safeWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(panel);
    rowWidth = row.length === 1 ? panel.w : rowWidth + COL_GAP + panel.w;
  }
  if (row.length > 0) {
    rows.push(row);
  }

  let cursorY = 0;
  let contentHeight = 1;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowPanels = [...(rows[rowIndex] ?? [])].sort((a, b) => a.col - b.col || a._index - b._index);
    let cursorX = 0;
    let rowHeight = 0;
    for (const panel of rowPanels) {
      placements.push({ id: panel.id, x: cursorX, y: cursorY });
      cursorX += panel.w + COL_GAP;
      rowHeight = Math.max(rowHeight, panel.h);
      contentWidth = Math.max(contentWidth, cursorX - COL_GAP);
    }
    contentHeight = Math.max(contentHeight, cursorY + rowHeight);
    if (rowIndex < rows.length - 1) {
      cursorY += rowHeight + 1;
    }
  }

  return {
    placements,
    contentWidth: Math.max(contentWidth, safeWidth),
    contentHeight: Math.max(contentHeight, 1),
  };
}

/**
 * Measure the usable viewport of a blessed box element.
 *
 * Returns width and height clamped to sensible minimums.
 * Safe to call at any time — does not rely on lpos (which can be stale
 * in scrollable boxes). Uses direct Number coercion of width/height.
 */
export function measureViewport(box: blessed.Widgets.BoxElement): { width: number; height: number } {
  return {
    width: Math.max(1, Number(box.width) || 80),
    height: Math.max(1, Number(box.height) || 24),
  };
}

/**
 * Convert screen coordinates to content-space coordinates within a canvas.
 *
 * Uses atop/aleft (always current) rather than lpos (can be stale in
 * scrollable boxes). Accounts for scroll offset.
 *
 * @param canvas - The blessed box element representing the scrollable canvas
 * @param screenX - Screen X coordinate (e.g., from mouse event)
 * @param screenY - Screen Y coordinate (e.g., from mouse event)
 * @returns Content-space coordinates { x, y }
 */
export function pointerToContent(
  canvas: blessed.Widgets.BoxElement,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const ct = Number(canvas.atop ?? canvas.lpos?.yi ?? 1);
  const cl = Number(canvas.aleft ?? canvas.lpos?.xi ?? 1);
  const scrollY = canvas.getScroll?.() ?? 0;
  return { x: screenX - cl, y: screenY - ct + scrollY };
}

/**
 * Hit-test a content-space point against all panel nodes.
 *
 * @param panelNodes - Map of panel ID to PanelNode
 * @param cx - Content-space X coordinate
 * @param cy - Content-space Y coordinate
 * @returns The hit PanelNode, or undefined if no hit
 */
export function hitPanel(
  panelNodes: Map<string, PanelNode>,
  cx: number,
  cy: number,
): PanelNode | undefined {
  for (const node of panelNodes.values()) {
    const w = Number(node.frame.width) || node.def.w;
    const h = Number(node.frame.height) || node.def.h;
    if (cx >= node.x && cx < node.x + w && cy >= node.y && cy < node.y + h) {
      return node;
    }
  }
  return undefined;
}
