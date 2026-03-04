/**
 * Plasma Engine — animated colour-field generator for TUI screensavers.
 *
 * Pure maths — no blessed, no IO. Produces character+colour frames
 * from layered sine-wave plasma fields. Each "mood" defines wave
 * parameters, a character brightness ramp, and a colour palette.
 *
 * Output modes:
 *   - plain: character-only (░▒▓█) — works in any terminal
 *   - emoji: colour-square emoji (🟥🟦🟩) — wide but saturated
 *   - ansi:  ▀ half-block with fg/bg truecolour — double vertical res
 *
 * Follows the FramePlayer interface from animation-service.ts.
 */

import type { FramePlayer } from "./animation-service.js";

// ── Mood definitions ───────────────────────────────────────

export interface PlasmaMood {
  name: string;
  /** Wave frequency coefficients — more = tighter pattern */
  freq: readonly [number, number, number, number];
  /** Time increment per frame — higher = faster drift */
  speed: number;
  /** Maximum text displacement in cells for primer-smear mode */
  displacement: number;
  /** Character brightness ramp for plain mode */
  chars: string;
  /** Emoji palette for emoji mode */
  emoji: readonly string[];
  /** RGB gradient stops for ANSI truecolour mode */
  gradient: readonly [number, number, number][];
}

export const PLASMA_MOODS: readonly PlasmaMood[] = [
  {
    name: "circuit",
    freq: [1.5, 1.2, 0.8, 1.3],
    speed: 0.08,
    displacement: 3,
    chars: " ·∙░▒▓",
    emoji: ["⬛", "🟦", "🟦", "🟩", "🟩", "⬜"],
    gradient: [[0,0,0],[0,20,80],[0,100,160],[0,180,160],[0,255,120],[200,255,220]],
  },
  {
    name: "void",
    freq: [0.8, 0.6, 0.5, 0.9],
    speed: 0.04,
    displacement: 2,
    chars: " ·∙░▒▓█",
    emoji: ["⬛", "⬛", "🟦", "🟦", "🟪", "🟪", "⬜"],
    gradient: [[0,0,0],[5,0,20],[20,0,60],[60,0,120],[120,20,180],[200,100,255],[255,200,255]],
  },
  {
    name: "chaos",
    freq: [2.2, 1.8, 1.5, 2.0],
    speed: 0.18,
    displacement: 8,
    chars: " ░▒▓█▓▒░",
    emoji: ["🟥", "🟥", "🟧", "🟨", "🟨", "⬜", "🟧", "🟥"],
    gradient: [[0,0,0],[120,20,0],[220,80,0],[255,160,0],[255,240,80],[255,255,200],[255,160,0]],
  },
  {
    name: "aurora",
    freq: [1.2, 1.0, 0.7, 1.1],
    speed: 0.06,
    displacement: 4,
    chars: " ·∙░▒▓█",
    emoji: ["⬛", "🟦", "🟩", "🟩", "⬜", "🟩", "🟦"],
    gradient: [[10,0,30],[0,20,80],[0,180,160],[0,255,120],[180,255,200],[255,255,255],[0,255,120]],
  },
  {
    name: "sunset",
    freq: [1.4, 1.0, 0.9, 1.2],
    speed: 0.07,
    displacement: 5,
    chars: " ·∙░▒▓█",
    emoji: ["🟥", "🟧", "🟧", "🟨", "🟨", "🟪", "🟪"],
    gradient: [[10,0,30],[80,0,60],[180,20,40],[240,80,20],[255,160,20],[255,220,80],[200,100,180]],
  },
  {
    name: "acid",
    freq: [1.8, 1.4, 1.2, 1.6],
    speed: 0.12,
    displacement: 7,
    chars: " ·░▒▓█▓░",
    emoji: ["⬛", "🟩", "🟩", "🟨", "🟨", "⬜", "🟩", "⬛"],
    gradient: [[0,0,0],[0,40,0],[0,140,20],[40,220,40],[180,255,80],[240,255,160],[220,255,80]],
  },
  {
    name: "deep-space",
    freq: [0.9, 0.7, 0.6, 1.0],
    speed: 0.035,
    displacement: 3,
    chars: " ·∙░▒▓█",
    emoji: ["⬛", "⬛", "🟪", "🟦", "🟪", "⬜", "🟪"],
    gradient: [[0,0,0],[5,0,20],[20,0,60],[60,0,120],[120,20,180],[200,100,255],[255,255,255]],
  },
  {
    name: "chrome",
    freq: [1.1, 0.9, 0.8, 1.0],
    speed: 0.04,
    displacement: 2,
    chars: " ·∙░▒▓█",
    emoji: ["⬛", "⬛", "⬜", "⬜", "⬜", "⬜", "⬛"],
    gradient: [[0,0,0],[20,20,30],[60,60,80],[120,130,150],[180,190,210],[220,230,245],[255,255,255]],
  },
] as const;

export const moodNames = PLASMA_MOODS.map(m => m.name);

export function getMood(name: string): PlasmaMood {
  return PLASMA_MOODS.find(m => m.name === name) ?? PLASMA_MOODS[0]!;
}

// ── Render modes ───────────────────────────────────────────

export type PlasmaRenderMode = "plain" | "emoji" | "ansi";

export const RENDER_MODES: readonly PlasmaRenderMode[] = ["plain", "emoji", "ansi"];

// ── Core plasma math ───────────────────────────────────────

function plasmaValue(x: number, y: number, t: number, w: number, h: number, tuning: PlasmaTuning): number {
  const [f1, f2, f3, f4] = tuning.freq;
  const cx = (x / w) * Math.PI * 2;
  const cy = (y / h) * Math.PI * 2;

  let v = 0;
  v += Math.sin(cx * f1 + t * 1.00);
  v += Math.sin(cy * f2 + t * 0.79);
  v += Math.sin((cx + cy) * f3 + t * 1.31);
  v += Math.sin(Math.sqrt((cx - Math.PI) ** 2 + (cy - Math.PI) ** 2) * f4 + t * 0.61);
  v += Math.sin(cx * f1 * 0.5 - cy * f2 * 0.7 + t * 1.07) * 0.5;

  return (v / 4.5 + 1) / 2; // normalise to 0..1
}

// ── Colour helpers ─────────────────────────────────────────

function lerpColour(stops: readonly [number, number, number][], t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const idx = t * n;
  const lo = Math.floor(idx);
  const hi = Math.min(n, lo + 1);
  const f = idx - lo;
  return [
    Math.round(stops[lo]![0] * (1 - f) + stops[hi]![0] * f),
    Math.round(stops[lo]![1] * (1 - f) + stops[hi]![1] * f),
    Math.round(stops[lo]![2] * (1 - f) + stops[hi]![2] * f),
  ];
}

const RESET = "\x1b[0m";
function ansiFg(r: number, g: number, b: number): string { return `\x1b[38;2;${r};${g};${b}m`; }
function ansiBg(r: number, g: number, b: number): string { return `\x1b[48;2;${r};${g};${b}m`; }

function wrapUnit(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function wrapIndex(value: number, size: number): number {
  const wrapped = value % size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

function derivePlasmaTuning(mood: PlasmaMood, modifiers?: PlasmaModifiers): PlasmaTuning {
  if (!modifiers) {
    return {
      freq: [...mood.freq] as [number, number, number, number],
      speed: mood.speed,
      gradientShift: 0,
    };
  }

  const densityScale = 0.8 + modifiers.density * 0.7;
  const entropyScale = 0.85 + modifiers.entropy * 0.5;
  const dominantBias = (modifiers.dominantRatio - 0.2) * 0.35;

  return {
    freq: mood.freq.map((base, index) => {
      const axisBias = 1 + dominantBias * (index % 2 === 0 ? 1 : -1);
      return base * densityScale * axisBias;
    }) as [number, number, number, number],
    speed: mood.speed * entropyScale,
    gradientShift: (modifiers.dominantRatio - 0.5) * 0.3,
  };
}

// ── Frame renderers ────────────────────────────────────────

function createPrimerTexture(w: number, h: number, primerText: string): string[] {
  const normalized = primerText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sourceLines = normalized.split("\n").map((line) => (line.length > 0 ? line : " "));
  const texture: string[] = [];

  for (let y = 0; y < h; y++) {
    const sourceLine = sourceLines[y % sourceLines.length] ?? " ";
    const rowChars = Array.from(sourceLine);
    const usableChars = rowChars.length > 0 ? rowChars : [" "];
    let row = "";
    for (let x = 0; x < w; x++) {
      row += usableChars[x % usableChars.length] ?? " ";
    }
    texture.push(row);
  }

  return texture;
}

function renderPrimerPlain(
  w: number,
  h: number,
  t: number,
  mood: PlasmaMood,
  tuning: PlasmaTuning,
  primerText: string,
): string {
  const grad = mood.gradient;
  const displacement = mood.displacement;
  const texture = createPrimerTexture(w, h, primerText);
  const rows: string[] = [];

  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const v = plasmaValue(x, y, t, w, h, tuning);
      const dxWave = plasmaValue(x + 17.3, y - 9.1, t * 0.91 + 4.2, w, h, tuning) * 2 - 1;
      const dyWave = plasmaValue(x - 11.7, y + 13.9, t * 1.07 - 2.6, w, h, tuning) * 2 - 1;
      const dx = Math.round(dxWave * displacement);
      const dy = Math.round(dyWave * displacement);
      const sampleY = wrapIndex(y + dy, h);
      const sampleRow = texture[sampleY]!;
      const sampleX = wrapIndex(x + dx, sampleRow.length);
      const ch = sampleRow[sampleX] ?? " ";
      const [r, g, b] = lerpColour(grad, wrapUnit(v + tuning.gradientShift));
      row += `${ansiFg(r, g, b)}${ch}`;
    }
    rows.push(row + RESET);
  }

  return rows.join("\n");
}

function renderPlain(
  w: number,
  h: number,
  t: number,
  mood: PlasmaMood,
  tuning: PlasmaTuning,
  primerText?: string,
): string {
  if (primerText && primerText.trim().length > 0) {
    return renderPrimerPlain(w, h, t, mood, tuning, primerText);
  }

  const chars = mood.chars;
  const grad = mood.gradient;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const v = plasmaValue(x, y, t, w, h, tuning);
      const idx = Math.round(v * (chars.length - 1));
      const ch = chars[Math.max(0, Math.min(chars.length - 1, idx))]!;
      const [r, g, b] = lerpColour(grad, wrapUnit(v + tuning.gradientShift));
      row += `\x1b[38;2;${r};${g};${b}m${ch}`;
    }
    rows.push(row + RESET);
  }
  return rows.join("\n");
}

function renderEmoji(w: number, h: number, t: number, mood: PlasmaMood, tuning: PlasmaTuning): string {
  const palette = mood.emoji;
  const ew = Math.floor(w / 2); // emoji are 2 cols wide
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < ew; x++) {
      const v = plasmaValue(x, y, t, ew, h, tuning);
      const idx = Math.round(v * (palette.length - 1));
      row += palette[Math.max(0, Math.min(palette.length - 1, idx))];
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function renderAnsi(w: number, h: number, t: number, mood: PlasmaMood, tuning: PlasmaTuning): string {
  // ▀ half-block: fg = top pixel, bg = bottom pixel → double vertical res
  const pixelH = h * 2;
  const grad = mood.gradient;
  const rows: string[] = [];
  for (let row = 0; row < h; row++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const vTop = plasmaValue(x, row * 2, t, w, pixelH, tuning);
      const vBot = plasmaValue(x, row * 2 + 1, t, w, pixelH, tuning);
      const [tr, tg, tb] = lerpColour(grad, wrapUnit(vTop + tuning.gradientShift));
      const [br, bg_, bb] = lerpColour(grad, wrapUnit(vBot + tuning.gradientShift));
      line += ansiFg(tr, tg, tb) + ansiBg(br, bg_, bb) + "▀" + RESET;
    }
    rows.push(line);
  }
  return rows.join("\n");
}

/** Render a single plasma frame. */
export function renderPlasmaFrame(
  w: number, h: number, t: number,
  mood: PlasmaMood,
  mode: PlasmaRenderMode,
  modifiers?: PlasmaModifiers,
  primerText?: string,
): string {
  const tuning = derivePlasmaTuning(mood, modifiers);
  switch (mode) {
    case "emoji": return renderEmoji(w, h, t, mood, tuning);
    case "ansi":  return renderAnsi(w, h, t, mood, tuning);
    default:      return renderPlain(w, h, t, mood, tuning, primerText);
  }
}

// ── Mood extraction from text ──────────────────────────────
// Analyse primer / ASCII art text and pick the closest mood.

export interface MoodAnalysis {
  mood: PlasmaMood;
  confidence: number;
  reason: string;
  density: number;
  entropy: number;
  dominantRatio: number;
}

export interface PlasmaModifiers {
  density: number;
  entropy: number;
  dominantRatio: number;
}

interface PlasmaTuning {
  freq: [number, number, number, number];
  speed: number;
  gradientShift: number;
}

export function extractMoodFromText(text: string): MoodAnalysis {
  const lines = text.split("\n");
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const nonSpace = text.replace(/\s/g, "").length;
  const density = totalChars > 0 ? nonSpace / totalChars : 0.5;

  // Character class counts
  const boxDrawing = (text.match(/[┌┐└┘├┤┬┴┼─│╔╗╚╝╠╣╦╩╬═║+\-|]/g) ?? []).length;
  const organicSyms = (text.match(/[~@#*.:,;!?/\\^&%$]/g) ?? []).length;
  const alphaNum = (text.match(/[a-zA-Z0-9]/g) ?? []).length;
  const total = boxDrawing + organicSyms + alphaNum || 1;
  const boxRatio = boxDrawing / total;
  const organicRatio = organicSyms / total;

  // Line variance (entropy proxy)
  const lineLengths = lines.map(l => l.length);
  const avgLen = lineLengths.reduce((s, l) => s + l, 0) / (lineLengths.length || 1);
  const variance = lineLengths.reduce((s, l) => s + Math.abs(l - avgLen), 0) / (lineLengths.length || 1);
  const entropy = Math.min(1, variance / 40);
  const charCounts = new Map<string, number>();
  for (const char of text.replace(/\s/g, "")) {
    charCounts.set(char, (charCounts.get(char) ?? 0) + 1);
  }
  const dominantCount = Math.max(0, ...charCounts.values());
  const dominantRatio = nonSpace > 0 ? dominantCount / nonSpace : 0;

  const makeAnalysis = (moodName: string, confidence: number, reason: string): MoodAnalysis => ({
    mood: getMood(moodName),
    confidence,
    reason,
    density,
    entropy,
    dominantRatio,
  });

  // Map to mood
  if (boxRatio > 0.4) {
    return makeAnalysis("circuit", 0.8, "structured/technical — high box-drawing ratio");
  }
  if (organicRatio > 0.3 && density < 0.3) {
    return makeAnalysis("void", 0.7, "sparse organic — dark void feel");
  }
  if (organicRatio > 0.3 && density > 0.5) {
    return makeAnalysis("chaos", 0.75, "dense organic — chaotic energy");
  }
  if (entropy > 0.6 && density > 0.4) {
    return makeAnalysis("acid", 0.6, "high entropy + dense — acid feel");
  }
  if (alphaNum / total > 0.6 && density > 0.5) {
    return makeAnalysis("sunset", 0.5, "text-heavy — warm tones");
  }
  if (density < 0.2) {
    return makeAnalysis("deep-space", 0.6, "very sparse — cosmic void");
  }
  return makeAnalysis("aurora", 0.4, "mixed content — default aurora");
}

// ── Plasma Player ──────────────────────────────────────────
// Wraps the plasma renderer as a FramePlayer with mood/mode controls.

export interface PlasmaPlayerOptions {
  mood?: string;
  renderMode?: PlasmaRenderMode;
  fps?: number;
  modifiers?: PlasmaModifiers;
  primerText?: string;
  getViewport: () => { width: number; height: number };
  onFrame: (content: string) => void;
  onStatus?: (state: PlasmaStatus) => void;
}

export interface PlasmaStatus {
  mood: string;
  renderMode: PlasmaRenderMode;
  speed: number;
  fps: number;
  modifiers?: PlasmaModifiers;
}

export interface PlasmaPlayer extends FramePlayer {
  setMood(name: string): void;
  setRenderMode(mode: PlasmaRenderMode): void;
  nextMood(): void;
  nextRenderMode(): void;
  readonly mood: PlasmaMood;
  readonly renderMode: PlasmaRenderMode;
}

export function createPlasmaPlayer(opts: PlasmaPlayerOptions): PlasmaPlayer {
  let mood = getMood(opts.mood ?? "aurora");
  let renderMode: PlasmaRenderMode = opts.renderMode ?? "plain";
  const modifiers = opts.modifiers;
  const fps = opts.fps ?? 10;
  let t = 0;
  let paused = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const emitStatus = () => {
    opts.onStatus?.({
      mood: mood.name,
      renderMode,
      speed: derivePlasmaTuning(mood, modifiers).speed,
      fps,
      modifiers,
    });
  };

  const advance = () => {
    if (paused) return;
    const { width, height } = opts.getViewport();
    const w = Math.max(4, width);
    const h = Math.max(2, height);
    const tuning = derivePlasmaTuning(mood, modifiers);
    opts.onFrame(renderPlasmaFrame(w, h, t, mood, renderMode, modifiers, opts.primerText));
    emitStatus();
    t += tuning.speed;
  };

  const play = () => {
    paused = false;
    if (!timer) {
      advance();
      timer = setInterval(advance, 1000 / fps);
    }
  };
  const pause = () => { paused = true; };
  const stop = () => { paused = false; t = 0; if (timer) { clearInterval(timer); timer = null; } };
  const destroy = () => { if (timer) { clearInterval(timer); timer = null; } };

  return {
    play, pause, stop, destroy,
    togglePause() { paused = !paused; return paused; },
    get paused() { return paused; },
    get currentFrame() {
      const speed = derivePlasmaTuning(mood, modifiers).speed;
      return Math.floor(t / Math.max(speed, 0.001));
    },
    get totalFrames() { return -1; },
    get fps() { return fps; },

    setMood(name: string) { mood = getMood(name); t = 0; },
    setRenderMode(mode: PlasmaRenderMode) { renderMode = mode; },
    nextMood() {
      const idx = PLASMA_MOODS.indexOf(mood);
      mood = PLASMA_MOODS[(idx + 1) % PLASMA_MOODS.length]!;
      t = 0;
    },
    nextRenderMode() {
      const idx = RENDER_MODES.indexOf(renderMode);
      renderMode = RENDER_MODES[(idx + 1) % RENDER_MODES.length]!;
    },
    get mood() { return mood; },
    get renderMode() { return renderMode; },
  };
}
