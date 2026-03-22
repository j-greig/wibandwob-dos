// eslint-disable-next-line no-restricted-imports
import type blessed from "blessed"; // blessed required: LayoutPart widget creation
import type { LayoutReport, MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createGrid,
  createLayoutReporter,
  createNodePart,
  createCanvas,
  createRow,
  createStack,
  pickBreakpoint,
} from "../../src/services/microapp-sdk.js";

type LayoutMode = "xs" | "sm" | "md" | "lg" | "xl";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Layout Probe",
    description: "Open a layout-heavy SDK proof microapp.",
    menu: [{ category: "applications", order: 170, label: "Layout Probe" }],
    palette: { order: 170, label: "Layout Probe" },
    action: () => openLayoutProbe(host),
  });
}

function openLayoutProbe(host: MicroappHost) {
  const win = host.createWindow({
    title: "Layout Probe",
    width: 118,
    height: 34,
    left: 10,
    top: 5,
  });

  let mode: LayoutMode = "lg";
  let report: LayoutReport | undefined;

  const headerBox = createCanvas(win.body).element;
  const railBox = createCanvas(win.body).element;
  const heroBox = createCanvas(win.body).element;
  const statsBox = createCanvas(win.body).element;
  const logBox = createCanvas(win.body).element;
  const reportBox = createCanvas(win.body).element;
  const footerBox = createCanvas(win.body).element;

  const headerPart = createNodePart(headerBox);
  const railPart = createNodePart(railBox);
  const footerPart = createNodePart(footerBox);

  const dashboardGrid = createGrid(win.body, {
    rows: 2,
    columns: 2,
    templateRows: [8, "1fr"],
    templateColumns: ["1fr", "1fr"],
    gap: { row: 1, column: 1 },
  });
  dashboardGrid.set({ key: "hero", row: 0, column: 0, part: createNodePart(heroBox) });
  dashboardGrid.set({ key: "stats", row: 0, column: 1, part: createNodePart(statsBox) });
  dashboardGrid.set({ key: "log", row: 1, column: 0, part: createNodePart(logBox) });
  dashboardGrid.set({ key: "report", row: 1, column: 1, part: createNodePart(reportBox) });

  const bodyRow = createRow(win.body, [
    { key: "rail", basis: 24, part: railPart, visible: () => mode !== "xs" },
    { key: "grid", basis: "1fr", part: dashboardGrid },
  ]);

  const root = createStack(win.body, [
    { key: "header", basis: 4, part: headerPart },
    { key: "body", basis: "1fr", part: bodyRow },
    { key: "footer", basis: 2, part: footerPart },
  ]);

  const reporter = createLayoutReporter({
    header: headerBox,
    rail: railBox,
    hero: heroBox,
    stats: statsBox,
    log: logBox,
    report: reportBox,
    footer: footerBox,
  });

  function renderRegionContent() {
    headerBox.setContent([
      "{bold}Layout Probe{/bold}",
      `breakpoint ${mode} · viewport ${Number(win.body.width) || 0}x${Number(win.body.height) || 0}`,
      "proves createStack + createRow + createGrid + layout reporting",
    ].join("\n"));

    railBox.setContent([
      "{underline}Rail{/underline}",
      "",
      "This region disappears on xs.",
      "",
      "Use it to prove:",
      "  - region visibility",
      "  - reflow before crush",
      "  - layout report fidelity",
    ].join("\n"));

    heroBox.setContent([
      "{underline}Hero{/underline}",
      "",
      "Layout-heavy proof microapp.",
      "It exists to make region geometry explicit to agents.",
    ].join("\n"));

    statsBox.setContent([
      "{underline}Stats{/underline}",
      "",
      `mode        ${mode}`,
      `rail        ${mode === "xs" ? "hidden" : "visible"}`,
      `screen      ${host.geometry.width}x${host.geometry.height}`,
      `window      ${Number(win.body.width) || 0}x${Number(win.body.height) || 0}`,
    ].join("\n"));

    logBox.setContent([
      "{underline}Operator Notes{/underline}",
      "",
      "Resize the window or the terminal.",
      "The layout report should explain what moved.",
      "",
      "This is meant for agents and humans debugging layout semantics,",
      "not for decorative UI polish.",
    ].join("\n"));

    const regionSummary = report
      ? Object.entries(report.regions)
          .map(([name, snapshot]) =>
            `${name.padEnd(7)} ${snapshot.visible ? "vis" : "hid"} ${snapshot.rect.width}x${snapshot.rect.height}@${snapshot.rect.left},${snapshot.rect.top}`)
          .join("\n")
      : "report pending";
    reportBox.setContent([
      "{underline}Layout Report{/underline}",
      "",
      regionSummary,
    ].join("\n"));

    footerBox.setContent("q close · resize the window to watch the layout report change");
  }

  function render() {
    const width = Math.max(24, Number(win.body.width) || 24);
    const height = Math.max(10, Number(win.body.height) || 10);
    mode = pickBreakpoint(width) as LayoutMode;
    root.layout({ top: 0, left: 0, width, height });
    report = reporter.snapshot({ width, height });
    renderRegionContent();
    host.screen.render();
  }

  win.body.key(["q"], () => win.close());

  win.describeState(() => ({
    summary: `Layout Probe · ${mode} · ${report ? Object.keys(report.regions).length : 0} regions`,
    mode,
    layoutReport: report,
  }));
  win.captureText(() => [
    "Layout Probe",
    `mode: ${mode}`,
    "",
    report
      ? Object.entries(report.regions)
          .map(([name, snapshot]) =>
            `${name} ${snapshot.visible ? "visible" : "hidden"} ${snapshot.rect.width}x${snapshot.rect.height}@${snapshot.rect.left},${snapshot.rect.top}`)
          .join("\n")
      : "report pending",
  ].join("\n"));
  win.onRestyle(() => {
    for (const box of [headerBox, railBox, heroBox, statsBox, logBox, reportBox, footerBox]) {
      box.style = host.theme().body;
    }
    render();
  });
  win.onResize(render);
  win.onCleanup(() => {});
  render();
  win.focus();
}
