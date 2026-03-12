/**
 * Flex Workbench Demo (Pi/Claude version)
 *
 * App-scale nested flex composition:
 * - 4 levels of flex nesting
 * - Responsive hide/show via breakpoints (width-only)
 * - Wrapped tag chips inside the inspector panel
 * - Toolbar with spacer (fixed + 1fr)
 *
 * Modes:
 *   lg (>= 90): toolbar + nav + document + inspector(with tags) + status
 *   md (>= 60): toolbar + nav + document + status
 *   sm (< 60):  toolbar + document + status
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { applyRect, createNodePart } from "../../src/services/microapp-sdk.js";

type Mode = "lg" | "md" | "sm";

function pickMode(w: number): Mode {
  if (w >= 90) return "lg";
  if (w >= 60) return "md";
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
    paint(extra?: string) {
      const w = Number(node.width) || 0;
      const h = Number(node.height) || 0;
      node.setContent(extra ?? `${label} ${w}x${h}`);
    },
  };
}

function makeDivider(parent: blessed.Widgets.Node) {
  const node = blessed.box({
    parent, top: 0, left: 0, width: 1, height: 0, ch: "│", tags: false,
  });
  return createNodePart(node);
}

// ── Inline wrap layout (proving-ground, not SDK) ─────────────────────────

const TAG_LABELS = ["ai", "ux", "sim", "map", "net", "gfx", "snd", "sys"];
const TAG_W = 6;
const TAG_H = 1;

function layoutTags(
  tags: blessed.Widgets.BoxElement[],
  containerW: number,
  gap: number,
): number {
  let x = 0, y = 0, rowH = 0, colsInRow = 0, rows = 0;
  for (const tag of tags) {
    const cw = Math.min(TAG_W, containerW);
    if (colsInRow > 0 && x + gap + cw > containerW) {
      y += rowH; x = 0; rowH = 0; colsInRow = 0; rows++;
    }
    const left = colsInRow > 0 ? x + gap : x;
    applyRect(tag, { top: y, left, width: cw, height: TAG_H });
    x = left + cw;
    rowH = Math.max(rowH, TAG_H);
    colsInRow++;
  }
  if (colsInRow > 0) rows++;
  return rows;
}

// ── Module ───────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Flex Workbench (Pi)",
    description: "App-scale nested flex composition with wrap, responsive",
    action: () => {
      const win = host.createWindow({ title: "Flex Workbench (Pi)", width: 100, height: 30 });

      let mode: Mode = "lg";

      // Regions
      const toolbar = makeRegion(win.body, "TOOLBAR");
      const navBox = makeRegion(win.body, "NAV");
      const navDiv = makeDivider(win.body);
      const docHeader = makeRegion(win.body, "DOC-HDR");
      const docContent = makeRegion(win.body, "DOC");
      const docFooter = makeRegion(win.body, "DOC-FTR");
      const inspHeader = makeRegion(win.body, "INSP-HDR");
      const inspBody = makeRegion(win.body, "INSP");
      const inspDiv = makeDivider(win.body);
      const statusBar = makeRegion(win.body, "STATUS");

      // Tag chips container
      const tagContainer = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 0,
      });
      const tagNodes = TAG_LABELS.map((label, i) => {
        return blessed.box({
          parent: tagContainer, top: 0, left: 0, width: TAG_W, height: TAG_H,
          content: ` ${label} `,
          style: { fg: "white", bg: ["blue","green","cyan","red","magenta","yellow","grey","brightblue"][i % 8] },
        });
      });
      const tagPart = createNodePart(tagContainer);

      // Inspector stack
      const inspStack = host.ui.createStack(win.body, [
        { key: "insp-header", basis: 1, part: inspHeader },
        { key: "insp-body", basis: "1fr", part: inspBody },
        { key: "insp-tags", basis: 4, part: tagPart },
      ]);

      // Document stack
      const docStack = host.ui.createStack(win.body, [
        { key: "doc-header", basis: 1, part: docHeader },
        { key: "doc-content", basis: "1fr", part: docContent },
        { key: "doc-footer", basis: 1, part: docFooter },
      ]);

      // Body row
      const bodyRow = host.ui.createRow(win.body, [
        { key: "nav", basis: 16, part: navBox, visible: () => mode !== "sm" },
        { key: "nav-div", basis: 1, part: navDiv, visible: () => mode !== "sm" },
        { key: "document", basis: "1fr", part: docStack },
        { key: "insp-div", basis: 1, part: inspDiv, visible: () => mode === "lg" },
        { key: "inspector", basis: 24, part: inspStack, visible: () => mode === "lg" },
      ]);

      // Root
      const root = host.ui.createStack(win.body, [
        { key: "toolbar", basis: 3, part: toolbar },
        { key: "body", basis: "1fr", part: bodyRow },
        { key: "status", basis: 1, part: statusBar },
      ]);

      let tagRows = 0;

      function render() {
        const w = Math.max(1, Number(win.body.width) || 100);
        const h = Math.max(1, Number(win.body.height) || 30);
        mode = pickMode(w);

        root.layout({ top: 0, left: 0, width: w, height: h });

        // Paint all regions
        toolbar.paint(`Workbench  ${mode.toUpperCase()}  ${w}x${h}`);
        navBox.paint("Files\nSearch\nGit\nDebug\nExts");
        docHeader.paint("document.ts");
        docContent.paint();
        docFooter.paint(`Ln 1 Col 1`);
        inspHeader.paint("Inspector");
        inspBody.paint("Properties");
        statusBar.paint(
          `nav:${mode !== "sm" ? "on" : "off"} insp:${mode === "lg" ? "on" : "off"} tags:${tagRows}rows  [${mode}]`
        );

        // Layout tags inside inspector
        if (mode === "lg") {
          const containerW = Math.max(1, Number(tagContainer.width) || 1);
          tagRows = layoutTags(tagNodes, containerW, 1);
        } else {
          tagRows = 0;
        }

        host.screen.render();
      }

      render();
      win.onResize(render);
      win.onCleanup(() => {
        for (const t of tagNodes) t.destroy();
        root.destroy();
      });
      win.onRestyle(() => { root.restyle(); host.screen.render(); });

      win.describeState(() => {
        const docW = Number(docStack.node.width) || 0;
        const docH = Number(docContent.node.height) || 0;
        return {
          summary: `Workbench: ${mode} nav:${mode !== "sm"} insp:${mode === "lg"} doc:${docW}x${docH} tags:${tagRows}rows`,
          mode,
          navVisible: mode !== "sm",
          inspectorVisible: mode === "lg",
          toolbarWidth: Number(toolbar.node.width) || 0,
          navWidth: mode !== "sm" ? (Number(navBox.node.width) || 0) : 0,
          documentWidth: docW,
          documentHeight: docH,
          inspectorWidth: mode === "lg" ? (Number(inspStack.node.width) || 0) : 0,
          tagChipRows: tagRows,
          contentOverflowY: false,
          windowWidth: Number(win.body.width) || 0,
          windowHeight: Number(win.body.height) || 0,
        };
      });

      win.captureText(() =>
        `Flex Workbench — ${mode} mode, nav:${mode !== "sm"} insp:${mode === "lg"}`
      );

      win.focus();
    },
    menu: [{ category: "demos", order: 95, label: "Flex Workbench (Pi)" }],
    palette: { order: 295, label: "Flex Workbench (Pi)" },
  });
}
