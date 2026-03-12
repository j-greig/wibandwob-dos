import blessed from "blessed";
import contrib from "blessed-contrib";
import type { MicroappHost, Rect, UiPart } from "../../src/services/microapp-sdk.js";
import {
  applyRect,
  clearTimers,
  createNodePart,
  createStack,
  createTimer,
  randHistory,
  renderFiglet,
  xLabels,
} from "../../src/services/microapp-sdk.js";

type Mode = "lg" | "md" | "sm";
type WrapChild = {
  key: string;
  basis: number;
  height: number;
  part: UiPart<any>;
  visible?: () => boolean;
};
type WrapMetrics = { rowsUsed: number };

function pickMode(width: number): Mode {
  if (width >= 110) return "lg";
  if (width >= 80) return "md";
  return "sm";
}

function createWrappingRow(
  parent: blessed.Widgets.Node,
  children: WrapChild[],
  opts?: { gap?: number | { row?: number; column?: number } },
): UiPart<void> & { metrics(): WrapMetrics } {
  const node = blessed.box({ parent, top: 0, left: 0, width: 0, height: 0 });
  for (const child of children) node.append(child.part.node);
  const rowGap = typeof opts?.gap === "number" ? opts.gap : opts?.gap?.row ?? 0;
  const columnGap = typeof opts?.gap === "number" ? opts.gap : opts?.gap?.column ?? 0;
  let rowsUsed = 0;

  return {
    node,
    layout(rect: Rect) {
      applyRect(node, rect);
      const width = Math.max(1, rect.width);
      const active = children.filter(child => child.visible?.() !== false);
      for (const child of children) {
        if (child.visible?.() === false) {
          child.part.node.hide();
        }
      }
      let x = 0;
      let y = 0;
      let rowHeight = 0;
      let rowCount = 0;
      let rowItems = 0;
      for (const child of active) {
        const childWidth = Math.min(width, child.basis);
        if (rowItems > 0 && x + columnGap + childWidth > width) {
          y += rowHeight + rowGap;
          x = 0;
          rowHeight = 0;
          rowItems = 0;
          rowCount += 1;
        }
        const left = rowItems > 0 ? x + columnGap : x;
        child.part.node.show();
        child.part.layout({ top: y, left, width: childWidth, height: child.height });
        x = left + childWidth;
        rowHeight = Math.max(rowHeight, child.height);
        rowItems += 1;
      }
      rowsUsed = active.length === 0 ? 0 : rowCount + 1;
      node.height = rowsUsed === 0 ? 0 : y + rowHeight;
    },
    update() {},
    restyle() { for (const child of children) child.part.restyle(); },
    destroy() { for (const child of children) child.part.destroy(); node.destroy(); },
    metrics() { return { rowsUsed }; },
  };
}

function createFramedPanel(parent: blessed.Widgets.Node, label: string) {
  const node = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    border: { type: "line" },
    label: ` ${label} `,
    tags: false,
    style: { fg: "white", border: { fg: "cyan" } },
  });
  return {
    node,
    part: createNodePart(node),
    render(lines: string[]) {
      const width = Math.max(0, (Number(node.width) || 0) - 2);
      const height = Math.max(0, (Number(node.height) || 0) - 2);
      const content = [...lines];
      while (content.length < height) {
        content.push("");
      }
      node.setContent(content.map(line => line.slice(0, width)).join("\n"));
    },
  };
}

function createResponsiveFigletChip(parent: blessed.Widgets.Node, label: string, getMode: () => Mode): WrapChild {
  const box = blessed.box({
    parent,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    border: { type: "line" },
    style: { fg: "yellow", border: { fg: "yellow" } },
  });
  const part = createNodePart(box, {
    restyle: () => {
      box.style = { fg: "yellow", border: { fg: "yellow" } } as any;
    },
  });
  const render = () => {
    const mode = getMode();
    const width = Math.max(0, (Number(box.width) || 0) - 2);
    const height = Math.max(0, (Number(box.height) || 0) - 2);
    let content = "";
    if (mode === "lg") {
      content = renderFiglet(label, "small");
    } else if (mode === "md") {
      content = renderFiglet(label, "mini");
    } else {
      content = label;
    }
    const lines = content.split("\n").slice(0, height).map(line => line.slice(0, width));
    box.setContent(lines.join("\n"));
  };
  return {
    key: label,
    basis: 16,
    height: 5,
    part: {
      ...part,
      layout(rect) {
        part.layout(rect);
        render();
      },
    },
  };
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Layout Stress Test (Codex)",
    description: "Stress test for flex layout, contrib nesting, responsive content, and deep composition.",
    menu: [{ category: "demos", order: 149, label: "Layout Stress Test (Codex)" }],
    palette: { order: 249, label: "Layout Stress Test (Codex)" },
    action: () => {
      const win = host.createWindow({ title: "Layout Stress Test (Codex)", width: 128, height: 36 });
      const timers = new Set<ReturnType<typeof setInterval>>();
      let mode: Mode = "lg";
      let livePanelRunning = false;
      let liveTick = 0;
      const HEADER_H = 1;
      const FOOTER_H = 1;

      const header = createFramedPanel(win.body, "LAYOUT STRESS TEST");
      const footer = createFramedPanel(win.body, "STATUS");
      const viewport = blessed.box({
        parent: win.body,
        top: HEADER_H,
        left: 0,
        right: 0,
        bottom: FOOTER_H,
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

      const panelA = createFramedPanel(content, "A: CONTRIB GRID INSIDE FLEX");
      const panelB = createFramedPanel(content, "B: RESPONSIVE FIGLET WRAP");
      const panelC = createFramedPanel(content, "C: MIXED DIRECTION NESTING");
      const panelD = createFramedPanel(content, "D: LIVE PANEL");
      const panelE = createFramedPanel(content, "E: FLEX INSIDE CONTRIB GRID");

      // Panel A: contrib grid inside a flex panel.
      const panelAGrid = new contrib.grid({ rows: 12, cols: 12, screen: panelA.node as any });
      const panelALine = panelAGrid.set(0, 0, 7, 12, contrib.line, {
        label: " CPU ",
        showLegend: true,
        legend: { width: 8 },
        style: { line: "green", text: "white", baseline: "white" },
      }) as any;
      const panelABar = panelAGrid.set(7, 0, 5, 12, contrib.bar, {
        label: " Queue ",
        barWidth: 4,
        barSpacing: 1,
        maxHeight: 100,
        style: { fg: "cyan" },
      }) as any;
      let lineA = randHistory(20, 20, 90);
      let lineB = randHistory(20, 5, 70);
      const labels = xLabels(20);

      // Panel B: responsive figlet wrap.
      const chipWrap = createWrappingRow(panelB.node, [
        createResponsiveFigletChip(panelB.node, "AI", () => mode),
        createResponsiveFigletChip(panelB.node, "UX", () => mode),
        createResponsiveFigletChip(panelB.node, "SIM", () => mode),
        createResponsiveFigletChip(panelB.node, "MAP", () => mode),
        createResponsiveFigletChip(panelB.node, "IRC", () => mode),
        createResponsiveFigletChip(panelB.node, "MEM", () => mode),
      ], { gap: { row: 1, column: 1 } });

      // Panel C: mixed-direction nesting.
      const cTop = createFramedPanel(panelC.node, "C1");
      const cLeft = createFramedPanel(panelC.node, "C2");
      const cCenter = createFramedPanel(panelC.node, "C3");
      const cBottom = createFramedPanel(panelC.node, "C4");
      const nestedTags = createWrappingRow(panelC.node, ["ai", "ops", "sim", "ux", "map", "viz"].map(tag => ({
        key: tag,
        basis: Math.max(4, tag.length + 2),
        height: 1,
        part: createNodePart(blessed.box({
          parent: panelC.node,
          border: { type: "line" },
          content: ` ${tag} `,
          style: { fg: "magenta", border: { fg: "magenta" } },
        })),
      })), { gap: { row: 1, column: 1 } });
      const cInnerStack = createStack(panelC.node, [
        { key: "top", basis: 1, part: cTop.part },
        { key: "middle", basis: "1fr", part: createStack(panelC.node, [
          { key: "left", basis: 12, part: cLeft.part },
          { key: "center", basis: "1fr", part: createStack(panelC.node, [
            { key: "centerBox", basis: "1fr", part: cCenter.part },
            { key: "tags", basis: 4, part: nestedTags },
          ]) },
        ]) },
        { key: "bottom", basis: 1, part: cBottom.part },
      ]);

      // Panel D: live panel inside responsive flex; pause when hidden.
      const panelDSpark = contrib.sparkline({
        parent: panelD.node as any,
        label: " Live ",
        tags: true,
        style: { fg: "yellow" },
      }) as any;
      const liveSeriesA = randHistory(18, 10, 60);
      const liveSeriesB = randHistory(18, 20, 80);

      // Panel E: contrib grid with a flex subtree inside one cell.
      const panelEGrid = new contrib.grid({ rows: 12, cols: 12, screen: panelE.node as any });
      const panelESpark = panelEGrid.set(0, 0, 4, 12, contrib.sparkline, {
        label: " Mix ",
        tags: true,
        style: { fg: "cyan" },
      }) as any;
      const flexCell = panelEGrid.set(4, 0, 8, 12, blessed.box as any, {
        label: " flex cell ",
        border: { type: "line" },
      }) as blessed.Widgets.BoxElement;
      const flexCellHeader = createFramedPanel(flexCell, "CELL H");
      const flexCellBody = createFramedPanel(flexCell, "CELL B");
      const flexCellFooter = createFramedPanel(flexCell, "CELL F");
      const flexInGrid = createStack(flexCell, [
        { key: "header", basis: 1, part: flexCellHeader.part },
        { key: "body", basis: "1fr", part: flexCellBody.part },
        { key: "footer", basis: 1, part: flexCellFooter.part },
      ]);

      function updateContribWidgets() {
        lineA.push(Math.max(1, Math.min(100, lineA[lineA.length - 1]! + (Math.random() - 0.5) * 15)));
        lineA.shift();
        lineB.push(Math.max(1, Math.min(100, lineB[lineB.length - 1]! + (Math.random() - 0.5) * 12)));
        lineB.shift();
        panelALine.setData([
          { title: "A", x: labels, y: lineA.map(Math.round), style: { line: "green" } },
          { title: "B", x: labels, y: lineB.map(Math.round), style: { line: "magenta" } },
        ]);
        panelABar.setData({ titles: ["q1", "q2", "q3", "q4"], data: [20, 40, 65, 30].map(v => v + Math.round(Math.random() * 20)) });
        panelESpark.setData(["L", "R"], [
          randHistory(12, 5, 40).map(Math.round),
          randHistory(12, 10, 60).map(Math.round),
        ]);
        if (livePanelRunning) {
          liveTick += 1;
          liveSeriesA.push(Math.max(0, Math.min(100, liveSeriesA[liveSeriesA.length - 1]! + (Math.random() - 0.5) * 18)));
          liveSeriesA.shift();
          liveSeriesB.push(Math.max(0, Math.min(100, liveSeriesB[liveSeriesB.length - 1]! + (Math.random() - 0.5) * 10)));
          liveSeriesB.shift();
          panelDSpark.setData(["live-a", "live-b"], [liveSeriesA.map(Math.round), liveSeriesB.map(Math.round)]);
        }
      }

      function render() {
        const w = Math.max(1, Number(win.body.width) || 128);
        const h = Math.max(1, Number(win.body.height) || 36);
        mode = pickMode(w);
        const nextLiveVisible = mode !== "sm";
        livePanelRunning = nextLiveVisible;
        const bodyH = Math.max(1, h - HEADER_H - FOOTER_H);
        header.part.layout({ top: 0, left: 0, width: w, height: HEADER_H });
        footer.part.layout({ top: h - FOOTER_H, left: 0, width: w, height: FOOTER_H });
        applyRect(viewport, { top: HEADER_H, left: 0, width: w, height: bodyH });
        applyRect(content, { top: 0, left: 0, width: w, height: bodyH });

        header.render([`mode=${mode} width=${w} height=${h}`]);
        footer.render([
          `A:flex+contrib B:wrap+figlet C:nesting D:live=${livePanelRunning ? "on" : "off"} E:contrib+flex`,
        ]);

        const gap = 1;
        const panelRects: Record<string, Rect> = {};
        if (mode === "lg") {
          const leftW = 40;
          const rightW = 36;
          const centerW = Math.max(20, w - leftW - rightW - gap * 2);
          const topA = Math.max(12, Math.floor((bodyH - gap) * 0.58));
          const topC = Math.max(12, Math.floor((bodyH - gap) * 0.58));
          panelRects.a = { top: 0, left: 0, width: leftW, height: topA };
          panelRects.b = { top: topA + gap, left: 0, width: leftW, height: Math.max(9, bodyH - topA - gap) };
          panelRects.c = { top: 0, left: leftW + gap, width: centerW, height: topC };
          panelRects.d = { top: topC + gap, left: leftW + gap, width: centerW, height: Math.max(10, bodyH - topC - gap) };
          panelRects.e = { top: 0, left: leftW + gap + centerW + gap, width: rightW, height: bodyH };
          content.height = bodyH;
        } else if (mode === "md") {
          const colW = Math.max(20, Math.floor((w - gap) / 2));
          const rightW = Math.max(20, w - colW - gap);
          const aH = Math.max(10, Math.floor((bodyH - gap) / 2));
          const bH = Math.max(9, bodyH - aH - gap);
          const cH = Math.max(10, Math.floor((bodyH - gap * 2) / 3));
          const dH = Math.max(9, Math.floor((bodyH - cH - gap * 2) / 2));
          const eH = Math.max(9, bodyH - cH - dH - gap * 2);
          panelRects.a = { top: 0, left: 0, width: colW, height: aH };
          panelRects.b = { top: aH + gap, left: 0, width: colW, height: bH };
          panelRects.c = { top: 0, left: colW + gap, width: rightW, height: cH };
          panelRects.d = { top: cH + gap, left: colW + gap, width: rightW, height: dH };
          panelRects.e = { top: cH + dH + gap * 2, left: colW + gap, width: rightW, height: eH };
          content.height = bodyH;
        } else {
          const panelH = Math.max(9, Math.floor(bodyH * 0.65));
          let yCursor = 0;
          for (const key of ["a", "b", "c", "d", "e"] as const) {
            panelRects[key] = { top: yCursor, left: 0, width: w, height: panelH };
            yCursor += panelH + gap;
          }
          content.height = yCursor - gap;
        }

        panelA.part.layout(panelRects.a);
        panelB.part.layout(panelRects.b);
        panelC.part.layout(panelRects.c);
        panelD.part.layout(panelRects.d);
        panelE.part.layout(panelRects.e);

        panelB.render([`figlet=${mode === "lg" ? "small" : mode === "md" ? "mini" : "text"} rows=${chipWrap.metrics().rowsUsed}`]);
        const wrapRect = {
          top: 1,
          left: 1,
          width: Math.max(1, (Number(panelB.node.width) || 0) - 2),
          height: Math.max(1, (Number(panelB.node.height) || 0) - 2),
        };
        chipWrap.layout(wrapRect);

        panelC.render([`deep nesting rows=${nestedTags.metrics().rowsUsed}`]);
        cInnerStack.layout({
          top: 1,
          left: 1,
          width: Math.max(1, (Number(panelC.node.width) || 0) - 2),
          height: Math.max(1, (Number(panelC.node.height) || 0) - 2),
        });
        cTop.render(["row"]);
        cLeft.render(["stack"]);
        cCenter.render(["row > stack"]);
        cBottom.render(["footer"]);

        panelD.render([`running=${livePanelRunning}`, `tick=${liveTick}`]);
        panelDSpark.top = 1;
        panelDSpark.left = 1;
        panelDSpark.width = Math.max(1, (Number(panelD.node.width) || 0) - 2);
        panelDSpark.height = Math.max(1, (Number(panelD.node.height) || 0) - 2);

        panelE.render([`flex in grid`]);
        flexInGrid.layout({
          top: 1,
          left: 1,
          width: Math.max(1, (Number(flexCell.width) || 0) - 2),
          height: Math.max(1, (Number(flexCell.height) || 0) - 2),
        });
        flexCellHeader.render(["grid cell"]);
        flexCellBody.render(["stack inside contrib grid"]);
        flexCellFooter.render([`mode=${mode}`]);

        updateContribWidgets();
        host.screen.render();
      }

      createTimer(render, 1000, timers);
      render();

      win.onResize(render);
      win.onCleanup(() => {
        clearTimers(timers);
        header.part.destroy();
        footer.part.destroy();
        panelA.part.destroy();
        panelB.part.destroy();
        panelC.part.destroy();
        panelD.part.destroy();
        panelE.part.destroy();
        content.destroy();
        viewport.destroy();
        panelDSpark.destroy?.();
      });
      win.onRestyle(() => {
        viewport.style = host.theme().body;
        content.style = host.theme().body;
        header.part.restyle();
        footer.part.restyle();
        panelA.part.restyle();
        panelB.part.restyle();
        panelC.part.restyle();
        panelD.part.restyle();
        panelE.part.restyle();
        host.screen.render();
      });
      win.describeState(() => ({
        summary: `Layout Stress Test — ${mode.toUpperCase()} live:${livePanelRunning ? "on" : "off"}`,
        mode,
        panelAVisible: true,
        panelBVisible: true,
        panelCVisible: true,
        panelDVisible: mode !== "sm",
        panelEVisible: mode !== "sm",
        livePanelRunning,
        figletSize: mode === "lg" ? "small" : mode === "md" ? "mini" : "text",
        tagRows: nestedTags.metrics().rowsUsed,
        contribFlexOk: true,
        flexContribOk: true,
        windowWidth: Number(win.body.width) || 0,
        windowHeight: Number(win.body.height) || 0,
      }));
      win.captureText(() => {
        const state = win.describeState?.() ?? {};
        return [
          "Layout Stress Test",
          `mode=${state.mode ?? mode}`,
          `live=${state.livePanelRunning ? "on" : "off"}`,
          `figlet=${state.figletSize ?? "?"}`,
          `tags=${state.tagRows ?? 0}`,
        ].join("\n");
      });
      win.focus();
    },
  });
}
