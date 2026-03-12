import blessed from "blessed";
import type { MicroappHost, Rect, LayoutPart } from "../../src/services/microapp-sdk.js";
import { applyRect, createNodePart } from "../../src/services/microapp-sdk.js";

type FlexChild = {
  key: string;
  basis: number;
  height: number;
  part: LayoutPart<any>;
  visible?: () => boolean;
};

type Gap = number | { row?: number; column?: number };

type WrapMetrics = {
  totalChildren: number;
  visibleChildren: number;
  rowsUsed: number;
  columnsInFirstRow: number;
  maxColumnsInAnyRow: number;
  contentHeight: number;
  overflowY: boolean;
  viewportWidth: number;
  viewportHeight: number;
};

type WrappingRowHandle = LayoutPart<void> & {
  getMetrics(): WrapMetrics;
  setViewportHeight(height: number): void;
};

/**
 * Proving-ground implementation only. This is not SDK code.
 * It demonstrates fixed-width row wrapping with stable source ordering.
 */
function createWrappingRow(
  parent: blessed.Widgets.Node,
  children: FlexChild[],
  opts?: { gap?: Gap },
): WrappingRowHandle {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });

  const rowGap = typeof opts?.gap === "number" ? opts.gap : opts?.gap?.row ?? 0;
  const columnGap = typeof opts?.gap === "number" ? opts.gap : opts?.gap?.column ?? 0;

  let viewportHeight = 0;
  let metrics: WrapMetrics = {
    totalChildren: children.length,
    visibleChildren: 0,
    rowsUsed: 0,
    columnsInFirstRow: 0,
    maxColumnsInAnyRow: 0,
    contentHeight: 0,
    overflowY: false,
    viewportWidth: 0,
    viewportHeight: 0,
  };

  for (const child of children) {
    node.append(child.part.node);
  }

  return {
    node,
    layout(rect) {
      applyRect(node, rect);

      const visibleChildren = children.filter(child => child.visible?.() !== false);
      const availableWidth = Math.max(1, rect.width);

      let x = 0;
      let y = 0;
      let rowHeight = 0;
      let rowCount = 0;
      let rowItemCount = 0;
      let firstRowCount = 0;
      let maxColumns = 0;

      const finishRow = () => {
        if (rowItemCount === 0) {
          return;
        }
        if (rowCount === 0) {
          firstRowCount = rowItemCount;
        }
        maxColumns = Math.max(maxColumns, rowItemCount);
        rowCount += 1;
        y += rowHeight + rowGap;
        x = 0;
        rowHeight = 0;
        rowItemCount = 0;
      };

      for (const child of children) {
        if (child.visible?.() === false) {
          child.part.node.hide();
        }
      }

      for (const child of visibleChildren) {
        const childWidth = Math.min(child.basis, availableWidth);
        const childHeight = Math.max(1, child.height);

        const neededWidth = rowItemCount === 0 ? childWidth : childWidth + columnGap;
        if (rowItemCount > 0 && x + neededWidth > availableWidth) {
          finishRow();
        }

        const childLeft = rowItemCount === 0 ? 0 : x + columnGap;
        child.part.node.show();
        child.part.layout({
          top: y,
          left: childLeft,
          width: childWidth,
          height: childHeight,
        });

        x = childLeft + childWidth;
        rowHeight = Math.max(rowHeight, childHeight);
        rowItemCount += 1;
      }

      finishRow();

      const contentHeight = rowCount === 0 ? 0 : y - rowGap;
      node.height = Math.max(0, contentHeight);
      metrics = {
        totalChildren: children.length,
        visibleChildren: visibleChildren.length,
        rowsUsed: rowCount,
        columnsInFirstRow: firstRowCount,
        maxColumnsInAnyRow: maxColumns,
        contentHeight,
        overflowY: contentHeight > viewportHeight,
        viewportWidth: rect.width,
        viewportHeight,
      };
    },
    update() {},
    restyle() {
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
    getMetrics() {
      return metrics;
    },
    setViewportHeight(height: number) {
      viewportHeight = Math.max(0, height);
      metrics = { ...metrics, viewportHeight, overflowY: metrics.contentHeight > viewportHeight };
    },
  };
}

const CHIP_WIDTH = 12;
const CHIP_HEIGHT = 3;
const CHIP_COUNT = 16;
const CHIP_GAP = { row: 1, column: 1 } as const;
const STATUS_HEIGHT = 1;
const PALETTE = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightblack",
  "brightred",
  "brightgreen",
  "brightyellow",
  "brightblue",
  "brightmagenta",
  "brightcyan",
  "brightwhite",
] as const;

function chipPattern(index: number): string[] {
  const fills = ["..", "::", "==", "##", "~~", "++", "**", "<>"];
  const fill = fills[index % fills.length] ?? "[]";
  const label = `chip ${String(index + 1).padStart(2, "0")}`;
  const innerWidth = CHIP_WIDTH - 2;
  const centered = label.length >= innerWidth
    ? label.slice(0, innerWidth)
    : `${" ".repeat(Math.floor((innerWidth - label.length) / 2))}${label}${" ".repeat(Math.ceil((innerWidth - label.length) / 2))}`;
  const pattern = fill.repeat(Math.ceil(innerWidth / fill.length)).slice(0, innerWidth);
  return [centered, pattern, pattern];
}

function createChip(parent: blessed.Widgets.Node, index: number): LayoutPart<Record<string, never>> {
  const fg = index % 8 === 0 || index % 8 === 3 ? "black" : "white";
  const bg = PALETTE[index % PALETTE.length] ?? "blue";
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    tags: false,
    border: { type: "line" },
    style: {
      fg,
      bg,
      border: { fg: bg, bg },
    },
    content: chipPattern(index).join("\n"),
  });
  return createNodePart(node, {
    restyle: () => {
      node.style = {
        fg,
        bg,
        border: { fg: bg, bg },
      } as any;
    },
  });
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Wrap Demo (Codex)",
    description: "Proving-ground row wrapping demo with coloured chips.",
    menu: [{ category: "demos", order: 145, label: "Flex Wrap Demo (Codex)" }],
    palette: { order: 245, label: "Flex Wrap Demo (Codex)" },
    action: () => {
      const win = host.createWindow({ title: "Flex Wrap Demo (Codex)", width: 80, height: 24 });

      const viewport = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: STATUS_HEIGHT,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        vi: true,
        scrollbar: {
          ch: " ",
          inverse: true,
          style: { bg: "cyan" },
          track: { bg: "gray" },
        },
        style: host.theme().body,
      });

      const content = blessed.box({
        parent: viewport,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        style: host.theme().body,
      });

      const status = blessed.box({
        parent: win.body,
        left: 0,
        right: 0,
        bottom: 0,
        height: STATUS_HEIGHT,
        style: host.theme().body,
      });

      const chips: FlexChild[] = Array.from({ length: CHIP_COUNT }, (_, index) => ({
        key: `chip-${index + 1}`,
        basis: CHIP_WIDTH,
        height: CHIP_HEIGHT,
        part: createChip(viewport, index),
      }));

      const wrapping = createWrappingRow(content, chips, { gap: CHIP_GAP });

      function render() {
        const viewportWidth = Math.max(1, Number(viewport.width) || 1);
        const viewportHeight = Math.max(1, Number(viewport.height) || 1);
        wrapping.setViewportHeight(viewportHeight);
        applyRect(content, { top: 0, left: 0, width: viewportWidth, height: 0 });
        wrapping.layout({ top: 0, left: 0, width: viewportWidth, height: viewportHeight });

        const metrics = wrapping.getMetrics();
        content.height = Math.max(viewportHeight, metrics.contentHeight);
        content.width = viewportWidth;
        status.setContent(
          `${metrics.totalChildren} chips  ${metrics.columnsInFirstRow} per row  ${metrics.viewportWidth}x${metrics.viewportHeight}` +
          (metrics.overflowY ? "  overflow-y" : "")
        );
        host.screen.render();
      }

      win.onResize(render);
      win.onRestyle(() => {
        viewport.style = host.theme().body;
        content.style = host.theme().body;
        status.style = host.theme().body;
        wrapping.restyle();
        host.screen.render();
      });
      win.onCleanup(() => {
        wrapping.destroy();
      });

      win.describeState(() => {
        const metrics = wrapping.getMetrics();
        return {
          summary: `Flex Wrap Demo — ${metrics.columnsInFirstRow} per row, ${metrics.rowsUsed} rows`,
          totalChildren: metrics.totalChildren,
          visibleChildren: metrics.visibleChildren,
          rowsUsed: metrics.rowsUsed,
          columnsInFirstRow: metrics.columnsInFirstRow,
          maxColumnsInAnyRow: metrics.maxColumnsInAnyRow,
          contentHeight: metrics.contentHeight,
          overflowY: metrics.overflowY,
        };
      });

      win.captureText(() => {
        const metrics = wrapping.getMetrics();
        return [
          `Flex Wrap Demo`,
          `${metrics.totalChildren} chips`,
          `${metrics.columnsInFirstRow} per row`,
          `${metrics.rowsUsed} rows`,
          metrics.overflowY ? "overflow-y" : "fits",
        ].join("\n");
      });

      viewport.key(["j", "down"], () => {
        viewport.scroll(1);
        host.screen.render();
      });
      viewport.key(["k", "up"], () => {
        viewport.scroll(-1);
        host.screen.render();
      });
      viewport.key(["g"], () => {
        viewport.setScroll(0);
        host.screen.render();
      });
      viewport.key(["G"], () => {
        viewport.setScrollPerc(100);
        host.screen.render();
      });

      render();
      win.focus();
    },
  });
}
