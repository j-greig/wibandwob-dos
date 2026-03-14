/**
 * Flex Wrap Demo (Pi/Claude version)
 *
 * Proving-ground module: 16 coloured chips that reflow automatically
 * when the window is resized. No breakpoints, no manual layout switching —
 * pure flex-wrap behaviour.
 *
 * The createWrappingRow function is inlined here as a proving-ground
 * implementation. It is NOT SDK code. Same pattern as hello-world
 * inlining createGrid.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

// ── Types (aligned with E034 layout guide decisions) ─────────────────────

type Rect = { top: number; left: number; width: number; height: number };

type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

type FlexChild = {
  key: string;
  basis: number;
  height: number;
  part: LayoutPart<any>;
  visible?: () => boolean;
};

type WrapGap = { row: number; column: number };

// ── Proving-ground implementation: createWrappingRow ──────────────────────
// NOT SDK code. Inlined to prove the concept.

interface WrapMetrics {
  rowsUsed: number;
  columnsInFirstRow: number;
  maxColumnsInAnyRow: number;
  contentHeight: number;
  overflowY: boolean;
}

function createWrappingRow(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  opts?: { gap?: number | { row?: number; column?: number } },
): LayoutPart<void> & { metrics(): WrapMetrics } {

  const node = blessed.box({
    parent,
    top: 0, left: 0, width: 0, height: 0,
  });

  for (const child of children) {
    node.append(child.part.node);
  }

  const gap: WrapGap = (() => {
    const g = opts?.gap;
    if (g === undefined) return { row: 0, column: 0 };
    if (typeof g === "number") return { row: g, column: g };
    return { row: g.row ?? 0, column: g.column ?? 0 };
  })();

  let lastMetrics: WrapMetrics = {
    rowsUsed: 0,
    columnsInFirstRow: 0,
    maxColumnsInAnyRow: 0,
    contentHeight: 0,
    overflowY: false,
  };
  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function layoutChildren(rect: Rect) {
    lastRect = rect;
    node.top = rect.top;
    node.left = rect.left;
    node.width = Math.max(0, rect.width);
    node.height = Math.max(0, rect.height);

    const active = children.filter(c => c.visible?.() !== false);

    // Hide invisible children
    for (const child of children) {
      if (child.visible?.() === false) {
        child.part.node.hide();
        child.part.layout({ top: 0, left: 0, width: 0, height: 0 });
      }
    }

    if (active.length === 0 || rect.width <= 0) {
      lastMetrics = {
        rowsUsed: 0, columnsInFirstRow: 0, maxColumnsInAnyRow: 0,
        contentHeight: 0, overflowY: false,
      };
      return;
    }

    const containerW = rect.width;
    let cursorX = 0;
    let cursorY = 0;
    let rowIndex = 0;
    let colsInRow = 0;
    let maxCols = 0;
    let firstRowCols = 0;
    let rowHeight = 0;

    for (let i = 0; i < active.length; i++) {
      const child = active[i]!;
      const childW = Math.min(child.basis, containerW); // clamp oversize
      const childH = child.height;

      // Do we need to wrap?
      if (colsInRow > 0 && cursorX + gap.column + childW > containerW) {
        // Finish current row
        if (rowIndex === 0) firstRowCols = colsInRow;
        maxCols = Math.max(maxCols, colsInRow);

        // Start new row
        cursorY += rowHeight + gap.row;
        cursorX = 0;
        colsInRow = 0;
        rowHeight = 0;
        rowIndex++;
      }

      // Place child
      const left = colsInRow > 0 ? cursorX + gap.column : cursorX;
      child.part.node.show();
      child.part.layout({ top: cursorY, left, width: childW, height: childH });

      cursorX = left + childW;
      rowHeight = Math.max(rowHeight, childH);
      colsInRow++;
    }

    // Finish last row
    if (rowIndex === 0) firstRowCols = colsInRow;
    maxCols = Math.max(maxCols, colsInRow);

    const contentHeight = cursorY + rowHeight;

    lastMetrics = {
      rowsUsed: rowIndex + 1,
      columnsInFirstRow: firstRowCols,
      maxColumnsInAnyRow: maxCols,
      contentHeight,
      overflowY: contentHeight > rect.height,
    };
  }

  return {
    node,
    layout(rect) { layoutChildren(rect); },
    update() {},
    restyle() {
      for (const child of children) child.part.restyle();
    },
    destroy() {
      for (const child of children) child.part.destroy();
      node.destroy();
    },
    metrics() { return lastMetrics; },
  };
}

// ── Chip factory ─────────────────────────────────────────────────────────

const CHIP_COLOURS = [
  "black", "blue", "green", "cyan", "red", "magenta", "yellow", "white",
  "grey", "lightblue", "lightgreen", "lightcyan", "lightred", "lightmagenta", "lightyellow", "brightwhite",
];

const FILL_CHARS = "░▒▓█▓▒░ ";

function createChip(
  parent: blessed.Widgets.Node,
  index: number,
): LayoutPart<void> {
  const colour = CHIP_COLOURS[index % CHIP_COLOURS.length]!;
  const label = `#${index.toString().padStart(2, "0")}`;

  const node = blessed.box({
    parent,
    top: 0, left: 0, width: 0, height: 0,
    border: { type: "line" },
    label: ` ${label} `,
    tags: false,
    style: {
      fg: "white",
      bg: colour === "black" ? "black" : undefined,
      border: { fg: colour },
    },
  });

  // Fill content: pattern inside the chip
  function renderContent(w: number, h: number) {
    const innerW = Math.max(0, w - 2);
    const innerH = Math.max(0, h - 2);
    const lines: string[] = [];
    for (let y = 0; y < innerH; y++) {
      let line = "";
      for (let x = 0; x < innerW; x++) {
        line += FILL_CHARS[(x + y + index) % FILL_CHARS.length];
      }
      lines.push(line);
    }
    node.setContent(lines.join("\n"));
  }

  return {
    node,
    layout(rect) {
      node.top = rect.top;
      node.left = rect.left;
      node.width = Math.max(0, rect.width);
      node.height = Math.max(0, rect.height);
      renderContent(rect.width, rect.height);
    },
    update() {},
    restyle() {},
    destroy() { node.destroy(); },
  };
}

// ── Module setup ─────────────────────────────────────────────────────────

const CHIP_COUNT = 16;
const CHIP_WIDTH = 12;
const CHIP_HEIGHT = 3;
const STATUS_HEIGHT = 1;

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Wrap Demo (Pi)",
    description: "Colour chips that reflow on resize — proving flex-wrap layout",
    action: () => {
      const win = host.createWindow({
        title: "Flex Wrap Demo (Pi)",
        width: 80,
        height: 24,
      });

      // Scrollable viewport (scroll is a container concern, not wrap's)
      const viewport = blessed.box({
        parent: win.body,
        top: 0, left: 0, right: 0, bottom: STATUS_HEIGHT,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        scrollbar: { ch: "│", style: { fg: "grey" } },
      });

      // Status bar (pinned outside scroll area)
      const statusBar = blessed.box({
        parent: win.body,
        bottom: 0, left: 0, right: 0, height: STATUS_HEIGHT,
        style: { fg: "white", bg: "black", bold: true },
      });

      // Create chips
      const chips: FlexChild[] = [];
      for (let i = 0; i < CHIP_COUNT; i++) {
        const chip = createChip(viewport, i);
        chips.push({
          key: `chip-${i}`,
          basis: CHIP_WIDTH,
          height: CHIP_HEIGHT,
          part: chip,
        });
      }

      // Wrapping row layout
      const wrappingRow = createWrappingRow(viewport, chips, {
        gap: { row: 1, column: 1 },
      });

      function render() {
        const w = Math.max(1, Number(win.body.width) || 80);
        const h = Math.max(1, Number(win.body.height) || 24);
        const viewH = h - STATUS_HEIGHT;

        // Layout the wrapping row within the viewport
        wrappingRow.layout({
          top: 0, left: 0,
          width: w,
          height: viewH,
        });

        const m = wrappingRow.metrics();

        // Update scrollable content height so blessed knows how to scroll
        // The wrapping row node needs its height set to contentHeight
        // for scrollbar to work correctly
        wrappingRow.node.height = Math.max(viewH, m.contentHeight);

        // Status bar
        const overflow = m.overflowY ? " SCROLL" : "";
        statusBar.setContent(
          ` ${CHIP_COUNT} chips  ${m.columnsInFirstRow}/row  ` +
          `${m.rowsUsed} rows  ${w}x${h}${overflow}`
        );

        host.screen.render();
      }

      render();
      win.onResize(render);

      win.onCleanup(() => {
        wrappingRow.destroy();
        statusBar.destroy();
      });

      win.onRestyle(() => {
        wrappingRow.restyle();
        host.screen.render();
      });

      win.describeState(() => {
        const m = wrappingRow.metrics();
        const w = Number(win.body.width) || 0;
        const h = Number(win.body.height) || 0;
        return {
          summary: `Flex wrap: ${m.columnsInFirstRow}/row, ${m.rowsUsed} rows, ${w}x${h}`,
          totalChildren: CHIP_COUNT,
          visibleChildren: CHIP_COUNT,
          ...m,
          windowWidth: w,
          windowHeight: h,
        };
      });

      win.captureText(() => {
        const m = wrappingRow.metrics();
        return `Flex Wrap Demo — ${CHIP_COUNT} chips, ${m.columnsInFirstRow}/row, ${m.rowsUsed} rows`;
      });

      win.focus();
    },
    menu: [{ category: "demos", order: 92, label: "Flex Wrap (Pi)" }],
    palette: { order: 292, label: "Flex Wrap Demo (Pi)" },
  });
}
