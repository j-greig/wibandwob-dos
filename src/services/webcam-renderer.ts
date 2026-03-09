/**
 * webcam-renderer.ts — pure ASCII render functions for webcam frames.
 * No blessed dependency. No window manager. No side effects.
 * Consume via microapp-sdk.ts.
 */
import type { MonsterCamFrame } from "./monster-cam-service.js";

const RAMP     = " .:-=+*#%@";
const RAMP_LEN = RAMP.length;

const HAND_COLORS: Record<string, string> = { L: "yellow", R: "cyan" };

/** @primitive */
export interface WebcamCell {
  ch: string;
  color?: string;
}

/** @primitive */
export interface WebcamRenderOptions {
  /** Show ASCII grayscale background. Default false (saves CPU). */
  showBg?: boolean;
}

function grayToChar(g: number): string {
  return RAMP[Math.floor((g / 255) * (RAMP_LEN - 1))];
}

function setCell(grid: WebcamCell[][], ry: number, rx: number, ch: string, color?: string): void {
  if (ry >= 0 && ry < grid.length && rx >= 0 && rx < (grid[ry]?.length ?? 0)) {
    grid[ry][rx] = { ch, color };
  }
}

function drawBox(
  grid: WebcamCell[][],
  canvasW: number, canvasH: number,
  srcW: number, srcH: number,
  bx: number, by: number, bw: number, bh: number,
  tl: string, tr: string, bl: string, br: string,
  hz: string, vt: string,
  label: string, color?: string,
): void {
  const cx0 = Math.max(0, Math.round((bx / srcW) * canvasW));
  const cy0 = Math.max(0, Math.round((by / srcH) * canvasH));
  const cx1 = Math.min(canvasW - 1, Math.round(((bx + bw) / srcW) * canvasW));
  const cy1 = Math.min(canvasH - 1, Math.round(((by + bh) / srcH) * canvasH));
  if (cx1 <= cx0 || cy1 <= cy0) return;

  setCell(grid, cy0, cx0, tl, color); setCell(grid, cy0, cx1, tr, color);
  setCell(grid, cy1, cx0, bl, color); setCell(grid, cy1, cx1, br, color);
  for (let x = cx0 + 1; x < cx1; x++) {
    setCell(grid, cy0, x, hz, color);
    setCell(grid, cy1, x, hz, color);
  }
  for (let y = cy0 + 1; y < cy1; y++) {
    setCell(grid, y, cx0, vt, color);
    setCell(grid, y, cx1, vt, color);
  }
  if (label && cy0 + 1 < grid.length && cx0 + 1 < canvasW) {
    setCell(grid, cy0, cx0 + 1, label, color);
  }
}

/**
 * Render a MonsterCamFrame into a Cell grid.
 * Returns Cell[][] sized to (canvasW × canvasH) with all detection overlays applied.
 * No blessed dependency — caller decides how to paint it.
 *
 * @primitive
 */
export function renderWebcamFrame(
  frame: MonsterCamFrame,
  canvasW: number,
  canvasH: number,
  opts: WebcamRenderOptions = {},
): WebcamCell[][] {
  const { showBg = false } = opts;
  const srcW = frame.w;
  const srcH = frame.h;
  const w = Math.max(1, canvasW);
  const h = Math.max(1, canvasH);

  // Build base grid
  const grid: WebcamCell[][] = [];
  for (let cy = 0; cy < h; cy++) {
    const row: WebcamCell[] = [];
    if (showBg) {
      const sy = Math.floor((cy / h) * srcH);
      for (let cx = 0; cx < w; cx++) {
        const sx = Math.floor((cx / w) * srcW);
        row.push({ ch: grayToChar(frame.gray[sy * srcW + sx] ?? 128) });
      }
    } else {
      for (let cx = 0; cx < w; cx++) row.push({ ch: " " });
    }
    grid.push(row);
  }

  // Face overlay — single-line box, white
  if (frame.hasFace) {
    const [bx, by, bw, bh] = frame.bbox;
    drawBox(grid, w, h, srcW, srcH, bx, by, bw, bh, "┌", "┐", "└", "┘", "─", "│", "", "white");
  }

  // Hand overlays — double-line box, L=yellow R=cyan
  frame.handBoxes.forEach(([bx, by, bw, bh], i) => {
    const label = frame.handLabels[i] ?? "?";
    const color = HAND_COLORS[label] ?? "magenta";
    drawBox(grid, w, h, srcW, srcH, bx, by, bw, bh, "╔", "╗", "╚", "╝", "═", "║", label, color);
  });

  return grid;
}

/**
 * Convert a WebcamCell grid to a blessed-tagged string for setContent().
 * Only call this if your target surface is a blessed box with tags:true.
 *
 * @primitive
 */
export function gridToBlessedContent(grid: WebcamCell[][]): string {
  return grid.map(row =>
    row.map(c => c.color ? `{${c.color}-fg}${c.ch}{/}` : c.ch).join("")
  ).join("\n");
}
