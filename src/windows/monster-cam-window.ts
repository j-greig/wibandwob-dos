/**
 * Monster Cam window — live ASCII webcam view with overlay detection.
 * b = toggle ASCII background (off by default, saves CPU)
 * q/Esc = close
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { MonsterCamService } from "../services/monster-cam-service.js";
import type { WindowManager } from "../core/window-manager.js";

const RAMP     = " .:-=+*#%@";
const RAMP_LEN = RAMP.length;
const HAND_COLORS: Record<string, string> = { L: "yellow", R: "cyan" };

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

  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 1,
    style: theme().body,
    tags: true,   // enables {color-fg} tags
  });

  const status = blessed.box({
    parent: frame.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: theme().header,
    content: " Starting...  b=bg q=close",
    tags: false,
  });

  let hasFace   = false;
  let hasHands  = false;
  let handCount = 0;
  let hasPose   = false;
  let fps       = 0;
  let lastBbox: [number,number,number,number] = [0,0,0,0];
  let showBg    = false;   // ASCII background off by default

  const svc = new MonsterCamService();

  svc.on("ready", () => { status.setContent(" Ready  b=bg q=close"); screen.render(); });
  svc.on("error", (err) => { status.setContent(` Error: ${err.message}`); screen.render(); });

  svc.on("frame", (f) => {
    hasFace   = f.hasFace;
    hasHands  = f.hasHands;
    handCount = f.handCount;
    hasPose   = f.hasPose;
    fps       = f.fps;
    if (f.hasFace) lastBbox = f.bbox;

    const w    = Math.max(1, Number(canvas.width));
    const h    = Math.max(1, Number(canvas.height));
    const srcW = f.w;
    const srcH = f.h;

    // Each cell: { ch, color? }
    type Cell = { ch: string; color?: string };
    const grid: Cell[][] = [];

    for (let cy = 0; cy < h; cy++) {
      const row: Cell[] = [];
      if (showBg) {
        const sy = Math.floor((cy / h) * srcH);
        for (let cx = 0; cx < w; cx++) {
          const sx = Math.floor((cx / w) * srcW);
          row.push({ ch: grayToChar(f.gray[sy * srcW + sx] ?? 128) });
        }
      } else {
        for (let cx = 0; cx < w; cx++) row.push({ ch: " " });
      }
      grid.push(row);
    }

    const setCell = (ry: number, rx: number, ch: string, color?: string) => {
      if (ry >= 0 && ry < grid.length && rx >= 0 && rx < grid[ry].length) {
        grid[ry][rx] = { ch, color };
      }
    };

    const drawBox = (
      bx: number, by: number, bw: number, bh: number,
      tl: string, tr: string, bl: string, br: string,
      hz: string, vt: string,
      label: string, color?: string
    ) => {
      const cx0 = Math.max(0, Math.round((bx / srcW) * w));
      const cy0 = Math.max(0, Math.round((by / srcH) * h));
      const cx1 = Math.min(w - 1, Math.round(((bx + bw) / srcW) * w));
      const cy1 = Math.min(h - 1, Math.round(((by + bh) / srcH) * h));
      if (cx1 <= cx0 || cy1 <= cy0) return;
      setCell(cy0, cx0, tl, color); setCell(cy0, cx1, tr, color);
      setCell(cy1, cx0, bl, color); setCell(cy1, cx1, br, color);
      for (let x = cx0 + 1; x < cx1; x++) {
        setCell(cy0, x, hz, color);
        setCell(cy1, x, hz, color);
      }
      for (let y = cy0 + 1; y < cy1; y++) {
        setCell(y, cx0, vt, color);
        setCell(y, cx1, vt, color);
      }
      // Label in top-left interior corner
      if (label && cy0 + 1 < grid.length && cx0 + 1 < w) {
        setCell(cy0, cx0 + 1, label, color);
      }
    };

    // Face — single-line, white
    if (hasFace) {
      const [bx, by, bw, bh] = f.bbox;
      drawBox(bx, by, bw, bh, "┌", "┐", "└", "┘", "─", "│", "", "white");
    }

    // Hands — double-line, L=yellow R=cyan
    f.handBoxes.forEach(([bx, by, bw, bh], i) => {
      const label = f.handLabels[i] ?? "?";
      const color = HAND_COLORS[label] ?? "magenta";
      drawBox(bx, by, bw, bh, "╔", "╗", "╚", "╝", "═", "║", label, color);
    });

    // Render grid to tagged string
    const content = grid.map(row =>
      row.map(c => c.color ? `{${c.color}-fg}${c.ch}{/}` : c.ch).join("")
    ).join("\n");

    const detections = [
      hasFace   ? "FACE"            : "·",
      hasHands  ? `HANDS(${handCount})` : "·",
      hasPose   ? "POSE"            : "·",
    ].join(" ");

    canvas.setContent(content);
    status.setContent(` ${detections} | ${fps}fps | b=${showBg?"bg ON":"bg off"} q=close`);
    screen.render();
  });

  svc.start();

  frame.describeState = () => ({
    appType: "monster-cam",
    summary: `Monster Cam — face:${hasFace} hands:${handCount} pose:${hasPose} @ ${fps}fps`,
    hasFace, hasHands, handCount, hasPose, fps, bbox: lastBbox, showBg,
  });

  frame.cleanup = () => svc.stop();

  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    safeSetStyle(status, theme().header);
  };

  canvas.key(["b"], () => {
    showBg = !showBg;
    status.setContent(` b=${showBg ? "bg ON" : "bg off"} — next frame...`);
    screen.render();
  });
  canvas.key(["q", "escape"], () => windowManager.closeWindow(frame.id));
  canvas.focus();

  frame.focus = () => { windowManager.focusWindow(frame); canvas.focus(); };

  windowManager.registerWindow(frame);
  frame.focus();
}
