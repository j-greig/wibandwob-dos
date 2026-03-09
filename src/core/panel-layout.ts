/**
 * panel-layout.ts — Magazine-style panel layout primitives.
 *
 * Types and functions for laying out rectangular panels in a multi-column,
 * row-flowing grid. Used by microapps that render panel-based UIs like
 * §y² Chronicles.
 *
 * Extracted from modules/sy2-chronicles/index.ts.
 */

import type blessed from "blessed";

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

export function layoutPanels(panels: PanelDef[], maxWidth: number): LayoutResult {
  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

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
  const ct = (canvas as any).atop ?? (canvas as any).lpos?.yi ?? 1;
  const cl = (canvas as any).aleft ?? (canvas as any).lpos?.xi ?? 1;
  const scrollY = (canvas as any).getScroll?.() ?? 0;
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
