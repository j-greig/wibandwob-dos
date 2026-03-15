/**
 * Dashboard XXL — hypermassive virtual canvas with pannable viewport.
 *
 * Renders a mosaic of figlet typography and animated patterns to a virtual
 * character buffer far larger than the physical terminal (default 800×200).
 * The TUI window is a viewport/porthole that pans across the canvas with
 * arrow keys, WASD, or hjkl.
 *
 * Proof of concept for exhibition-scale rendering: the canvas dimensions
 * are independent of the physical display. In a real exhibition you would
 * stream the full buffer to a wall of screens via xterm.js or similar.
 */

import blessed from "blessed";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { renderFiglet } from "../../src/services/microapp-sdk.js";

// ── virtual canvas ───────────────────────────────────────────

/** A cell is just a character (we skip colour attrs for the PoC) */
type VCanvas = string[][];

function createCanvas(w: number, h: number, fill = " "): VCanvas {
  const c: VCanvas = [];
  for (let y = 0; y < h; y++) {
    c[y] = [];
    for (let x = 0; x < w; x++) c[y]![x] = fill;
  }
  return c;
}

function canvasWidth(c: VCanvas): number {
  return c[0]?.length ?? 0;
}
function canvasHeight(c: VCanvas): number {
  return c.length;
}

/** Blit a block of text lines into the canvas at (ox, oy), clipped. */
function blit(c: VCanvas, ox: number, oy: number, lines: string[]) {
  const cw = canvasWidth(c), ch = canvasHeight(c);
  for (let ly = 0; ly < lines.length; ly++) {
    const cy = oy + ly;
    if (cy < 0 || cy >= ch) continue;
    const line = lines[ly]!;
    for (let lx = 0; lx < line.length; lx++) {
      const cx = ox + lx;
      if (cx < 0 || cx >= cw) continue;
      c[cy]![cx] = line[lx]!;
    }
  }
}

/** Extract a viewport rectangle as renderable string. */
function viewport(c: VCanvas, vx: number, vy: number, vw: number, vh: number): string {
  const cw = canvasWidth(c), ch = canvasHeight(c);
  const lines: string[] = [];
  for (let row = 0; row < vh; row++) {
    const cy = vy + row;
    let line = "";
    for (let col = 0; col < vw; col++) {
      const cx = vx + col;
      if (cy >= 0 && cy < ch && cx >= 0 && cx < cw) {
        line += c[cy]![cx]!;
      } else {
        line += "·";
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ── helpers ──────────────────────────────────────────────────

function figlet(text: string, font = "small"): string {
  return renderFiglet(text, font);
}

// ── pattern generators ───────────────────────────────────────
// Each: (w, h, tick) => string[]

type PatternFn = (w: number, h: number, t: number) => string[];

const patterns: PatternFn[] = [
  // 0: block gradient ░▒▓█
  (w, h, t) => {
    const chars = "░▒▓█▓▒";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
      return line;
    });
  },
  // 1: diagonal hatching
  (w, h, t) =>
    Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "╱" : "╲";
      return line;
    }),
  // 2: diamond chars
  (w, h, t) => {
    const chars = "<>v^*+.o";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
      return line;
    });
  },
  // 3: braille spinner
  (w, h, t) => {
    const braille = "⠁⠂⠄⡀⢀⠠⠐⠈";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += braille[(x * 3 + y * 7 + t * 2) % braille.length];
      return line;
    });
  },
  // 4: cross-stitch
  (w, h, t) =>
    Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) {
        if ((x + t) % 4 === 0 && (y + t) % 3 === 0) line += "┼";
        else if ((y + t) % 3 === 0) line += "─";
        else if ((x + t) % 4 === 0) line += "│";
        else line += " ";
      }
      return line;
    }),
  // 5: sine wave
  (w, h, t) =>
    Array.from({ length: h }, (_, y) => {
      let line = "";
      const phase = Math.floor(Math.sin((y + t) * 0.5) * 3);
      for (let x = 0; x < w; x++) {
        const v = Math.sin((x + phase + t) * 0.4);
        line += v > 0.3 ? "~" : v > -0.3 ? "-" : "_";
      }
      return line;
    }),
  // 6: hash interference
  (w, h, t) => {
    const chars = "#=:.|";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += chars[(x * 3 + y * 7 + t) % chars.length];
      return line;
    });
  },
  // 7: checkerboard ▄▀
  (w, h, t) =>
    Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "▄" : "▀";
      return line;
    }),
  // 8: concentric rings
  (w, h, t) => {
    const chars = " .,:;!|#@";
    const cx = w / 2, cy = h / 2;
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + ((y - cy) * 2) ** 2);
        line += chars[Math.floor(dist + t) % chars.length];
      }
      return line;
    });
  },
  // 9: dense braille density
  (w, h, t) => {
    const dots = "⣿⣷⣶⣦⣤⣄⣀⡀ ";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) {
        const d = Math.sin((x + t) * 0.4) * Math.cos((y + t) * 0.3);
        const idx = Math.floor((d + 1) * 0.5 * (dots.length - 1));
        line += dots[Math.max(0, Math.min(dots.length - 1, idx))];
      }
      return line;
    });
  },
  // 10: pipe maze
  (w, h, t) => {
    const c = "+-|.+-|:";
    return Array.from({ length: h }, (_, y) => {
      let line = "";
      for (let x = 0; x < w; x++) line += c[(x * 3 + y * 5 + t) % c.length];
      return line;
    });
  },
];

// ── mosaic layout ────────────────────────────────────────────

interface MosaicCell {
  /** Fractional position/size in canvas (0..1) */
  x: number; y: number; w: number; h: number;
  type: "figlet" | "pattern";
  text?: string; font?: string;
  patternIdx?: number;
}

const GRID_ROWS = 8;
const GRID_COLS = 6;

function g(row: number, col: number, rs: number, cs: number): { x: number; y: number; w: number; h: number } {
  return { x: col / GRID_COLS, y: row / GRID_ROWS, w: cs / GRID_COLS, h: rs / GRID_ROWS };
}

const mosaicLayout: MosaicCell[] = [
  // Row 0-1: big figlet left, 3 patterns right
  { ...g(0, 0, 2, 3), type: "figlet", text: "SYMBIENT", font: "slant" },
  { ...g(0, 3, 1, 1), type: "pattern", patternIdx: 0 },
  { ...g(0, 4, 1, 1), type: "pattern", patternIdx: 1 },
  { ...g(0, 5, 1, 1), type: "pattern", patternIdx: 2 },
  { ...g(1, 3, 1, 1), type: "pattern", patternIdx: 3 },
  { ...g(1, 4, 1, 1), type: "pattern", patternIdx: 4 },
  { ...g(1, 5, 1, 1), type: "pattern", patternIdx: 5 },

  // Row 2-3: pattern left, big figlet center, patterns right
  { ...g(2, 0, 1, 1), type: "pattern", patternIdx: 6 },
  { ...g(2, 1, 2, 3), type: "figlet", text: "WIBWOB", font: "big" },
  { ...g(2, 4, 1, 1), type: "pattern", patternIdx: 7 },
  { ...g(2, 5, 1, 1), type: "pattern", patternIdx: 8 },
  { ...g(3, 0, 1, 1), type: "pattern", patternIdx: 9 },
  { ...g(3, 4, 1, 1), type: "pattern", patternIdx: 10 },
  { ...g(3, 5, 1, 1), type: "pattern", patternIdx: 0 },

  // Row 4-5: patterns left, big figlet center-right, pattern far right
  { ...g(4, 0, 1, 1), type: "pattern", patternIdx: 1 },
  { ...g(4, 1, 1, 1), type: "pattern", patternIdx: 2 },
  { ...g(4, 2, 2, 3), type: "figlet", text: "DOS", font: "banner3" },
  { ...g(4, 5, 1, 1), type: "pattern", patternIdx: 3 },
  { ...g(5, 0, 1, 1), type: "pattern", patternIdx: 4 },
  { ...g(5, 1, 1, 1), type: "pattern", patternIdx: 5 },
  { ...g(5, 5, 1, 1), type: "pattern", patternIdx: 6 },

  // Row 6-7: figlet left, patterns center, figlet right
  { ...g(6, 0, 2, 2), type: "figlet", text: "BLESSED", font: "small" },
  { ...g(6, 2, 1, 1), type: "pattern", patternIdx: 7 },
  { ...g(6, 3, 1, 1), type: "pattern", patternIdx: 8 },
  { ...g(6, 4, 2, 2), type: "figlet", text: "CONTRIB", font: "small" },
  { ...g(7, 2, 1, 1), type: "pattern", patternIdx: 9 },
  { ...g(7, 3, 1, 1), type: "pattern", patternIdx: 10 },
];

// ── border drawing ───────────────────────────────────────────

function drawBorder(c: VCanvas, ox: number, oy: number, bw: number, bh: number, label?: string) {
  if (bw < 2 || bh < 2) return;
  const cw = canvasWidth(c), ch = canvasHeight(c);

  const set = (cx: number, cy: number, ch2: string) => {
    if (cx >= 0 && cx < cw && cy >= 0 && cy < ch) c[cy]![cx] = ch2;
  };

  // corners
  set(ox, oy, "┌");
  set(ox + bw - 1, oy, "┐");
  set(ox, oy + bh - 1, "└");
  set(ox + bw - 1, oy + bh - 1, "┘");

  // top/bottom
  for (let x = 1; x < bw - 1; x++) {
    set(ox + x, oy, "─");
    set(ox + x, oy + bh - 1, "─");
  }
  // left/right
  for (let y = 1; y < bh - 1; y++) {
    set(ox, oy + y, "│");
    set(ox + bw - 1, oy + y, "│");
  }

  // label
  if (label && bw > 4) {
    const lbl = ` ${label} `;
    for (let i = 0; i < lbl.length && i + 2 < bw - 2; i++) {
      set(ox + 2 + i, oy, lbl[i]!);
    }
  }
}

// ── module setup ─────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dashboard XXL",
    menu: [{ category: "applications", order: 56, label: "Dashboard XXL" }],
    palette: { order: 221, label: "Dashboard XXL" },
    action: () => {
      // Virtual canvas: 10× a typical terminal
      const CANVAS_W = 800;
      const CANVAS_H = 200;
      const canvas = createCanvas(CANVAS_W, CANVAS_H);

      // Pre-render figlet texts (static)
      const figletCache = new Map<string, string[]>();
      for (const cell of mosaicLayout) {
        if (cell.type === "figlet" && cell.text) {
          const key = `${cell.text}|${cell.font}`;
          if (!figletCache.has(key)) {
            figletCache.set(key, figlet(cell.text, cell.font).split("\n"));
          }
        }
      }

      let tick = 0;
      let panX = 0, panY = 0;
      const PAN_STEP = 8;
      const FAST_PAN = 40;

      // Shared file path for the exhibition viewer
      const scratchDir = join(process.cwd(), "scratch");
      try { mkdirSync(scratchDir, { recursive: true }); } catch {}
      const canvasPath = join(scratchDir, "xxl-canvas.txt");

      function exportCanvas() {
        const lines: string[] = [];
        for (let y = 0; y < CANVAS_H; y++) lines.push(canvas[y]!.join(""));
        try { writeFileSync(canvasPath, lines.join("\n"), "utf8"); } catch {}
      }

      function renderCanvas() {
        // Clear
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) canvas[y]![x] = " ";
        }

        // Render each mosaic cell
        for (const cell of mosaicLayout) {
          const ox = Math.floor(cell.x * CANVAS_W);
          const oy = Math.floor(cell.y * CANVAS_H);
          const cw = Math.floor(cell.w * CANVAS_W);
          const ch = Math.floor(cell.h * CANVAS_H);

          // Draw border
          const label = cell.type === "figlet" ? cell.text : `pattern ${cell.patternIdx}`;
          drawBorder(canvas, ox, oy, cw, ch, label);

          // Inner area (1 cell padding for border)
          const iw = cw - 2;
          const ih = ch - 2;
          if (iw < 1 || ih < 1) continue;

          if (cell.type === "figlet") {
            const key = `${cell.text}|${cell.font}`;
            const lines = figletCache.get(key) ?? [cell.text ?? ""];
            // Centre vertically
            const startY = Math.max(0, Math.floor((ih - lines.length) / 2));
            blit(canvas, ox + 1, oy + 1 + startY, lines);
          } else {
            const pIdx = (cell.patternIdx ?? 0) % patterns.length;
            const fn = patterns[pIdx]!;
            const lines = fn(iw, ih, tick);
            blit(canvas, ox + 1, oy + 1, lines);
          }
        }
      }

      // ── TUI window ──────────────────────────────────

      const win = host.createWindow({
        title: "Dashboard XXL",
        width: 140,
        height: 48,
      });

      const body = win.body;
      const screen = host.screen;

      // Status bar
      const statusBar = blessed.box({
        parent: body,
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        tags: true,
        style: { fg: "white", bg: "black" },
      });

      // Viewport display
      const viewBox = blessed.box({
        parent: body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 1,
        tags: false,
        style: { fg: "white", bg: "black" },
      });

      function clampPan() {
        const vw = (viewBox.width as number) || 80;
        const vh = (viewBox.height as number) || 24;
        panX = Math.max(0, Math.min(CANVAS_W - vw, panX));
        panY = Math.max(0, Math.min(CANVAS_H - vh, panY));
      }

      function updateView() {
        const vw = (viewBox.width as number) || 80;
        const vh = (viewBox.height as number) || 24;
        clampPan();
        viewBox.setContent(viewport(canvas, panX, panY, vw, vh));

        const pctX = CANVAS_W > vw ? Math.round((panX / (CANVAS_W - vw)) * 100) : 0;
        const pctY = CANVAS_H > vh ? Math.round((panY / (CANVAS_H - vh)) * 100) : 0;
        statusBar.setContent(
          `{bold} VIRTUAL CANVAS ${CANVAS_W}×${CANVAS_H}{/bold}` +
          `  viewport ${vw}×${vh}` +
          `  pan (${panX},${panY})` +
          `  ${pctX}% across ${pctY}% down` +
          `  {gray-fg}arrows/wasd/hjkl: pan · shift: fast · Home: origin · End: far corner{/gray-fg}`
        );
      }

      // ── keyboard ────────────────────────────────────

      const keyHandler = (_ch: string, key: any) => {
        const fast = key.shift;
        const step = fast ? FAST_PAN : PAN_STEP;

        if (key.name === "left" || key.full === "h" || key.full === "a") panX -= step;
        else if (key.name === "right" || key.full === "l" || key.full === "d") panX += step;
        else if (key.name === "up" || key.full === "k" || key.full === "w") panY -= step;
        else if (key.name === "down" || key.full === "j" || key.full === "s") panY += step;
        else if (key.name === "home") { panX = 0; panY = 0; }
        else if (key.name === "end") { panX = CANVAS_W; panY = CANVAS_H; }
        else if (key.name === "pageup") panY -= (viewBox.height as number || 24);
        else if (key.name === "pagedown") panY += (viewBox.height as number || 24);
        else return;

        clampPan();
        updateView();
        screen.render();
      };

      body.on("keypress", keyHandler);
      (body as any).input = true;
      (body as any).keys = true;

      // ── tick loop ───────────────────────────────────

      renderCanvas();
      exportCanvas();
      updateView();
      screen.render();

      const timer = setInterval(() => {
        tick++;
        renderCanvas();
        exportCanvas();
        updateView();
        screen.render();
      }, 1000);

      // ── lifecycle ───────────────────────────────────

      win.onCleanup(() => {
        clearInterval(timer);
      });

      win.describeState(() => ({
        summary: `Dashboard XXL — virtual ${CANVAS_W}×${CANVAS_H} canvas, viewport at (${panX},${panY}), tick ${tick}`,
        canvasSize: { width: CANVAS_W, height: CANVAS_H },
        pan: { x: panX, y: panY },
        tick,
      }));

      win.captureText(() =>
        `Dashboard XXL — ${CANVAS_W}×${CANVAS_H} virtual canvas — pan (${panX},${panY}) — tick ${tick}`
      );

      win.onRestyle(() => screen.render());

      win.focus();
    },
  });
}
