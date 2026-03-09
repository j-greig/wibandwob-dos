/**
 * E026 Demo — live showcase of F03/F05/F06/F07 + RenderMonitor.
 *
 * Layout:
 *   TOP-LEFT     TreeWidget (F05)
 *   TOP-RIGHT    createTimer ticker (F06)
 *   BOTTOM-LEFT  Motion cheatsheet (F07)
 *   BOTTOM-RIGHT RenderMonitor FPS (SDK)
 *   FOOTER       Fixed button bar — [Tween] [Reset] [Bounce] [AGENTS.md] [Close]
 *
 * Keys: t tween  r reset  z bounce  h open AGENTS.md  q/Esc close
 * Tab on tree returns focus to body.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTreeWidget, type TreeNode } from "../../src/core/tree-widget.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { tweenWindowPosition, tweenWindowSize } from "../../src/services/motion-service.js";
import { createRenderMonitor } from "../../src/services/microapp-sdk.js";
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
  const win = host.createWindow({ title: "E026 Demo", width: 104, height: 34 });
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
    const x = Math.max(0, Math.floor((sw() - 104) / 2));
    const y = Math.max(0, Math.floor((sh() - 34) / 2));
    tweenWindowPosition(wm, win.id, x, y, 400, "easeOutCubic");
  }
  function sizeBounce() {
    tweenWindowSize(wm, win.id, 124, 38, 300, "easeOutCubic");
    setTimeout(() => tweenWindowSize(wm, win.id, 104, 34, 350, "bounceOut"), 350);
  }

  const repoRoot = path.resolve(new URL(import.meta.url).pathname, "../../../");
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  function openAgents() { host.runCommand("markdown.open", { filePath: agentsPath }); }

  // ── Layout ────────────────────────────────────────────────────────────────
  // body is split: top 32 rows for panels, bottom 1 row for button bar.
  // Each panel box uses explicit bottom:1 so the bar isn't covered.

  // Panel helper — top half uses height:"50%", bottom half uses bottom:1 to
  // leave room for the button bar (blessed has no calc() support)
  function panelBox(opts: { top: number | string; left: number | string; height?: number | string; bottom?: number }) {
    return blessed.box({
      parent: win.body, top: opts.top, left: opts.left, width: "50%",
      ...(opts.bottom !== undefined ? { bottom: opts.bottom } : { height: opts.height }),
      border: "line",
      style: { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } },
    });
  }
  function panelLabel(text: string, top: number | string, left: number | string) {
    blessed.box({
      parent: win.body, top, left, width: "shrink", height: 1,
      content: ` ${text} `, tags: false,
      style: { fg: host.theme().titleBarFocused.fg, bg: host.theme().titleBarFocused.bg },
    });
  }

  const tlBox = panelBox({ top: 1,    left: 0,    height: "50%" });
  const trBox = panelBox({ top: 1,    left: "50%", height: "50%" });
  const blBox = panelBox({ top: "50%", left: 0,    bottom: 1 });
  const brBox = panelBox({ top: "50%", left: "50%", bottom: 1 });

  panelLabel("F05 TreeWidget  (j/k ←/→ Enter · Tab=body)", 0, 0);
  panelLabel("F06 createTimer  (1s tick)", 0, "50%");
  panelLabel("F07 motion/tween", "50%", 0);
  panelLabel("RenderMonitor", "50%", "50%");

  // ── TOP-LEFT: TreeWidget ──────────────────────────────────────────────────

  const tree = createTreeWidget(tlBox, { style: host.theme().body });
  tree.setNodes(DEMO_TREE);
  tree.onFocus((node) => { lastNode = node.label; });
  tree.onSelect((node) => { lastNode = `★ ${node.label}`; });

  // Escape/Tab on tree → back to body
  tree.widget.key(["tab", "escape"], () => { win.body.focus(); host.screen.render(); });
  // Global actions still reachable from tree
  tree.widget.key(["t"], tweenToRandom);
  tree.widget.key(["r"], resetCentre);
  tree.widget.key(["z"], sizeBounce);
  tree.widget.key(["h"], openAgents);
  tree.widget.key(["q"], () => win.close());

  // ── TOP-RIGHT: Timer counter ──────────────────────────────────────────────

  const counterBox = blessed.box({
    parent: trBox, top: 1, left: 2, right: 2, bottom: 1,
    tags: false, style: host.theme().body,
  });

  createTimer(() => {
    ticks++;
    const fill = ticks % 20;
    const bar = "\x1b[96m" + "█".repeat(fill) + "\x1b[90m" + "░".repeat(20 - fill) + "\x1b[0m";
    counterBox.setContent(
      `\x1b[96m  tick\x1b[0m  \x1b[93m${String(ticks).padStart(5)}\x1b[0m\n\n` +
      `  ${bar}\n\n` +
      `  interval    1000ms\n` +
      `  lifecycle   Set<Timeout>\n` +
      `  cleanup     clearTimers()\n\n` +
      `  \x1b[32m✓ no leaks\x1b[0m`
    );
    host.screen.render();
  }, 1000, timers);

  // ── BOTTOM-LEFT: Motion info ──────────────────────────────────────────────

  blessed.box({
    parent: blBox, top: 1, left: 2, right: 2, bottom: 1,
    tags: false, style: host.theme().body,
    content:
      `\x1b[96m  tweenWindowPosition\x1b[0m\n` +
      `  tweenWindowSize\n\n` +
      `  easings: linear easeIn/Out\n` +
      `  easeInOut cubic elasticOut\n` +
      `  bounceOut — 16ms setInterval\n\n` +
      `  Click buttons below ↓\n` +
      `  or keys: t  r  z`,
  });

  // ── BOTTOM-RIGHT: RenderMonitor ───────────────────────────────────────────

  const fpsBox = blessed.box({
    parent: brBox, top: 1, left: 2, right: 2, bottom: 1,
    tags: false, style: host.theme().body,
  });

  function fpsBar(fps: number): string {
    const max = 28;
    const fill = Math.min(max, Math.round(fps));
    const color = fps >= 20 ? "\x1b[32m" : fps >= 10 ? "\x1b[93m" : "\x1b[91m";
    return color + "█".repeat(fill) + "\x1b[90m" + "░".repeat(max - fill) + "\x1b[0m";
  }

  function updateFps(fps = monitor.fps, avgMs = monitor.avgFrameMs) {
    const fpsColor = fps >= 20 ? "\x1b[32m" : fps >= 10 ? "\x1b[93m" : "\x1b[91m";
    fpsBox.setContent(
      `  ${fpsBar(fps)}\n` +
      `  ${fpsColor}${String(fps).padStart(3)} fps\x1b[0m  \x1b[90m${avgMs.toFixed(1)}ms avg\x1b[0m\n\n` +
      `  \x1b[90m${monitor.totalFrames} frames total\x1b[0m\n\n` +
      `  idle ≈ 1-2 fps\n` +
      `  tween ≈ 30+ fps\n\n` +
      `  \x1b[96m  selected:\x1b[0m\n  ${lastNode}`
    );
  }
  updateFps();

  const unsubMonitor = monitor.subscribe((r) => {
    updateFps(r.fps, r.avgFrameMs);
    host.screen.render();
  }, 500);

  // ── FOOTER: Button bar ────────────────────────────────────────────────────

  type BtnId = "tween" | "reset" | "bounce" | "agents" | "close";
  const bar = host.ui.createButtonBar<BtnId>(
    win.body,
    [
      { id: "tween",  label: "t Tween"   },
      { id: "reset",  label: "r Reset"   },
      { id: "bounce", label: "z Bounce"  },
      { id: "agents", label: "h MD View" },
      { id: "close",  label: "q Close"   },
    ],
    (id) => {
      win.body.focus();
      if (id === "tween")  tweenToRandom();
      if (id === "reset")  resetCentre();
      if (id === "bounce") sizeBounce();
      if (id === "agents") openAgents();
      if (id === "close")  win.close();
    },
  );
  // Pin the bar node to the bottom of win.body directly
  const barNode = bar.node as any;
  barNode.top    = undefined;
  barNode.bottom = 0;
  barNode.left   = 0;
  barNode.width  = "100%";
  barNode.height = 1;
  bar.update({ leftText: " E026 — F03 F05 F06 F07 RenderMonitor ✓", activeId: "tween" });

  // ── Body keys ─────────────────────────────────────────────────────────────

  win.body.key(["t"], tweenToRandom);
  win.body.key(["r"], resetCentre);
  win.body.key(["z"], sizeBounce);
  win.body.key(["h"], openAgents);
  win.body.key(["q", "escape"], () => win.close());
  win.body.key(["tab"], () => { tree.widget.focus(); host.screen.render(); });

  // ── Hooks ─────────────────────────────────────────────────────────────────

  win.describeState(() => ({
    summary: `E026 Demo — ${monitor.fps}fps ticks:${ticks} selected:${lastNode}`,
  }));
  win.captureText(() => `E026 Demo\nfps: ${monitor.fps}\nticks: ${ticks}\nselected: ${lastNode}`);

  win.onRestyle(() => {
    for (const box of [tlBox, trBox, blBox, brBox]) {
      (box as any).style = { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } };
    }
    (counterBox as any).style = host.theme().body;
    (fpsBox as any).style = host.theme().body;
    bar.restyle();
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    unsubMonitor();
    monitor.destroy();
    tree.destroy();
  });

  win.focus();
}
