/**
 * E026 Demo — live showcase of F03/F05/F06/F07 + RenderMonitor.
 *
 * Layout (CSS-flexbox via createStack + createColumns):
 *
 *   ┌──────────────────────────────────┐
 *   │  row1: createColumns             │  1fr
 *   │   ┌────────────┬────────────┐    │
 *   │   │ F05 Tree   │ F06 Timer  │    │
 *   │   └────────────┴────────────┘    │
 *   │  row2: createColumns             │  1fr
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

import blessed from "blessed";
// All SDK imports from one place — dogfooding TODO-5f986603 fix
import {
  applyRect,
  createRenderMonitor,
  type UiPart,
  type Rect,
  type MicroappHost,
} from "../../src/services/microapp-sdk.js";
import { createTreeWidget, type TreeNode } from "../../src/core/tree-widget.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { tweenWindowPosition, tweenWindowSize } from "../../src/services/motion-service.js";
import path from "node:path";

// ── createPanel ────────────────────────────────────────────────────────────────
// A UiPart with a manually-drawn border that switches single↔double depending
// on active state, and uses theme accent colour when active.

type PanelHandle = UiPart<void> & {
  content: blessed.Widgets.BoxElement;
  setActive(active: boolean): void;
  restyle(): void;
};

function createPanel(
  parent: blessed.Widgets.Node,
  title: string,
  getTheme: () => import("../../src/core/theme/types.js").ThemeTokens,
): PanelHandle {
  // Outer box — no blessed border; we draw it as plain text so blessed
  // doesn't try to parse widths. wrap:false prevents the top border line
  // from wrapping when the box is wide. Colour via style.fg only — no
  // ANSI escape codes in content (they confuse blessed's width maths).
  const outer = blessed.box({
    parent,
    top: 0, left: 0, width: 0, height: 0,
    tags: false,
    wrap: false,
    style: { fg: getTheme().windowBorderUnfocused.fg, bg: getTheme().body.bg },
  });

  // Title sits on the top border row, inside the corners
  const titleBox = blessed.box({
    parent: outer,
    top: 0, left: 2, width: "shrink", height: 1,
    tags: false,
    content: ` ${title} `,
    style: getTheme().body,
  });

  // Inner content box — lives inside the 1-cell border inset
  const inner = blessed.box({
    parent: outer,
    top: 1, left: 1, right: 1, bottom: 1,
    tags: false,
    style: getTheme().body,
  });

  let active = false;
  let lastW = 0;
  let lastH = 0;

  function drawBorder() {
    const w = lastW;
    const h = lastH;
    if (w < 2 || h < 2) return;

    const tl = active ? "╔" : "┌";
    const tr = active ? "╗" : "┐";
    const bl = active ? "╚" : "└";
    const br = active ? "╝" : "┘";
    const hz = active ? "═" : "─";
    const vt = active ? "║" : "│";

    // Top row: corners + fill. Title box overlays left of centre.
    const topLine = tl + hz.repeat(w - 2) + tr;
    // Mid rows: just left/right verticals; inner box covers the middle
    const midLine = vt + " ".repeat(w - 2) + vt;
    const botLine = bl + hz.repeat(w - 2) + br;

    const rows = [topLine];
    for (let i = 1; i < h - 1; i++) rows.push(midLine);
    rows.push(botLine);
    outer.setContent(rows.join("\n"));
  }

  function applyStyle() {
    const t = getTheme();
    const borderFg = active ? t.titleBarFocused.bg : t.windowBorderUnfocused.fg;
    (outer as any).style    = { fg: borderFg, bg: t.body.bg };
    (titleBox as any).style = active
      ? { fg: t.titleBarFocused.fg, bg: t.titleBarFocused.bg, bold: true }
      : t.body;
    (inner as any).style = t.body;
  }

  return {
    node: outer,
    content: inner,

    layout(rect: Rect) {
      lastW = rect.width;
      lastH = rect.height;
      applyRect(outer, rect);
      inner.top    = 1;
      inner.left   = 1;
      inner.width  = Math.max(1, rect.width  - 2);
      inner.height = Math.max(1, rect.height - 2);
      drawBorder();
    },

    update() {},

    setActive(a: boolean) {
      active = a;
      applyStyle();
      drawBorder();
    },

    restyle() {
      applyStyle();
      drawBorder();
    },

    destroy() {
      titleBox.destroy();
      inner.destroy();
      outer.destroy();
    },
  };
}

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
    id: "modules", label: "modules/",
    children: [{ id: "demo", label: "e026-demo/ ← you are here" }],
  },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "E026 Demo",
    menu: [{ category: "applications", order: 99, label: "E026 Demo" }],
    palette: { order: 220, label: "E026 Demo" },
    action: () => openDemo(host),
  });
}

function openDemo(host: MicroappHost) {
  const win = host.createWindow({ title: "E026 Demo", width: 110, height: 36 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  let ticks = 0;
  let lastNode = "—";
  const monitor = createRenderMonitor(host.screen);

  // ── Motion helpers ────────────────────────────────────────────────────────

  const wm = host.windows;
  const sw = () => Number(host.screen.width);
  const sh = () => Number(host.screen.height);

  function tweenToRandom() {
    const x = Math.floor(Math.random() * Math.max(1, sw() - 80));
    const y = Math.floor(Math.random() * Math.max(1, sh() - 20));
    tweenWindowPosition(wm, win.id, x, y, 600, "elasticOut");
  }
  function resetCentre() {
    const x = Math.max(0, Math.floor((sw() - 110) / 2));
    const y = Math.max(0, Math.floor((sh() - 36) / 2));
    tweenWindowPosition(wm, win.id, x, y, 400, "easeOutCubic");
  }
  function sizeBounce() {
    tweenWindowSize(wm, win.id, 130, 40, 300, "easeOutCubic");
    setTimeout(() => tweenWindowSize(wm, win.id, 110, 36, 350, "bounceOut"), 350);
  }

  // ── Panels ────────────────────────────────────────────────────────────────

  const p1 = createPanel(win.body, "① F05 TreeWidget", host.theme);
  const p2 = createPanel(win.body, "② F06 Timer",      host.theme);
  const p3 = createPanel(win.body, "③ F07 Motion",     host.theme);
  const p4 = createPanel(win.body, "④ RenderMonitor",  host.theme);

  const panels = [p1, p2, p3, p4] as const;
  let activeIdx = 0;

  // ── Layout: createColumns rows + createStack ──────────────────────────────

  type BtnId = "p1" | "p2" | "p3" | "p4" | "tween" | "reset" | "bounce" | "close";

  const topRow = host.ui.createColumns(win.body, [
    { key: "tl", basis: "1fr", part: p1 },
    { key: "tr", basis: "1fr", part: p2 },
  ]);
  const botRow = host.ui.createColumns(win.body, [
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
      else if (id === "close")  win.close();
    },
  );

  const root = host.ui.createStack(win.body, [
    { key: "top", basis: "1fr", part: topRow },
    { key: "bot", basis: "1fr", part: botRow },
    { key: "bar", basis: 1,     part: bar    },
  ]);

  function render() {
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
  tree.widget.key(["q"], () => win.close());

  // ── TOP-RIGHT panel: createTimer ticker (F06) ─────────────────────────────

  const counterBox = blessed.box({
    parent: p2.content, top: 0, left: 1, right: 1, bottom: 0,
    tags: false, style: host.theme().body,
  });

  createTimer(() => {
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

  blessed.box({
    parent: p3.content, top: 0, left: 1, right: 1, bottom: 0,
    tags: false, style: host.theme().body,
    content:
      `\x1b[96m  tweenWindowPosition\x1b[0m\n` +
      `  tweenWindowSize\n\n` +
      `  easings:\n` +
      `    linear  easeIn/Out\n` +
      `    easeInOut  cubic\n` +
      `    elasticOut  bounceOut\n\n` +
      `  16ms setInterval tick\n\n` +
      `  keys: t  r  z`,
  });

  // ── BOTTOM-RIGHT panel: RenderMonitor ─────────────────────────────────────

  const fpsBox = blessed.box({
    parent: p4.content, top: 0, left: 1, right: 1, bottom: 0,
    tags: false, style: host.theme().body,
  });

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
  win.body.key(["q", "escape"],    () => win.close());

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
    clearTimers(timers);
    unsubMonitor();
    monitor.destroy();
    tree.destroy();
    root.destroy();
  });

  win.focus();
}
