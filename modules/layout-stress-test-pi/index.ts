/**
 * Layout Stress Test (Pi/Claude version)
 *
 * Five panels in one module, each proving a different hard layout problem:
 *   A: Contrib grid inside flex (interop)
 *   B: Responsive figlet chips (content that adapts to breakpoint)
 *   C: Responsive ASCII art (3 sizes of the same art)
 *   D: 4-level mixed direction nesting with wrapped tags
 *   E: Live animated chart in responsive flex (lifecycle)
 *
 * In sm mode panels stack vertically and overflow into a scrollable
 * viewport with a theme-consistent scrollbar that only appears when
 * content exceeds the viewport height.
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import type { MicroappHost, Rect, UiPart } from "../../src/services/microapp-sdk.js";
import {
  applyRect,
  clearTimers,
  createNodePart,
  createStack,
  createColumns,
  createTimer,
  randHistory,
  renderFiglet,
  xLabels,
} from "../../src/services/microapp-sdk.js";
import { createScrollbar, scrollableStyle } from "../../src/core/ui-primitives.js";

// ── Types ────────────────────────────────────────────────────────────────

type Mode = "lg" | "md" | "sm";

function pickMode(w: number): Mode {
  if (w >= 100) return "lg";
  if (w >= 60) return "md";
  return "sm";
}

// ── Helpers ──────────────────────────────────────────────────────────────

function panel(parent: blessed.Widgets.Node, label: string, borderFg = "cyan") {
  const node = blessed.box({
    parent, top: 0, left: 0, width: 0, height: 0,
    border: { type: "line" }, label: ` ${label} `, tags: false,
    style: { fg: "white", border: { fg: borderFg } },
  });
  const part = createNodePart(node);
  return {
    node, part,
    paint(text: string) {
      const w = Math.max(0, (Number(node.width) || 0) - 2);
      const h = Math.max(0, (Number(node.height) || 0) - 2);
      const lines = text.split("\n").slice(0, h).map(l => l.slice(0, w));
      node.setContent(lines.join("\n"));
    },
    innerW() { return Math.max(1, (Number(node.width) || 0) - 2); },
    innerH() { return Math.max(1, (Number(node.height) || 0) - 2); },
  };
}

function layoutWrapRow(
  tags: blessed.Widgets.BoxElement[],
  containerW: number,
  itemW: number,
  itemH: number,
  gap: number,
): number {
  let x = 0, y = 0, cols = 0, rows = 0;
  for (const tag of tags) {
    const cw = Math.min(itemW, containerW);
    if (cols > 0 && x + gap + cw > containerW) {
      y += itemH; x = 0; cols = 0; rows++;
    }
    const left = cols > 0 ? x + gap : x;
    applyRect(tag, { top: y, left, width: cw, height: itemH });
    x = left + cw;
    cols++;
  }
  if (cols > 0) rows++;
  return rows;
}

// ── Responsive ASCII art ─────────────────────────────────────────────────

const ART_LG = [
  "    /\\_/\\    ",
  "   ( o.o )   ",
  "    > ^ <    ",
  "   /|   |\\   ",
  "  (_|   |_)  ",
  "     ===     ",
  "   SCRAMBLE  ",
  "    meow!    ",
].join("\n");

const ART_MD = [
  "  /\\_/\\  ",
  " ( o.o ) ",
  "  > ^ <  ",
  " SCRAMBLE",
].join("\n");

const ART_SM = [
  "/\\_/\\",
  "(o.o)",
  " ^ ^ ",
].join("\n");

// ── Tags ─────────────────────────────────────────────────────────────────

const TAG_LABELS_D = ["ai", "ux", "sim", "map", "net", "gfx"];

// ── Module ───────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Layout Stress Test (Pi)",
    description: "Five stress test panels: contrib interop, responsive figlet/art, nesting, live chart",
    action: () => {
      const win = host.createWindow({ title: "Layout Stress Test (Pi)", width: 120, height: 35 });
      const timers = new Set<ReturnType<typeof setInterval>>();
      let mode: Mode = "lg";
      let liveRunning = false;
      let liveTick = 0;

      // ── Header / Footer (direct children of win.body) ──────────
      const headerBox = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 1,
        style: { fg: "white", bg: "blue" },
      });
      const footerBox = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 1,
        style: { fg: "white", bg: "blue" },
      });

      // ── Scrollable viewport (between header and footer) ────────
      const viewport = blessed.box({
        parent: win.body,
        top: 1, left: 0, right: 0, bottom: 1,
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        keys: true,
        vi: true,
        scrollbar: createScrollbar(),
        style: scrollableStyle(host.theme().body),
      });
      const content = blessed.box({
        parent: viewport,
        top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
      });

      // ── Panel A: Contrib grid inside flex ──────────────────────
      const panelA = panel(content, "A: CONTRIB + FLEX", "green");
      const flexSide = panel(content, "Flex Side", "green");

      const panelARow = createColumns(content, [
        { key: "contrib", basis: "1fr", part: panelA.part },
        { key: "flex-side", basis: 20, part: flexSide.part },
      ]);

      const contribGrid = new contrib.grid({ rows: 12, cols: 12, screen: panelA.node as any });
      const lineChart = contribGrid.set(0, 0, 8, 12, contrib.line, {
        label: " CPU ", showLegend: true, legend: { width: 6 },
        style: { line: "green", text: "white", baseline: "white" },
      }) as any;
      const barChart = contribGrid.set(8, 0, 4, 12, contrib.bar, {
        label: " Queue ", barWidth: 3, barSpacing: 1, maxHeight: 100,
        style: { fg: "cyan" },
      }) as any;

      let seriesA = randHistory(20, 20, 90);
      let seriesB = randHistory(20, 5, 70);
      const chartLabels = xLabels(20);

      // ── Panel B: Responsive figlet chips ───────────────────────
      const panelB = panel(content, "B: RESPONSIVE FIGLET", "yellow");
      const FIGLET_WORDS = ["WIB", "WOB", "DOS", "CAT"];
      const figletContainer = blessed.box({
        parent: panelB.node, top: 1, left: 1, width: 0, height: 0,
      });
      const figletChips = FIGLET_WORDS.map((word, i) => {
        const chipNode = blessed.box({
          parent: figletContainer, top: 0, left: 0, width: 0, height: 0,
          border: { type: "line" },
          style: { fg: "yellow", border: { fg: ["yellow","magenta","cyan","green"][i % 4] } },
        });
        return { word, node: chipNode };
      });
      let figletFont = "small";
      let figletRows = 0;

      // ── Panel C: Responsive art ────────────────────────────────
      const panelC = panel(content, "C: RESPONSIVE ART", "magenta");
      let artSize: "lg" | "md" | "sm" = "lg";

      // ── Panel D: Mixed direction nesting ───────────────────────
      const panelD = panel(content, "D: 4-LEVEL NESTING", "blue");
      const d1 = panel(panelD.node, "Row>", "blue");
      const d2 = panel(panelD.node, "Stack>", "blue");
      const d3 = panel(panelD.node, "Row>", "blue");
      const d4 = panel(panelD.node, "Stack", "blue");

      const tagContainer = blessed.box({
        parent: panelD.node, top: 0, left: 0, width: 0, height: 0,
      });
      const tagNodes = TAG_LABELS_D.map((label, i) => {
        return blessed.box({
          parent: tagContainer, top: 0, left: 0, width: 6, height: 1,
          content: ` ${label} `,
          style: { fg: "white", bg: ["blue","green","cyan","red","magenta","yellow"][i % 6] },
        });
      });
      const tagPart = createNodePart(tagContainer);

      const level4 = createStack(panelD.node, [
        { key: "d4", basis: "1fr", part: d4.part },
        { key: "tags", basis: 3, part: tagPart },
      ]);
      const level3 = createColumns(panelD.node, [
        { key: "d3", basis: 12, part: d3.part },
        { key: "level4", basis: "1fr", part: level4 },
      ]);
      const level2 = createStack(panelD.node, [
        { key: "d2", basis: 3, part: d2.part },
        { key: "level3", basis: "1fr", part: level3 },
      ]);
      const level1 = createColumns(panelD.node, [
        { key: "d1", basis: 10, part: d1.part },
        { key: "level2", basis: "1fr", part: level2 },
      ]);

      let tagRowsD = 0;

      // ── Panel E: Live chart in responsive flex ─────────────────
      const panelE = panel(content, "E: LIVE CHART", "red");
      const sparkline = contrib.sparkline({
        parent: panelE.node as any,
        label: " Spark ",
        tags: true,
        style: { fg: "yellow" },
      }) as any;
      const liveA = randHistory(18, 10, 60);
      const liveB = randHistory(18, 20, 80);

      // ── Layout ─────────────────────────────────────────────────

      function positionPanels(w: number, h: number) {
        const bodyH = Math.max(1, h - 2); // minus header + footer
        const gap = 1;

        applyRect(headerBox, { top: 0, left: 0, width: w, height: 1 });
        applyRect(footerBox, { top: h - 1, left: 0, width: w, height: 1 });
        applyRect(viewport, { top: 1, left: 0, width: w, height: bodyH });

        let totalContentH = bodyH; // default: content fits viewport

        if (mode === "lg") {
          applyRect(content, { top: 0, left: 0, width: w, height: bodyH });
          const col1W = Math.max(20, Math.floor(w * 0.38));
          const col3W = Math.max(16, Math.floor(w * 0.22));
          const col2W = Math.max(20, w - col1W - col3W - gap * 2);
          const topH = Math.max(8, Math.floor(bodyH * 0.55));
          const botH = Math.max(6, bodyH - topH - gap);

          panelARow.layout({ top: 0, left: 0, width: col1W, height: topH });
          applyRect(panelB.node, { top: topH + gap, left: 0, width: col1W, height: botH });
          applyRect(panelC.node, { top: 0, left: col1W + gap, width: col2W, height: topH });
          applyRect(panelD.node, { top: topH + gap, left: col1W + gap, width: col2W, height: botH });
          applyRect(panelE.node, { top: 0, left: col1W + gap + col2W + gap, width: col3W, height: bodyH });
          totalContentH = bodyH;
        } else if (mode === "md") {
          applyRect(content, { top: 0, left: 0, width: w, height: bodyH });
          const colW = Math.max(20, Math.floor((w - gap) / 2));
          const rightW = Math.max(20, w - colW - gap);
          const rowH = Math.max(8, Math.floor((bodyH - gap * 2) / 3));

          panelARow.layout({ top: 0, left: 0, width: colW, height: rowH });
          applyRect(panelB.node, { top: rowH + gap, left: 0, width: colW, height: rowH });
          applyRect(panelE.node, { top: (rowH + gap) * 2, left: 0, width: colW, height: Math.max(6, bodyH - (rowH + gap) * 2) });
          applyRect(panelC.node, { top: 0, left: colW + gap, width: rightW, height: rowH });
          applyRect(panelD.node, { top: rowH + gap, left: colW + gap, width: rightW, height: bodyH - rowH - gap });
          totalContentH = bodyH;
        } else {
          // sm: single column, stacked, scrollable
          const pH = Math.max(10, 12);
          let y = 0;
          panelARow.layout({ top: y, left: 0, width: w, height: pH });
          y += pH + gap;
          applyRect(panelB.node, { top: y, left: 0, width: w, height: pH });
          y += pH + gap;
          applyRect(panelC.node, { top: y, left: 0, width: w, height: pH });
          y += pH + gap;
          applyRect(panelD.node, { top: y, left: 0, width: w, height: pH });
          y += pH + gap;
          applyRect(panelE.node, { top: y, left: 0, width: w, height: pH });
          y += pH;
          totalContentH = y;
          applyRect(content, { top: 0, left: 0, width: w, height: totalContentH });
        }

        // Scrollbar: show only when content overflows
        const overflows = totalContentH > bodyH;
        const bodyStyle = host.theme().body;
        if (overflows) {
          viewport.style = scrollableStyle(bodyStyle) as any;
        } else {
          viewport.style = { ...bodyStyle, scrollbar: { bg: bodyStyle.bg }, track: { bg: bodyStyle.bg } } as any;
        }
        content.height = totalContentH;
      }

      function updateCharts() {
        seriesA.push(Math.max(1, Math.min(100, seriesA[seriesA.length - 1]! + (Math.random() - 0.5) * 15)));
        seriesA.shift();
        seriesB.push(Math.max(1, Math.min(100, seriesB[seriesB.length - 1]! + (Math.random() - 0.5) * 12)));
        seriesB.shift();
        lineChart.setData([
          { title: "A", x: chartLabels, y: seriesA.map(Math.round), style: { line: "green" } },
          { title: "B", x: chartLabels, y: seriesB.map(Math.round), style: { line: "magenta" } },
        ]);
        barChart.setData({
          titles: ["q1", "q2", "q3", "q4"],
          data: [20, 40, 65, 30].map(v => v + Math.round(Math.random() * 20)),
        });

        if (liveRunning) {
          liveTick++;
          liveA.push(Math.max(0, Math.min(100, liveA[liveA.length - 1]! + (Math.random() - 0.5) * 18)));
          liveA.shift();
          liveB.push(Math.max(0, Math.min(100, liveB[liveB.length - 1]! + (Math.random() - 0.5) * 10)));
          liveB.shift();
          sparkline.setData(["a", "b"], [liveA.map(Math.round), liveB.map(Math.round)]);
        }
      }

      function render() {
        const w = Math.max(1, Number(win.body.width) || 120);
        const h = Math.max(1, Number(win.body.height) || 35);
        mode = pickMode(w);
        liveRunning = mode !== "sm";

        positionPanels(w, h);

        // Header / footer
        headerBox.setContent(` LAYOUT STRESS TEST  ${mode.toUpperCase()}  ${w}x${h}`);
        footerBox.setContent(
          ` A:contrib B:figlet C:art(${artSize}) D:nest E:live=${liveRunning ? "on" : "off"} tick=${liveTick}`
        );

        // Panel A: flex side label
        flexSide.paint(`Flex\nSide\n${Number(flexSide.node.width)||0}x${Number(flexSide.node.height)||0}`);

        // Panel B: responsive figlet
        figletFont = mode === "lg" ? "small" : mode === "md" ? "mini" : "text";
        const bW = panelB.innerW();
        const bH = panelB.innerH();
        applyRect(figletContainer, { top: 1, left: 1, width: bW, height: bH });
        const chipW = mode === "lg" ? 18 : mode === "md" ? 12 : 8;
        const chipH = mode === "lg" ? 5 : mode === "md" ? 3 : 1;
        let fx = 0, fy = 0, fCols = 0;
        figletRows = 0;
        for (const chip of figletChips) {
          const cw = Math.min(chipW, bW);
          if (fCols > 0 && fx + 1 + cw > bW) {
            fy += chipH; fx = 0; fCols = 0; figletRows++;
          }
          const left = fCols > 0 ? fx + 1 : fx;
          applyRect(chip.node, { top: fy, left, width: cw, height: chipH });
          if (figletFont === "text") {
            chip.node.setContent(chip.word);
          } else {
            const fig = renderFiglet(chip.word, figletFont, cw - 2);
            const lines = fig.split("\n").slice(0, Math.max(1, chipH - 2));
            chip.node.setContent(lines.join("\n"));
          }
          fx = left + cw;
          fCols++;
        }
        if (fCols > 0) figletRows++;

        // Panel C: responsive art
        const cW = panelC.innerW();
        if (cW >= 14) { artSize = "lg"; panelC.paint(ART_LG); }
        else if (cW >= 10) { artSize = "md"; panelC.paint(ART_MD); }
        else { artSize = "sm"; panelC.paint(ART_SM); }

        // Panel D: nested layout
        const dW = panelD.innerW();
        const dH = panelD.innerH();
        level1.layout({ top: 1, left: 1, width: dW, height: dH });
        d1.paint("L1\nRow");
        d2.paint("L2 Stack");
        d3.paint("L3\nRow");
        d4.paint("L4 Stack");
        tagRowsD = layoutWrapRow(tagNodes, Math.max(1, Number(tagContainer.width) || 1), 6, 1, 1);

        // Panel E: sparkline positioning
        sparkline.top = 1;
        sparkline.left = 1;
        sparkline.width = Math.max(1, panelE.innerW());
        sparkline.height = Math.max(1, panelE.innerH());

        updateCharts();
        host.screen.render();
      }

      createTimer(render, 1000, timers);
      render();

      win.onResize(render);
      win.onCleanup(() => {
        clearTimers(timers);
        for (const chip of figletChips) chip.node.destroy();
        for (const tag of tagNodes) tag.destroy();
        level1.destroy();
        panelARow.destroy();
        panelB.part.destroy();
        panelC.part.destroy();
        panelD.part.destroy();
        panelE.part.destroy();
        headerBox.destroy();
        footerBox.destroy();
        content.destroy();
        viewport.destroy();
        sparkline.destroy?.();
      });
      win.onRestyle(() => {
        content.style = host.theme().body;
        render();
      });

      win.describeState(() => ({
        summary: `Stress Test: ${mode} live:${liveRunning ? "on" : "off"} art:${artSize} figlet:${figletFont} tags:${tagRowsD}rows`,
        mode,
        liveRunning,
        liveTick,
        artSize,
        figletFont,
        figletRows,
        tagRows: tagRowsD,
        contribGridWidth: Number(panelA.node.width) || 0,
        flexSideWidth: Number(flexSide.node.width) || 0,
        sparklineVisible: liveRunning,
        windowWidth: Number(win.body.width) || 0,
        windowHeight: Number(win.body.height) || 0,
      }));

      win.captureText(() =>
        `Layout Stress Test — ${mode} live:${liveRunning ? "on" : "off"} art:${artSize} figlet:${figletFont}`
      );

      win.focus();
    },
    menu: [{ category: "demos", order: 96, label: "Layout Stress Test (Pi)" }],
    palette: { order: 296, label: "Layout Stress Test (Pi)" },
  });
}
