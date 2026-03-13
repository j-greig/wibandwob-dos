/**
 * Plasma Window — animated colour-field screensaver.
 *
 * Layout matches Terrain Lab: header, canvas + info panel, status bar.
 * Keyboard controls cycle mood, render mode, and pause.
 *
 * Two entry points:
 *   openPlasmaWindow(deps)           — default mood
 *   openPlasmaWindow(deps, { mood }) — specific mood (e.g. synesthetic)
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { theme } from "../core/theme/resolver.js";
import {
  applyRect,
  createRestyleBundle,
  createStack,
  createRow,
  createNodePart,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createRule,
} from "../core/ui-parts.js";
import {
  createPlasmaPlayer,
  moodNames,
  RENDER_MODES,
  type PlasmaModifiers,
  type PlasmaRenderMode,
} from "../services/plasma-engine.js";
import type { BaseWindowDeps } from "./generative-windows.js";

// ANSI colour codes for sidebar
const A = {
  r:   "\x1b[0m",
  b:   "\x1b[1m",
  dim: "\x1b[2m",
  cyn: "\x1b[96m",
  grn: "\x1b[92m",
  yel: "\x1b[93m",
  wht: "\x1b[97m",
  gry: "\x1b[90m",
  mag: "\x1b[95m",
  red: "\x1b[91m",
  blu: "\x1b[94m",
} as const;

export interface PlasmaWindowOptions {
  mood?: string;
  renderMode?: PlasmaRenderMode;
  primerName?: string;
  primerText?: string;
  reason?: string;
  modifiers?: PlasmaModifiers;
}

export function openPlasmaWindow(
  deps: BaseWindowDeps,
  options?: PlasmaWindowOptions,
): void {
  const initialMood = options?.mood ?? "aurora";
  const initialMode = options?.renderMode ?? "plain";
  const primerName = options?.primerName;
  const primerText = options?.primerText;
  const reason = options?.reason;
  const primerPreview = primerText
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);

  const frame = deps.windowManager.createFrame("Plasma", "plasma" as any);

  // Canvas — left side, rendered by the player
  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 0, height: 0,
    style: theme().body,
  });

  // Info panel
  const infoBlock = createTextBlock(frame.body, { paddingLeft: 1, paddingTop: 0 });
  const header = createHeaderBar(frame.body);
  const divider = createRule(frame.body, { axis: "vertical" });
  const statusBar = createStatusBar(frame.body);

  let infoText = "";
  let currentSpeed = 0;
  let fullscreen = false;
  let savedRect: { top: number; left: number; width: number; height: number } | null = null;

  const readViewport = () => {
    const w = Math.max(4, Number(canvas.width) || 40);
    const h = Math.max(2, Number(canvas.height) || 15);
    return { width: w, height: h };
  };

  const player = createPlasmaPlayer({
    mood: initialMood,
    renderMode: initialMode,
    modifiers: options?.modifiers,
    primerText,
    fps: 10,
    getViewport: readViewport,
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
    onStatus: (s) => {
      currentSpeed = s.speed;
      header.update({
        left: `Plasma: ${s.mood}`,
        right: s.renderMode.toUpperCase(),
      });

      // ANSI colour sidebar helpers
      const sep = `  ${A.gry}${"─".repeat(22)}${A.r}`;
      const label = (icon: string, text: string) => `  ${A.cyn}${icon} ${text}${A.r}`;
      const key = (k: string, desc: string) => `  ${A.yel}${k.padEnd(4)}${A.gry}${desc}${A.r}`;
      const bar = (v: number, mx: number, w: number) => {
        const f = Math.round((v / Math.max(0.001, mx)) * w);
        return `${A.cyn}${"▮".repeat(Math.min(f, w))}${A.gry}${"▯".repeat(Math.max(0, w - f))}${A.r}`;
      };

      // Mood colours
      const moodCols: Record<string, string> = {
        circuit: A.grn, void: A.gry, chaos: A.red, aurora: A.cyn,
        sunset: A.yel, acid: A.grn, "deep-space": A.blu, chrome: A.wht,
      };
      const moodCol = moodCols[s.mood] ?? A.wht;

      // Mood list with active
      const moodList = moodNames.map(m => {
        const active = m === s.mood;
        const col = moodCols[m] ?? A.wht;
        return active
          ? `  ${col}\u25B6 ${A.b}${m}${A.r}`
          : `  ${A.gry}  ${m}${A.r}`;
      }).join("\n");

      // Render mode picker
      const renderLine = RENDER_MODES.map(rm => {
        const active = rm === s.renderMode;
        return active
          ? `${A.wht}${A.b}[${rm.toUpperCase()}]${A.r}`
          : `${A.gry} ${rm} ${A.r}`;
      }).join(" ");

      // Source info (if from primer)
      const srcLines: string[] = [];
      if (primerName) srcLines.push(`  ${A.gry}source  ${A.wht}${primerName}${A.r}`);
      if (reason) srcLines.push(`  ${A.gry}reason  ${A.wht}${reason}${A.r}`);

      const infoLines = [
        "",
        label("\u2248", "MOOD"),
        moodList,
        sep,
        label("\u25A3", "RENDER"),
        `  ${renderLine}`,
        sep,
        label("\u2699", "ENGINE"),
        `  ${A.gry}speed${A.r} ${bar(s.speed, 0.12, 10)} ${A.wht}${s.speed.toFixed(3)}${A.r}`,
        `  ${A.gry}smear${A.r} ${bar(player.mood.displacement, 8, 10)} ${A.wht}${player.mood.displacement}${A.r}`,
        `  ${A.gry}fps${A.r}   ${A.wht}${s.fps}${A.r}`,
        ...(srcLines.length ? [sep, label("\u2197", "SOURCE"), ...srcLines] : []),
        sep,
        label("\u2328", "CONTROLS"),
        key("m", "next mood"),
        key("r", "render mode"),
        key("p", player.paused ? "resume" : "pause"),
        key("s", "save capture"),
        key("f", "fullscreen"),
        sep,
        label("\u2261", "ABOUT"),
        `  ${A.gry}Procedural colour-field${A.r}`,
        `  ${A.gry}animation engine with${A.r}`,
        `  ${A.gry}displacement blur and${A.r}`,
        `  ${A.gry}phase-shifted waves.${A.r}`,
      ];
      infoText = infoLines.join("\n");
      (infoBlock.node as any).setContent(infoText);
      statusBar.update({
        left: "m:mood  r:render  p:pause  s:save  f:fullscreen",
        right: `${s.mood} \u2502 ${s.renderMode} \u2502 ${s.speed.toFixed(3)}`,
      });
      deps.onStateChanged?.();
    },
  });

  const canvasPart = createNodePart(canvas, {
    restyle: () => { canvas.style = theme().body; },
  });

  const bodyColumns = createRow(frame.body, [
    { key: "canvas", basis: "3fr", part: canvasPart },
    { key: "divider", basis: 1, part: divider },
    { key: "info", basis: "1fr", part: infoBlock },
  ] as const);

  const root = createStack(frame.body, [
    { key: "header", basis: 1, part: header },
    { key: "body", basis: "1fr", part: bodyColumns },
    { key: "status", basis: 1, part: statusBar },
  ]);

  const doLayout = () => {
    const w = Math.max(1, Number(frame.body.width) || 0);
    const h = Math.max(1, Number(frame.body.height) || 0);
    if (fullscreen) {
      // Bypass root.layout() entirely — it calls node.show() on all children.
      // Instead position canvas directly and leave chrome nodes hidden.
      applyRect(canvas, { top: 0, left: 0, width: w, height: h });
    } else {
      root.layout({ top: 0, left: 0, width: w, height: h });
    }
  };

  const saveFrame = () => {
    const text = canvas.getContent();
    if (!text) return;
    const dir = path.join(process.cwd(), "scratch", "captures");
    fs.mkdirSync(dir, { recursive: true });
    const name = `plasma_${player.mood.name}_${player.renderMode}_${Date.now()}.txt`;
    fs.writeFileSync(path.join(dir, name), text, "utf8");
    statusBar.update({ left: `saved: ${name}` });
    deps.screen.render();
  };

  // ── Fullscreen toggle ──────────────────────────────────────────────────────
  // Approach: pause animation → mutate geometry → wait for blessed to settle
  // → manually hide/show chrome nodes → relayout → resume.
  // Do NOT use visible() callbacks in the stack — they run during resizeWindow's
  // internal refresh() call while the element tree is mid-mutation.
  const chromeNodes = () => [header.node, statusBar.node, divider.node, infoBlock.node];

  const toggleFullscreen = () => {
    const windowId = frame.id;
    const wasPaused = player.paused;

    // 1. Stop animation to prevent screen.render() firing during geometry changes
    if (!wasPaused) player.togglePause();

    fullscreen = !fullscreen;

    if (fullscreen) {
      savedRect = {
        top:    Number(frame.frame.top),
        left:   Number(frame.frame.left),
        width:  Number(frame.frame.width),
        height: Number(frame.frame.height),
      };
      deps.windowManager.moveWindow(windowId, 0, 0);
      deps.windowManager.resizeWindow(windowId, deps.screen.cols, deps.screen.rows);
    } else if (savedRect) {
      deps.windowManager.moveWindow(windowId, savedRect.left, savedRect.top);
      deps.windowManager.resizeWindow(windowId, savedRect.width, savedRect.height);
    }

    // 2. Let blessed finish processing resize events, then hide/show chrome
    //    and relayout — all before resuming the animation ticker.
    setTimeout(() => {
      for (const node of chromeNodes()) {
        fullscreen ? node.hide() : node.show();
      }
      doLayout();
      deps.screen.render();
      // 3. Resume only if we paused it here (don't unpause a manually-paused window)
      if (!wasPaused) player.togglePause();
    }, 50);
  };

  const keyTargets = [frame.frame, frame.body, canvas, frame.titleBar].filter(Boolean) as blessed.Widgets.BlessedElement[];
  for (const el of keyTargets) {
    el.key(["m"], () => player.nextMood());
    el.key(["r"], () => player.nextRenderMode());
    el.key(["p"], () => player.togglePause());
    el.key(["s"], saveFrame);
    el.key(["f"], toggleFullscreen);
  }

  frame.frame.on("resize", doLayout);

  frame.describeState = () => ({
    appType: "plasma" as const,
    summary: `Plasma screensaver — ${player.mood.name} mood, ${player.renderMode} render.`,
    mood: player.mood.name,
    renderMode: player.renderMode,
    speed: currentSpeed,
    paused: player.paused,
    primerName,
    primerPreview,
    reason,
  });
  frame.captureText = () => `${canvas.getContent()}\n\n${infoText}`;
  frame.cleanup = () => {
    player.destroy();
    root.destroy();
  };
  frame.setFocusTarget(canvas);
  const restyleBundle = createRestyleBundle([]);
  frame.onRestyle = () => {
    restyleBundle.restyle();
    root.restyle();
  };

  frame.refresh = doLayout;
  deps.windowManager.registerWindow(frame);
  frame.focus();
  doLayout();
  player.play();
}
