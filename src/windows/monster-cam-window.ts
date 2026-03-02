/**
 * Monster Cam window — live ASCII face view from webcam.
 * F01: face detection + grayscale ASCII render.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { MonsterCamService } from "../services/monster-cam-service.js";
import type { WindowManager } from "../core/window-manager.js";

// Grayscale ASCII density ramp (dark → light)
const RAMP = " .:-=+*#%@";
const RAMP_LEN = RAMP.length;

function grayToChar(g: number): string {
  return RAMP[Math.floor((g / 255) * (RAMP_LEN - 1))];
}

interface Deps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
}

export function openMonsterCamWindow(deps: Deps): void {
  const { screen, windowManager } = deps;

  const frame = windowManager.createFrame("Monster Cam", "monster-cam");

  // Canvas fills the window body
  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 1, // leave 1 row for status
    style: theme().body,
    tags: false,
  });

  // Status bar
  const status = blessed.box({
    parent: frame.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: theme().header,
    content: " Starting...",
    tags: false,
  });

  let hasFace   = false;
  let hasHands  = false;
  let handCount = 0;
  let hasPose   = false;
  let fps       = 0;

  const svc = new MonsterCamService();

  svc.on("ready", () => {
    status.setContent(" Webcam ready");
    screen.render();
  });

  svc.on("error", (err) => {
    status.setContent(` Error: ${err.message}`);
    screen.render();
  });

  svc.on("frame", (f) => {
    hasFace   = f.hasFace;
    hasHands  = f.hasHands;
    handCount = f.handCount;
    hasPose   = f.hasPose;
    fps       = f.fps;

    const w = Math.max(1, Number(canvas.width));
    const h = Math.max(1, Number(canvas.height));
    const srcW = f.w;
    const srcH = f.h;

    // Render ASCII from grayscale, scaling src to canvas size
    const rows: string[] = [];
    for (let cy = 0; cy < h; cy++) {
      let row = "";
      const sy = Math.floor((cy / h) * srcH);
      for (let cx = 0; cx < w; cx++) {
        const sx = Math.floor((cx / w) * srcW);
        row += grayToChar(f.gray[sy * srcW + sx] ?? 128);
      }
      rows.push(row);
    }

    // Face bbox overlay — box-drawing outline
    if (hasFace) {
      const [bx, by, bw, bh] = f.bbox;
      const cx0 = Math.max(0, Math.round((bx / srcW) * w));
      const cy0 = Math.max(0, Math.round((by / srcH) * h));
      const cx1 = Math.min(w - 1, Math.round(((bx + bw) / srcW) * w));
      const cy1 = Math.min(h - 1, Math.round(((by + bh) / srcH) * h));

      const setChar = (ry: number, rx: number, ch: string) => {
        if (ry >= 0 && ry < rows.length && rx >= 0) {
          const r = [...rows[ry]];
          if (rx < r.length) r[rx] = ch;
          rows[ry] = r.join("");
        }
      };

      // Corners
      setChar(cy0, cx0, "┌"); setChar(cy0, cx1, "┐");
      setChar(cy1, cx0, "└"); setChar(cy1, cx1, "┘");
      // Top + bottom edges
      for (let x = cx0 + 1; x < cx1; x++) {
        setChar(cy0, x, "─");
        setChar(cy1, x, "─");
      }
      // Left + right edges
      for (let y = cy0 + 1; y < cy1; y++) {
        setChar(y, cx0, "│");
        setChar(y, cx1, "│");
      }
    }

    const detections = [
      hasFace              ? "FACE"                      : "·",
      hasHands             ? `HANDS(${handCount})`       : "·",
      hasPose              ? "POSE"                      : "·",
    ].join(" ");
    canvas.setContent(rows.join("\n"));
    status.setContent(` ${detections} | ${fps}fps | q close`);
    screen.render();
  });

  svc.start();

  frame.describeState = () => ({
    appType:   "monster-cam",
    summary:   `Monster Cam — face:${hasFace} hands:${handCount} pose:${hasPose} @ ${fps}fps`,
    hasFace,
    hasHands,
    handCount,
    hasPose,
    fps,
  });

  frame.cleanup = () => svc.stop();

  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    safeSetStyle(status, theme().header);
  };

  // q to close
  canvas.key(["q", "escape"], () => windowManager.closeWindow(frame.id));
  canvas.focus();

  frame.focus = () => {
    windowManager.focusWindow(frame);
    canvas.focus();
  };

  windowManager.registerWindow(frame);
  frame.focus();
}
