/**
 * Responsive Panels Demo (Pi/Claude version)
 *
 * Breakpoint-driven panel visibility using flex composition.
 * Three modes based on WIDTH only:
 *   lg (>= 80): header + sidebar + main + inspector + status
 *   md (>= 50): header + sidebar + main + status
 *   sm (< 50):  header + main + status
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createNodePart } from "../../src/services/microapp-sdk.js";

type Mode = "lg" | "md" | "sm";

function pickMode(w: number): Mode {
  if (w >= 80) return "lg";
  if (w >= 50) return "md";
  return "sm";
}

function makeRegion(parent: blessed.Widgets.Node, label: string) {
  const node = blessed.box({
    parent, top: 0, left: 0, width: 0, height: 0,
    border: { type: "line" }, label: ` ${label} `, tags: false,
  });
  const part = createNodePart(node);
  return {
    ...part,
    paint() {
      const w = Number(node.width) || 0;
      const h = Number(node.height) || 0;
      node.setContent(`${label} ${w}x${h}`);
    },
  };
}

function makeDivider(parent: blessed.Widgets.Node) {
  const node = blessed.box({
    parent, top: 0, left: 0, width: 1, height: 0,
    ch: "│", tags: false,
  });
  return createNodePart(node);
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Responsive Panels (Pi)",
    description: "Breakpoint-driven panel visibility with flex composition",
    action: () => {
      const win = host.createWindow({ title: "Responsive Panels (Pi)", width: 90, height: 28 });

      let mode: Mode = "lg";

      const header = makeRegion(win.body, "HEADER");
      const sidebar = makeRegion(win.body, "SIDEBAR");
      const sidebarDiv = makeDivider(win.body);
      const mainPanel = makeRegion(win.body, "MAIN");
      const inspectorDiv = makeDivider(win.body);
      const inspector = makeRegion(win.body, "INSPECTOR");
      const status = makeRegion(win.body, "STATUS");

      const body = host.ui.createRow(win.body, [
        { key: "sidebar", basis: 24, part: sidebar, visible: () => mode !== "sm" },
        { key: "sidebar-div", basis: 1, part: sidebarDiv, visible: () => mode !== "sm" },
        { key: "main", basis: "1fr", part: mainPanel },
        { key: "inspector-div", basis: 1, part: inspectorDiv, visible: () => mode === "lg" },
        { key: "inspector", basis: 24, part: inspector, visible: () => mode === "lg" },
      ]);

      const root = host.ui.createStack(win.body, [
        { key: "header", basis: 3, part: header },
        { key: "body", basis: "1fr", part: body },
        { key: "status", basis: 1, part: status },
      ]);

      function render() {
        const w = Math.max(1, Number(win.body.width) || 90);
        const h = Math.max(1, Number(win.body.height) || 28);
        mode = pickMode(w);

        root.layout({ top: 0, left: 0, width: w, height: h });

        header.paint(); sidebar.paint(); mainPanel.paint();
        inspector.paint(); status.paint();

        // Override header content to show mode
        header.node.setContent(`${mode.toUpperCase()} mode  ${w}x${h}`);
        status.node.setContent(
          `sidebar:${mode !== "sm" ? "on" : "off"} inspector:${mode === "lg" ? "on" : "off"}  [${mode}]`
        );

        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => { root.destroy(); });
      win.onRestyle(() => { root.restyle(); host.screen.render(); });

      win.describeState(() => {
        const sideW = mode !== "sm" ? (Number(sidebar.node.width) || 0) : 0;
        const mainW = Number(mainPanel.node.width) || 0;
        const inspW = mode === "lg" ? (Number(inspector.node.width) || 0) : 0;
        return {
          summary: `Responsive Panels: ${mode} — sidebar:${mode !== "sm"} inspector:${mode === "lg"} ${Number(win.body.width)||0}x${Number(win.body.height)||0}`,
          mode,
          sidebarVisible: mode !== "sm",
          sidebarDividerVisible: mode !== "sm",
          inspectorVisible: mode === "lg",
          inspectorDividerVisible: mode === "lg",
          sidebarWidth: sideW,
          mainWidth: mainW,
          inspectorWidth: inspW,
          windowWidth: Number(win.body.width) || 0,
          windowHeight: Number(win.body.height) || 0,
        };
      });

      win.captureText(() =>
        `Responsive Panels — ${mode} mode, sidebar:${mode !== "sm"} inspector:${mode === "lg"}`
      );

      win.focus();
    },
    menu: [{ category: "demos", order: 94, label: "Responsive Panels (Pi)" }],
    palette: { order: 294, label: "Responsive Panels (Pi)" },
  });
}
