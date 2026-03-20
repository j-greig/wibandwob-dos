/**
 * E026 Demo — live showcase of F03/F05/F06/F07 + RenderMonitor.
 *
 * Layout (CSS-flexbox via createStack + createRow):
 *
 *   ┌──────────────────────────────────┐
 *   │  row1: createRow             │  1fr
 *   │   ┌────────────┬────────────┐    │
 *   │   │ F05 Tree   │ F06 Timer  │    │
 *   │   └────────────┴────────────┘    │
 *   │  row2: createRow             │  1fr
 *   │   ┌────────────┬────────────┐    │
 *   │   │ F07 Motion │ RenderMon  │    │
 *   │   └────────────┴────────────┘    │
 *   │  buttonBar: basis 1              │
 *   │  [①][②][③][④]  [Tween][Close]   │
 *   └──────────────────────────────────┘
 *
 * Active panel: double box-drawing border + theme accent colour.
 * Tab / ①②③④ buttons switch focus.
 */

import type blessed from "blessed";
// All SDK imports from one place — dogfooding TODO-5f986603 fix
import {
  createRenderMonitor,
  createBorderedPanel,
  createCanvas,
  type BorderedPanelHandle,
  type MicroappHost,
  safeDestroyAll,
} from "../../src/services/microapp-sdk.js";
import { createTreeWidget, type TreeNode, createTimer, clearTimers, tweenWindowPosition, tweenWindowSize, createNodePart } from "../../src/services/microapp-sdk.js";
import path from "node:path";

// ── Sample tree ───────────────────────────────────────────────────────────────

const DEMO_TREE: TreeNode[] = [
  {
    id: "src", label: "src/", expanded: true,
    children: [
      {
        id: "core", label: "core/", expanded: false,
        children: [
          { id: "ansi",   label: "ansi-utils.ts    ← F02" },
          { id: "tree",   label: "tree-widget.ts   ← F05" },
          { id: "prims",  label: "ui-primitives.ts ← F06" },
          { id: "rmon",   label: "render-monitor.ts ← SDK" },
        ],
      },
      {
        id: "services", label: "services/", expanded: false,
        children: [
          { id: "mdsvc",  label: "markdown-service.ts ← F02" },
          { id: "motion", label: "motion-service.ts   ← F07" },
        ],
      },
      {
        id: "windows", label: "windows/", expanded: false,
        children: [
          { id: "mdwin", label: "markdown-viewer-window.ts ← F03" },
        ],
      },
    ],
  },
  {
    id: "modules", label: "microapps/",
    children: [{ id: "demo", label: "e026-demo/ ← you are here" }],
  },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "E026 Demo",
    menu: [{ category: "demos", order: 99, label: "E026 Demo" }],
    palette: { order: 220, label: "E026 Demo" },
    action: () => openDemo(host),
  });
}

function openDemo(host: MicroappHost) {
  const win = host.createWindow({ title: "E026 Demo", width: 110, height: 36 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  let isClosing = false;
  let ticks = 0;
  let lastNode = "—";
  const monitor = createRenderMonitor(host.screen);

  // ── Motion helpers ────────────────────────────────────────────────────────

  const wm = host.windows;
  const sw = () => Number(host.screen.width);
  const sh = () => Number(host.screen.height);
  const requestClose = () => {
    if (isClosing) return;
    win.close();
  };

  function tweenToRandom() {
    if (isClosing) return;
    const x = Math.floor(Math.random() * Math.max(1, sw() - 80));
    const y = Math.floor(Math.random() * Math.max(1, sh() - 20));
    tweenWindowPosition(wm, win.id, x, y, 600, "elasticOut");
  }
  function resetCentre() {
    if (isClosing) return;
    const x = Math.max(0, Math.floor((sw() - 110) / 2));
    const y = Math.max(0, Math.floor((sh() - 36) / 2));
    tweenWindowPosition(wm, win.id, x, y, 400, "easeOutCubic");
  }
  function sizeBounce() {
    if (isClosing) return;
    tweenWindowSize(wm, win.id, 130, 40, 300, "easeOutCubic");
    const bounceTimeout = setTimeout(() => {
      timers.delete(bounceTimeout as ReturnType<typeof setInterval>);
      if (isClosing) return;
      tweenWindowSize(wm, win.id, 110, 36, 350, "bounceOut");
    }, 350);
    timers.add(bounceTimeout as ReturnType<typeof setInterval>);
  }

  // ── Panels ────────────────────────────────────────────────────────────────

  const p1 = createBorderedPanel(win.body, { title: "① F05 TreeWidget" }, host.theme);
  const p2 = createBorderedPanel(win.body, { title: "② F06 Timer" },      host.theme);
  const p3 = createBorderedPanel(win.body, { title: "③ F07 Motion" },     host.theme);
  const p4 = createBorderedPanel(win.body, { title: "④ RenderMonitor" },  host.theme);

  const panels = [p1, p2, p3, p4] as const;
  let activeIdx = 0;

  // ── Layout: createRow rows + createStack ──────────────────────────────

  type BtnId = "p1" | "p2" | "p3" | "p4" | "tween" | "reset" | "bounce" | "close";

  const topRow = host.ui.createRow(win.body, [
    { key: "tl", basis: "1fr", part: p1 },
    { key: "tr", basis: "1fr", part: p2 },
  ]);
  const botRow = host.ui.createRow(win.body, [
    { key: "bl", basis: "1fr", part: p3 },
    { key: "br", basis: "1fr", part: p4 },
  ]);
  const bar = host.ui.createButtonBar<BtnId>(
    win.body,
    [
      { id: "p1", label: "① Tree"   },
      { id: "p2", label: "② Timer"  },
      { id: "p3", label: "③ Motion" },
      { id: "p4", label: "④ FPS"    },
      { id: "tween",  label: "t Tween"  },
      { id: "reset",  label: "r Reset"  },
      { id: "bounce", label: "z Bounce" },
      { id: "close",  label: "q Close"  },
    ],
    (id) => {
      if      (id === "p1") setFocus(0);
      else if (id === "p2") setFocus(1);
      else if (id === "p3") setFocus(2);
      else if (id === "p4") setFocus(3);
      else if (id === "tween")  tweenToRandom();
      else if (id === "reset")  resetCentre();
      else if (id === "bounce") sizeBounce();
      else if (id === "close")  requestClose();
    },
  );

  const root = host.ui.createStack(win.body, [
    { key: "top", basis: "1fr", part: topRow },
    { key: "bot", basis: "1fr", part: botRow },
    { key: "bar", basis: 1,     part: bar    },
  ]);

  function render() {
    if (isClosing) return;
    const w = Math.max(20, Number(win.body.width)  || 80);
    const h = Math.max(8,  Number(win.body.height) || 30);
    root.layout({ top: 0, left: 0, width: w, height: h });
    host.screen.render();
  }

  setImmediate(render);
  win.onResize(render);

  // ── Panel focus ───────────────────────────────────────────────────────────

  const panelBtnIds: BtnId[] = ["p1", "p2", "p3", "p4"];

  function setFocus(idx: number) {
    if (isClosing) return;
    activeIdx = idx;
    panels.forEach((p, i) => p.setActive(i === idx));
    bar.update({ leftText: " E026 demo — Tab to cycle panels", activeId: panelBtnIds[idx] });
    // Focus the content node of the active panel
    const content = panels[idx]!.content;
    content.focus();
    host.screen.render();
  }

  setFocus(0);

  // ── TOP-LEFT panel: TreeWidget (F05) ──────────────────────────────────────

  const tree = createTreeWidget(p1.content, { style: host.theme().body });
  tree.setNodes(DEMO_TREE);
  tree.onFocus((node) => { lastNode = node.label; });
  tree.onSelect((node) => { lastNode = `★ ${node.label}`; });
  // Escape/Tab on tree → body → normal panel cycling takes over
  tree.widget.key(["escape"], () => { win.body.focus(); host.screen.render(); });
  tree.widget.key(["tab"],    () => setFocus((activeIdx + 1) % 4));
  tree.widget.key(["t"], tweenToRandom);
  tree.widget.key(["r"], resetCentre);
  tree.widget.key(["z"], sizeBounce);
  tree.widget.key(["q"], requestClose);

  // ── TOP-RIGHT panel: createTimer ticker (F06) ─────────────────────────────

  const counterCanvas = createCanvas(p2.content, { tags: false });
  const counterBox = counterCanvas.element;
  const counterBoxPart = createNodePart(counterBox);

  createTimer(() => {
    if (isClosing) return;
    ticks++;
    const fill = ticks % 20;
    const progressBar = "\x1b[96m" + "█".repeat(fill) + "\x1b[90m" + "░".repeat(20 - fill) + "\x1b[0m";
    counterBox.setContent(
      `\x1b[96m  tick\x1b[0m  \x1b[93m${String(ticks).padStart(5)}\x1b[0m\n\n` +
      `  ${progressBar}\n\n` +
      `  interval    1000ms\n` +
      `  lifecycle   Set<Timeout>\n` +
      `  cleanup     clearTimers()\n\n` +
      `  \x1b[32m✓ no leaks\x1b[0m`,
    );
    host.screen.render();
  }, 1000, timers);

  // ── BOTTOM-LEFT panel: Motion cheatsheet (F07) ────────────────────────────

  const motionCanvas = createCanvas(p3.content, { tags: false });
  const motionBox = motionCanvas.element;
  motionBox.setContent(
      `\x1b[96m  tweenWindowPosition\x1b[0m\n` +
      `  tweenWindowSize\n\n` +
      `  easings:\n` +
      `    linear  easeIn/Out\n` +
      `    easeInOut  cubic\n` +
      `    elasticOut  bounceOut\n\n` +
      `  16ms setInterval tick\n\n` +
      `  keys: t  r  z`,
  );
  const motionBoxPart = createNodePart(motionBox);

  // ── BOTTOM-RIGHT panel: RenderMonitor ─────────────────────────────────────

  const fpsCanvas = createCanvas(p4.content, { tags: false });
  const fpsBox = fpsCanvas.element;
  const fpsBoxPart = createNodePart(fpsBox);

  function fpsBar(fps: number): string {
    const max = 24;
    const fill = Math.min(max, Math.round(fps));
    const col = fps >= 20 ? "\x1b[32m" : fps >= 10 ? "\x1b[93m" : "\x1b[91m";
    return col + "█".repeat(fill) + "\x1b[90m" + "░".repeat(max - fill) + "\x1b[0m";
  }

  function updateFps(fps = monitor.fps, avgMs = monitor.avgFrameMs) {
    const fpsCol = fps >= 20 ? "\x1b[32m" : fps >= 10 ? "\x1b[93m" : "\x1b[91m";
    fpsBox.setContent(
      `  ${fpsBar(fps)}\n` +
      `  ${fpsCol}${String(fps).padStart(3)} fps\x1b[0m  \x1b[90m${avgMs.toFixed(1)}ms avg\x1b[0m\n\n` +
      `  \x1b[90m${monitor.totalFrames} frames total\x1b[0m\n\n` +
      `  idle ≈ 1-2 fps\n` +
      `  tween ≈ 30+ fps\n\n` +
      `  \x1b[96m  last selected:\x1b[0m\n  ${lastNode}`,
    );
  }
  updateFps();

  const unsubMonitor = monitor.subscribe((r) => {
    if (isClosing) return;
    updateFps(r.fps, r.avgFrameMs);
    host.screen.render();
  }, 500);

  // ── Body / global keys ────────────────────────────────────────────────────

  win.body.key(["1"], () => setFocus(0));
  win.body.key(["2"], () => setFocus(1));
  win.body.key(["3"], () => setFocus(2));
  win.body.key(["4"], () => setFocus(3));
  win.body.key(["tab"],            () => setFocus((activeIdx + 1) % 4));
  win.body.key(["S-tab"],          () => setFocus((activeIdx + 3) % 4));
  win.body.key(["t"],              tweenToRandom);
  win.body.key(["r"],              resetCentre);
  win.body.key(["z"],              sizeBounce);
  win.body.key(["q", "escape"],    requestClose);

  // ── Hooks ─────────────────────────────────────────────────────────────────

  win.describeState(() => ({
    summary: `E026 Demo — panel:${activeIdx + 1} ${monitor.fps}fps ticks:${ticks}`,
  }));
  win.captureText(() =>
    `E026 Demo\npanel: ${activeIdx + 1}\nfps: ${monitor.fps}\nticks: ${ticks}\nselected: ${lastNode}`,
  );

  win.onRestyle(() => {
    panels.forEach(p => p.restyle());
    bar.restyle();
    (counterBox as any).style = host.theme().body;
    (fpsBox as any).style = host.theme().body;
    render();
  });

  win.onCleanup(() => {
    isClosing = true;
    clearTimers(timers);
    unsubMonitor();
    safeDestroyAll(monitor, tree, root);
  });

  win.focus();
}
