/**
 * E026 Demo — live showcase of F05/F06/F07/F03 primitives.
 *
 * Four panels in one window:
 *
 *   TOP-LEFT     TreeWidget (F05) — collapsible file tree, live selection
 *   TOP-RIGHT    Timed counter (F06 createTimer) — ticks every second
 *   BOTTOM-LEFT  Motion demo (F07) — t/r/z keys tween this window
 *   BOTTOM-RIGHT Status — focused tree node + keybinding cheatsheet
 *
 * Keys:
 *   t  — tween window to random position (elasticOut)
 *   r  — reset to centre (easeOutCubic)
 *   z  — size bounce (easeOutCubic → bounceOut)
 *   h  — open AGENTS.md in markdown viewer (F03 toggle demo)
 *   q  — close
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTreeWidget, type TreeNode } from "../../src/core/tree-widget.js";
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";
import { tweenWindowPosition, tweenWindowSize } from "../../src/services/motion-service.js";
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
        ],
      },
      {
        id: "services", label: "services/", expanded: false,
        children: [
          { id: "mdsvc",  label: "markdown-service.ts ← F02" },
          { id: "motion", label: "motion-service.ts   ← F07" },
          { id: "synhl",  label: "syntax-highlight.ts ← F02" },
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
    id: "tests", label: "tests/",
    children: [
      { id: "t1", label: "ansi-utils.test.ts" },
      { id: "t2", label: "markdown-service.test.ts" },
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
  const win = host.createWindow({ title: "E026 Demo", width: 100, height: 32 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  let ticks = 0;
  let lastNode = "—";

  // ── Helper: panel label ───────────────────────────────────────────────────

  function panelLabel(text: string, top: number | string, left: number | string) {
    blessed.box({
      parent: win.body, top, left, width: "shrink", height: 1,
      content: ` ${text} `, tags: true,
      style: { fg: host.theme().titleBarFocused.fg, bg: host.theme().titleBarFocused.bg },
    });
  }

  // ── TOP-LEFT — F05 TreeWidget ─────────────────────────────────────────────

  const tlBox = blessed.box({
    parent: win.body, top: 1, left: 0, width: "50%", height: "50%",
    border: "line",
    style: { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } },
  });
  panelLabel("F05 TreeWidget  (j/k ←/→ Enter)", 0, 0);

  const tree = createTreeWidget(tlBox, { style: host.theme().body });
  tree.setNodes(DEMO_TREE);
  tree.onFocus((node) => { lastNode = node.label; updateStatus(); });
  tree.onSelect((node) => { lastNode = `★ ${node.label}`; updateStatus(); });

  // ── TOP-RIGHT — F06 createTimer ───────────────────────────────────────────

  const trBox = blessed.box({
    parent: win.body, top: 1, right: 0, width: "50%", height: "50%",
    border: "line",
    style: { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } },
    tags: false,
  });
  panelLabel("F06 createTimer  (1s tick)", 0, "50%");

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

  // ── BOTTOM-LEFT — F07 motion/tween ────────────────────────────────────────

  const blBox = blessed.box({
    parent: win.body, bottom: 0, left: 0, width: "50%", height: "50%",
    border: "line",
    style: { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } },
    tags: false,
  });
  panelLabel("F07 motion/tween  (t r z)", "50%", 0);

  blessed.box({
    parent: blBox, top: 1, left: 2, right: 2, bottom: 1,
    tags: false, style: host.theme().body,
    content:
      `\x1b[96m  tweenWindowPosition\x1b[0m\n` +
      `  tweenWindowSize\n\n` +
      `  easings: linear easeIn/Out\n` +
      `  easeInOut cubic elasticOut\n` +
      `  bounceOut — 16ms tick\n\n` +
      `  \x1b[93m  t\x1b[0m  slide to random pos\n` +
      `  \x1b[93m  r\x1b[0m  reset to centre\n` +
      `  \x1b[93m  z\x1b[0m  size bounce`,
  });

  // ── BOTTOM-RIGHT — Status ─────────────────────────────────────────────────

  const brBox = blessed.box({
    parent: win.body, bottom: 0, right: 0, width: "50%", height: "50%",
    border: "line",
    style: { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } },
    tags: false,
  });
  panelLabel("Status", "50%", "50%");

  const statusBox = blessed.box({
    parent: brBox, top: 1, left: 2, right: 2, bottom: 1,
    tags: false, style: host.theme().body,
  });

  function updateStatus() {
    statusBox.setContent(
      `\x1b[96m  selected:\x1b[0m\n  ${lastNode}\n\n` +
      `  \x1b[93m  h\x1b[0m  open AGENTS.md viewer\n` +
      `  \x1b[93m  t\x1b[0m  tween position\n` +
      `  \x1b[93m  r\x1b[0m  reset centre\n` +
      `  \x1b[93m  z\x1b[0m  size bounce\n` +
      `  \x1b[93m  q\x1b[0m  close\n\n` +
      `  \x1b[32m F03 F05 F06 F07 ✓\x1b[0m`
    );
    host.screen.render();
  }
  updateStatus();

  // ── Motion ────────────────────────────────────────────────────────────────

  const wm = host.windows;
  const sw = () => Number(host.screen.width);
  const sh = () => Number(host.screen.height);

  function tweenToRandom() {
    const x = Math.floor(Math.random() * Math.max(1, sw() - 60));
    const y = Math.floor(Math.random() * Math.max(1, sh() - 20));
    tweenWindowPosition(wm, win.id, x, y, 600, "elasticOut");
  }

  function resetCentre() {
    const x = Math.max(0, Math.floor((sw() - 100) / 2));
    const y = Math.max(0, Math.floor((sh() - 32) / 2));
    tweenWindowPosition(wm, win.id, x, y, 400, "easeOutCubic");
  }

  function sizeBounce() {
    tweenWindowSize(wm, win.id, 120, 36, 300, "easeOutCubic");
    setTimeout(() => tweenWindowSize(wm, win.id, 100, 32, 350, "bounceOut"), 350);
  }

  // ── Keys ─────────────────────────────────────────────────────────────────

  const repoRoot = path.resolve(new URL(import.meta.url).pathname, "../../../");
  const agentsPath = path.join(repoRoot, "AGENTS.md");

  win.body.key(["t"], tweenToRandom);
  win.body.key(["r"], resetCentre);
  win.body.key(["z"], sizeBounce);
  win.body.key(["h"], () => host.runCommand("markdown.open", { filePath: agentsPath }));
  win.body.key(["q", "escape"], () => win.close());

  // ── Hooks ─────────────────────────────────────────────────────────────────

  win.describeState(() => ({
    summary: `E026 Demo — ticks:${ticks} selected:${lastNode}`,
  }));

  win.captureText(() => `E026 Demo\nticks: ${ticks}\nselected: ${lastNode}`);

  win.onRestyle(() => {
    for (const box of [tlBox, trBox, blBox, brBox]) {
      (box as any).style = { ...host.theme().body, border: { fg: host.theme().windowBorderUnfocused.fg } };
    }
    (counterBox as any).style = host.theme().body;
    (statusBox as any).style = host.theme().body;
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
    tree.destroy();
  });

  win.focus();
}
