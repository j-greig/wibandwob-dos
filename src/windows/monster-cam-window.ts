/**
 * Monster Cam window — live ASCII webcam view with overlay detection.
 * b = toggle ASCII background (off by default, saves CPU)
 * m = toggle monster face sprites
 * q/Esc = close
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { MonsterCamService } from "../services/monster-cam-service.js";
import { renderFiglet } from "../services/figlet-service.js";
import { renderWebcamFrame, gridToBlessedContent } from "../services/webcam-renderer.js";
import type { WindowManager } from "../core/window-manager.js";

interface Deps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  onStateChanged?: () => void;
}

export function openMonsterCamWindow(deps: Deps): void {
  const { screen, windowManager } = deps;

  const frame = windowManager.createFrame("Monster Cam", "monster-cam");

  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 1,
    style: theme().body,
    tags: true,   // enables {color-fg} tags
  });
  const emotionOverlay = blessed.box({
    parent: canvas,
    top: 0,
    left: 0,
    width: 60,
    height: 7,
    style: { fg: "magenta", bg: "black" },
    tags: false,
  });

  // Bottom bar
  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: theme().header,
  });

  const mkBtn = (label: string, right: number, width: number, onClick: () => void) => {
    const btn = blessed.box({
      parent: statusBar,
      top: 0, right, width, height: 1,
      mouse: true, clickable: true,
      content: label,
      style: { ...theme().header, hover: theme().selected },
      tags: false,
    });
    btn.on("click", onClick);
    return btn;
  };

  mkBtn(" [Q] Close ", 0,  11, () => windowManager.closeWindow(frame.id));
  const bgBtn = mkBtn(" [B] BG off", 11, 11, () => toggleBg());
  const monsterBtn = mkBtn(" [M] Monster", 22, 11, () => toggleMonster());

  const status = blessed.box({
    parent: statusBar,
    top: 0, left: 0, right: 33, height: 1,
    style: theme().header,
    content: " Starting...",
    tags: false,
  });

  let hasFace   = false;
  let hasHands  = false;
  let handCount = 0;
  let hasPose   = false;
  let fps       = 0;
  let currentEmotion = "";
  let lastBbox: [number,number,number,number] = [0,0,0,0];
  let showBg = false;
  let monsterMode = false;

  const toggleBg = () => {
    showBg = !showBg;
    bgBtn.setContent(showBg ? " [B] BG on " : " [B] BG off");
    deps.onStateChanged?.();
    screen.render();
  };

  const toggleMonster = () => {
    monsterMode = !monsterMode;
    monsterBtn.setContent(monsterMode ? " [M] Monster*" : " [M] Monster");
    deps.onStateChanged?.();
    screen.render();
  };

  const svc = new MonsterCamService();

  svc.on("ready", () => { status.setContent(" Ready  b=bg m=monster q=close"); screen.render(); });
  svc.on("error", (err) => { status.setContent(` Error: ${err.message}`); screen.render(); });

  svc.on("frame", (f) => {
    hasFace   = f.hasFace;
    hasHands  = f.hasHands;
    handCount = f.handCount;
    hasPose   = f.hasPose;
    fps       = f.fps;
    if (f.hasFace) lastBbox = f.bbox;
    if (f.emotion !== currentEmotion) {
      currentEmotion = f.emotion;
      const figText = renderFiglet(f.emotion.toUpperCase(), "small");
      emotionOverlay.setContent(figText);
    }
    deps.onStateChanged?.();

    const w = Math.max(1, Number(canvas.width));
    const h = Math.max(1, Number(canvas.height));

    const grid    = renderWebcamFrame(f, w, h, { showBg, monsterMode });
    const content = gridToBlessedContent(grid);

    const detections = [
      hasFace   ? "FACE"            : "·",
      hasHands  ? `HANDS(${handCount})` : "·",
      hasPose   ? "POSE"            : "·",
      monsterMode ? "MONSTER" : "·",
    ].join(" ");

    canvas.setContent(content);
    status.setContent(
      ` ${detections} | ${fps}fps | b=${showBg?"bg ON":"bg off"} m=${monsterMode?"monster ON":"monster off"} q=close`
    );
    screen.render();
  });

  svc.start();

  frame.describeState = () => ({
    appType: "monster-cam",
    summary: `Monster Cam — face:${hasFace} hands:${handCount} pose:${hasPose} @ ${fps}fps`,
    hasFace, hasHands, handCount, hasPose, fps, bbox: lastBbox, showBg, monsterMode,
  });

  frame.cleanup = () => svc.stop();

  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    safeSetStyle(status, theme().header);
  };

  for (const el of [canvas, frame.body]) {
    el.key(["b"], () => toggleBg());
    el.key(["m"], () => toggleMonster());
    el.key(["q", "escape"], () => windowManager.closeWindow(frame.id));
  }
  canvas.focus();

  frame.setFocusTarget(canvas);

  windowManager.registerWindow(frame);
  frame.focus();
}
