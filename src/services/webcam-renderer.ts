/**
 * webcam-renderer.ts — pure ASCII render functions for webcam frames.
 * No blessed dependency. No window manager. No side effects.
 * Consume via microapp-sdk.ts.
 */
import type { MonsterCamFrame } from "./monster-cam-service.js";
import { renderSkeletonAt, type WebcamCell } from "../core/skeleton-renderer.js";

const RAMP     = " .:-=+*#%@";
const RAMP_LEN = RAMP.length;

const HAND_COLORS: Record<string, string> = { L: "yellow", R: "cyan" };
// Face designs: [eyes, mouth, topDecor?]
// These get stamped into a dynamically-sized box based on the detected face bbox.
const MONSTER_DESIGNS: { eyes: string; mouth: string; ears?: string; color: string }[] = [
  { eyes: "^o^",  mouth: "ω_ω",  color: "magenta" },   // happy
  { eyes: ">_<",  mouth: "▄ ▄",  color: "red"     },   // angry
  { eyes: "@_@",  mouth: "~ ~",  color: "cyan"    },   // dizzy
  { eyes: "*.*",  mouth: "▲ ▲",  color: "green"   },   // alien
  { eyes: "=^=",  mouth: "u u",  ears: "^   ^", color: "yellow" }, // cat
];

function buildMonsterSprite(designIdx: number, w: number, h: number): { lines: string[]; color: string } {
  const d = MONSTER_DESIGNS[designIdx % MONSTER_DESIGNS.length]!;
  const inner = Math.max(3, w - 2);  // inner width (excluding box borders)
  const lines: string[] = [];

  // top border (with optional ears)
  const topBorder = "╔" + "═".repeat(inner) + "╗";
  if (d.ears && w >= 7) {
    const ears = d.ears.padEnd(w, " ").slice(0, w);
    lines.push(ears);
  }
  lines.push(topBorder);

  // content rows: spread features across available height
  const contentRows = Math.max(1, h - 2);
  for (let r = 0; r < contentRows; r++) {
    let text: string;
    const mid = Math.floor(contentRows / 2);
    if (r === Math.floor(mid * 0.4)) {
      // eyes row
      text = padCenter(d.eyes, inner);
    } else if (r === mid) {
      // divider
      text = "─".repeat(inner);
    } else if (r === Math.floor(mid * 1.6)) {
      // mouth row
      text = padCenter(d.mouth, inner);
    } else {
      text = " ".repeat(inner);
    }
    lines.push("║" + text.slice(0, inner) + "║");
  }

  lines.push("╚" + "═".repeat(inner) + "╝");
  return { lines, color: d.color };
}

function padCenter(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  const pad = width - s.length;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + s + " ".repeat(right);
}

// ── Re-export everything consumers need so they only import from webcam-renderer ──
// webcam-renderer is the single facade for all webcam/skeleton/monster-cam rendering.
// microapps should import from microapp-sdk.js which re-exports from here.
export type { WebcamCell, NormalisedLandmarks } from "../core/skeleton-renderer.js";
export { renderSkeletonAt, landmarksFromPreset } from "../core/skeleton-renderer.js";
export { MonsterCamService } from "./monster-cam-service.js";
export type { MonsterCamFrame } from "./monster-cam-service.js";

/** @primitive */
export interface WebcamRenderOptions {
  /** Show ASCII grayscale background. Default false (saves CPU). */
  showBg?: boolean;
  /** Overlay animated monster face sprite. Default false. */
  monsterMode?: boolean;
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

function drawSkeleton(
  grid: WebcamCell[][],
  frame: MonsterCamFrame,
  canvasW: number,
  canvasH: number,
): void {
  const srcW = Math.max(1, frame.w);
  const srcH = Math.max(1, frame.h);
  const landmarks = frame.poseLandmarks.map(([x, y]) => [x / srcW, y / srcH] as [number, number]);
  renderSkeletonAt(grid, landmarks, 0, 0, canvasW, canvasH, "green");
}

function drawMonsterFace(
  grid: WebcamCell[][],
  frame: MonsterCamFrame,
  canvasW: number,
  canvasH: number,
): void {
  const designIdx = Math.floor(frame.ts / 1000) % MONSTER_DESIGNS.length;
  const [bx, by, bw, bh] = frame.bbox;

  // Map bbox to canvas space to get sprite size
  const cx0 = Math.round((bx / frame.w) * canvasW);
  const cy0 = Math.round((by / frame.h) * canvasH);
  const cx1 = Math.round(((bx + bw) / frame.w) * canvasW);
  const cy1 = Math.round(((by + bh) / frame.h) * canvasH);
  const spriteW = Math.max(5, cx1 - cx0);
  const spriteH = Math.max(3, cy1 - cy0);

  const { lines, color } = buildMonsterSprite(designIdx, spriteW, spriteH);

  const startX = cx0;
  const startY = cy0;

  lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch !== " ") setCell(grid, startY + row, startX + col, ch, color);
    }
  });
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
  const { showBg = false, monsterMode = false } = opts;
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

  if (monsterMode && frame.hasFace) {
    drawMonsterFace(grid, frame, w, h);
  }

  // Hand overlays — double-line box, L=yellow R=cyan
  frame.handBoxes.forEach(([bx, by, bw, bh], i) => {
    const label = frame.handLabels[i] ?? "?";
    const color = HAND_COLORS[label] ?? "magenta";
    drawBox(grid, w, h, srcW, srcH, bx, by, bw, bh, "╔", "╗", "╚", "╝", "═", "║", label, color);
  });

  if (frame.hasPose && frame.poseLandmarks.length > 0) {
    drawSkeleton(grid, frame, w, h);
  }

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
