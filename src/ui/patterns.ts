/**
 * ui-parts-patterns.ts — Pattern generators and data simulation helpers.
 *
 * Extracted from ui-parts.ts for single-responsibility.
 * Module authors: import from ../../src/services/microapp-sdk.js
 */

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN GENERATORS — reusable animated text fill functions
// ═══════════════════════════════════════════════════════════════════════════

export type PatternGenerator = (w: number, h: number, tick: number) => string[];

/** Shifting block gradient ░▒▓█ */
export const patternBlockGradient: PatternGenerator = (w, h, t) => {
  const chars = "░▒▓█▓▒";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Diagonal hatching ╱╲ */
export const patternDiagonalHatch: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "╱" : "╲";
    lines.push(line);
  }
  return lines;
};

/** Diamond grid of assorted chars */
export const patternDiamondGrid: PatternGenerator = (w, h, t) => {
  const chars = "<>v^*+.o";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Braille dot animation */
export const patternBraille: PatternGenerator = (w, h, t) => {
  const braille = "⠁⠂⠄⡀⢀⠠⠐⠈";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += braille[(x * 3 + y * 7 + t * 2) % braille.length];
    lines.push(line);
  }
  return lines;
};

/** Cross-stitch ┼─│ grid */
export const patternCrossStitch: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      if ((x + t) % 4 === 0 && (y + t) % 3 === 0) line += "┼";
      else if ((y + t) % 3 === 0) line += "─";
      else if ((x + t) % 4 === 0) line += "│";
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
};

/** Sine wave ~-_ */
export const patternWave: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    const phase = Math.floor(Math.sin((y + t) * 0.5) * 3);
    for (let x = 0; x < w; x++) {
      const v = Math.sin((x + phase + t) * 0.4);
      line += v > 0.3 ? "~" : v > -0.3 ? "-" : "_";
    }
    lines.push(line);
  }
  return lines;
};

/** Hash interference #=:.| */
export const patternHashInterference: PatternGenerator = (w, h, t) => {
  const chars = "#=:.|";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += chars[(x * 3 + y * 7 + t) % chars.length];
    lines.push(line);
  }
  return lines;
};

/** Checkerboard ▄▀ */
export const patternCheckerboard: PatternGenerator = (w, h, t) => {
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "▄" : "▀";
    lines.push(line);
  }
  return lines;
};

/** Pipe maze +-|.: */
export const patternPipeMaze: PatternGenerator = (w, h, t) => {
  const c = "+-|.+-|:";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += c[(x * 3 + y * 5 + t) % c.length];
    lines.push(line);
  }
  return lines;
};

/** Braille density field ⣿⣷⣶...⡀ */
export const patternBrailleDensity: PatternGenerator = (w, h, t) => {
  const dots = "⣿⣷⣶⣦⣤⣄⣀⡀ ";
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const d = Math.sin((x + t) * 0.4) * Math.cos((y + t) * 0.3);
      const idx = Math.floor((d + 1) * 0.5 * (dots.length - 1));
      line += dots[Math.max(0, Math.min(dots.length - 1, idx))];
    }
    lines.push(line);
  }
  return lines;
};

/** Concentric rings .,:;!|#@ */
export const patternConcentricRings: PatternGenerator = (w, h, t) => {
  const chars = " .,:;!|#@";
  const lines: string[] = [];
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + ((y - cy) * 2) ** 2);
      const idx = Math.floor(dist + t) % chars.length;
      line += chars[idx];
    }
    lines.push(line);
  }
  return lines;
};

/** All built-in patterns as an ordered array. */
export const PATTERNS: PatternGenerator[] = [
  patternBlockGradient,
  patternDiagonalHatch,
  patternDiamondGrid,
  patternBraille,
  patternCrossStitch,
  patternWave,
  patternHashInterference,
  patternCheckerboard,
  patternPipeMaze,
  patternBrailleDensity,
  patternConcentricRings,
];

// ═══════════════════════════════════════════════════════════════════════════
// DATA SIMULATION HELPERS — fake data for dashboards and demos
// ═══════════════════════════════════════════════════════════════════════════

/** Generate a sine wave array. */
export function sinWave(offset: number, len: number, amp: number, freq: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(amp * Math.sin(freq * (i + offset)));
  return out;
}

/** Generate a random-walk history series. */
export function randHistory(len: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  let v = lo + Math.random() * (hi - lo);
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.5) * (hi - lo) * 0.15;
    v = Math.max(lo, Math.min(hi, v));
    out.push(Math.round(v));
  }
  return out;
}

/** Generate numeric x-axis labels ["0", "1", ...]. */
export function xLabels(len: number): string[] {
  return Array.from({ length: len }, (_, i) => `${i}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOUR HELPERS — ANSI gradient rendering
// ═══════════════════════════════════════════════════════════════════════════

/** Convert HSL (h 0-1, s 0-1, l 0-1) to RGB [0-255, 0-255, 0-255]. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Render a single line of ANSI true-colour gradient blocks. hueStart/hueEnd in degrees 0-360. */
export function ansiGradientLine(width: number, hueStart: number, hueEnd: number): string {
  let line = "";
  for (let i = 0; i < width; i++) {
    const t = i / Math.max(1, width - 1);
    const h = hueStart + t * (hueEnd - hueStart);
    const [r, g, b] = hslToRgb(h / 360, 0.8, 0.5);
    line += `\x1b[38;2;${r};${g};${b}m█`;
  }
  return line + "\x1b[0m";
}
