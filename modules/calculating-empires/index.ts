/**
 * Calculating Empires — Dense scrollable panel visualization.
 *
 * Inspired by Crawford & Joler's Calculating Empires poster:
 * black background, white elements, hundreds of panels arrayed across axes.
 *
 * Features:
 * - Full-screen window with scrollable canvas
 * - Magazine-style panel layout using layoutPanels
 * - 6 panel types: text, figlet, ascii-art, pixel, infographic, mixed
 * - Hot-reload from content/calculating-empires/panels/*.json
 * - j/k scroll, / search cycle, z zoom toggle, q close
 */

import blessed from "blessed";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  layoutPanels,
  measureViewport,
  createBorderedPanel,
  type PanelDef,
  type PanelNode,
} from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { SAMPLE_PANELS } from "./sample-panels.js";
import { loadPanelsFromDir, watchPanelDir } from "./content-loader.js";
import { toPanelDef } from "./panel-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../../content/calculating-empires/panels");

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Calculating Empires",
    menu: [{ category: "applications", order: 80, label: "Calculating Empires" }],
    palette: { order: 230, label: "Calculating Empires" },
    action: () => openCE(host),
  });
}

function openCE(host: MicroappHost) {
  const sw = Math.max(80, Number(host.screen.width));
  const sh = Math.max(24, Number(host.screen.height));
  const win = host.createWindow({
    title: "Calculating Empires",
    width: sw - 2,
    height: sh - 3,
    left: 1,
    top: 1,
  });

  const timers = new Set<ReturnType<typeof setInterval>>();
  let tick = 0;
  let zoom: "normal" | "compact" = "normal";
  let searchQuery = "";
  let stopWatcher = () => {};

  // Canvas — scrollable container for all panels
  const canvas = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    tags: false,
    style: { fg: "white", bg: "black" },
  });

  // Status bar
  const statusBar = blessed.box({
    parent: win.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: false,
    style: { fg: "black", bg: "white" },
  });

  // Panel nodes map
  const panelNodes = new Map<string, PanelNode>();

  // Load panels — prefer JSON files, fall back to samples
  function getPanelDefs(): PanelDef[] {
    const fromFiles = loadPanelsFromDir(CONTENT_DIR);
    const base = fromFiles.length > 0 ? fromFiles : SAMPLE_PANELS;
    const filtered = searchQuery
      ? base.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : base;
    const scaled = zoom === "compact"
      ? filtered.map(p => ({ ...p, w: Math.floor(p.w * 0.7), h: Math.floor(p.h * 0.7) }))
      : filtered;
    return scaled.map(toPanelDef);
  }

  // Build / rebuild all panel nodes
  function buildPanels() {
    // Destroy existing panels
    for (const node of panelNodes.values()) {
      node.frame.destroy();
    }
    panelNodes.clear();

    const { width: vw } = measureViewport(canvas);
    const panelDefs = getPanelDefs();
    const layout = layoutPanels(panelDefs, Math.max(20, vw));

    // Set canvas height to content height
    const bodyHeight = Number(win.body.height) || 20;
    (canvas as any).height = Math.max(bodyHeight - 1, layout.contentHeight + 2);

    for (const def of panelDefs) {
      const placement = layout.placements.find(p => p.id === def.id);
      if (!placement) continue;

      const panel = createBorderedPanel(canvas, { title: def.title }, host.theme);
      panel.layout({ top: placement.y, left: placement.x, width: def.w, height: def.h });

      // Render initial content
      const contentStr = def.content(tick, def.w - 2, def.h - 2);
      panel.content.setContent(contentStr);

      panelNodes.set(def.id, {
        def,
        frame: panel.node as blessed.Widgets.BoxElement,
        titleBar: panel.node as blessed.Widgets.BoxElement,
        content: panel.content,
        x: placement.x,
        y: placement.y,
      });
    }

    updateStatus();
    host.screen.render();
  }

  function updateStatus() {
    const scroll = (canvas as any).getScroll?.() ?? 0;
    const q = searchQuery ? `  /${searchQuery}` : "";
    statusBar.setContent(
      ` ${panelNodes.size} panels  scroll:${scroll}  zoom:${zoom}${q}  j/k scroll  / search  z zoom  q close`
    );
  }

  // Tick loop — update live panels
  createTimer(() => {
    tick++;
    for (const [id, node] of panelNodes) {
      if (!node.def.live) continue;
      const contentStr = node.def.content(tick, node.def.w - 2, node.def.h - 2);
      node.content.setContent(contentStr);
    }
    updateStatus();
    host.screen.render();
  }, 120, timers);

  // Key handlers on win.body
  win.body.key(["j", "down"],     () => { (canvas as any).scroll(1);   updateStatus(); host.screen.render(); });
  win.body.key(["k", "up"],       () => { (canvas as any).scroll(-1);  updateStatus(); host.screen.render(); });
  win.body.key(["d", "pagedown"], () => { (canvas as any).scroll(10);  updateStatus(); host.screen.render(); });
  win.body.key(["u", "pageup"],   () => { (canvas as any).scroll(-10); updateStatus(); host.screen.render(); });
  win.body.key(["g", "home"],     () => { (canvas as any).scrollTo(0); updateStatus(); host.screen.render(); });
  win.body.key(["G", "end"],      () => { (canvas as any).scrollTo(9999); updateStatus(); host.screen.render(); });
  win.body.key(["z"],             () => { zoom = zoom === "normal" ? "compact" : "normal"; buildPanels(); });
  win.body.key(["r"],             () => buildPanels());
  win.body.key(["q", "escape"],   () => win.close());
  win.body.key(["/"],             () => {
    // Simple search cycle — full overlay search is for later
    const queries = ["", "2024", "2025", "2026", "canon", "wib"];
    const idx = queries.indexOf(searchQuery);
    searchQuery = queries[(idx + 1) % queries.length] ?? "";
    buildPanels();
  });

  // Also bind to canvas for when it has focus
  canvas.key(["j", "down"],     () => { (canvas as any).scroll(1);   updateStatus(); host.screen.render(); });
  canvas.key(["k", "up"],       () => { (canvas as any).scroll(-1);  updateStatus(); host.screen.render(); });
  canvas.key(["q", "escape"],   () => win.close());

  // File watcher for hot-reload
  stopWatcher = watchPanelDir(CONTENT_DIR, () => {
    setTimeout(() => buildPanels(), 100);
  });

  // Handle window resize
  win.onResize(() => {
    setTimeout(() => buildPanels(), 100);
  });

  // describeState — semantic metadata for agents
  win.describeState(() => ({
    appType: "calculating-empires",
    panelCount: panelNodes.size,
    scrollPos: (canvas as any).getScroll?.() ?? 0,
    zoom,
    search: searchQuery,
    summary: `Calculating Empires — ${panelNodes.size} panels  zoom:${zoom}`,
    panels: Array.from(panelNodes.values()).map(n => ({
      id: n.def.id,
      title: n.def.title,
      x: n.x,
      y: n.y,
      w: n.def.w,
      h: n.def.h,
    })),
  }));

  // captureText — plain text summary
  win.captureText(() => {
    return Array.from(panelNodes.values())
      .map(n => `[${n.def.title}]`)
      .join("\n");
  });

  // Restyle on theme change
  win.onRestyle(() => {
    (canvas as any).style = { fg: "white", bg: "black" };
    statusBar.style = { fg: "black", bg: "white" };
    host.screen.render();
  });

  // Cleanup
  win.onCleanup(() => {
    stopWatcher();
    clearTimers(timers);
    for (const node of panelNodes.values()) {
      node.frame.destroy();
    }
    panelNodes.clear();
  });

  // Initial build
  buildPanels();
  win.focus();
  win.body.focus();
}
