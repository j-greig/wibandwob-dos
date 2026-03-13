/**
 * TR-808 ASCII Renderer — pure ANSI colour output.
 *
 * Uses raw ANSI escape codes (not blessed tags) so colour works
 * regardless of the host widget's tag parsing setting.
 *
 * Design: clean terminal layout, colour-coded step groups matching
 * the real TR-808 (red, yellow, yellow, white for groups of 4).
 */

import {
  type InstrumentId,
  type TR808Engine,
  INSTRUMENTS,
  STEPS,
} from "./engine.js";

// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

const A = {
  r:   "\x1b[0m",      // reset
  b:   "\x1b[1m",      // bold
  dim: "\x1b[2m",      // dim
  red: "\x1b[91m",     // bright red
  yel: "\x1b[93m",     // bright yellow
  grn: "\x1b[92m",     // bright green
  cyn: "\x1b[96m",     // bright cyan
  wht: "\x1b[97m",     // bright white
  gry: "\x1b[90m",     // gray
  mag: "\x1b[95m",     // magenta
  blk: "\x1b[30m",     // black
  bgW: "\x1b[47m",     // bg white
  bgC: "\x1b[46m",     // bg cyan
  bgR: "\x1b[41m",     // bg red
} as const;

// Step group colours — matching the real TR-808 button colours
const STEP_COL = [A.red, A.yel, A.yel, A.wht] as const;
function sc(i: number) { return STEP_COL[Math.floor(i / 4)] ?? A.wht; }

// Step characters
const ON  = "\u2588\u2588"; // ██
const OFF = "\u2591\u2591"; // ░░
const ACC_ON  = "\u25B2 ";  // ▲
const ACC_OFF = "\u25BD ";  // ▽

// Knob display
const KNOB = ["\u25CB", "\u25D4", "\u25D1", "\u25D5", "\u25CF"]; // ○ ◔ ◑ ◕ ●
function knob(v: number, mx: number) {
  return KNOB[Math.min(4, Math.floor((v / Math.max(1, mx)) * 5))] ?? "\u25CB";
}

function bar(v: number, mx: number, w: number): string {
  const f = Math.round((v / Math.max(1, mx)) * w);
  return "\u25AE".repeat(f) + "\u25AF".repeat(Math.max(0, w - f));
}

/** Strip ANSI escapes to get visual width */
function vlen(s: string): number { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }
/** Pad to visual width w, accounting for ANSI codes */
function pad(s: string, w: number): string {
  const vw = vlen(s);
  if (vw >= w) return s; // don't truncate — ANSI codes make raw length misleading
  return s + " ".repeat(w - vw);
}
function centre(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  const l = Math.floor((w - s.length) / 2);
  return " ".repeat(l) + s + " ".repeat(w - s.length - l);
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function renderTR808(
  engine: TR808Engine,
  width: number,
  height: number,
  audioEnabled = false,
  editCursor = -1,
): string {
  const lines: string[] = [];
  const w = Math.max(80, Math.floor(Number.isFinite(width) ? width : 80));
  const h = Math.max(20, Math.floor(Number.isFinite(height) ? height : 24));

  const slot = engine.slot;
  const cur = engine.step;
  const sel = engine.selected;
  const playing = engine.state === "playing";

  // ── TITLE ─────────────────────────────────────────────────
  lines.push(`${A.b}${A.wht}${centre("T R - 8 0 8   R H Y T H M   C O M P O S E R", w)}${A.r}`);
  lines.push("");

  // ── TRANSPORT BAR ─────────────────────────────────────────
  const stC = playing ? A.grn : A.gry;
  const stI = playing ? "\u25B6 PLAY" : "\u25A0 STOP";
  const aud = audioEnabled ? `${A.grn}\u266B ON${A.r}` : `${A.gry}\u266B --${A.r}`;
  lines.push(
    `  ${stC}${stI}${A.r}  ${A.wht}${engine.tempo}${A.r} ${A.gry}BPM${A.r}` +
    `  ${A.cyn}${slot.bank}${slot.number}-${slot.variation}${A.r}` +
    `  ${A.gry}${engine.scaleLabel}${A.r}` +
    (engine.swing !== 50 ? `  SWG:${A.wht}${engine.swing}%${A.r}` : "") +
    `  ${aud}` +
    `    VOL:${bar(engine.master, 100, 8)}` +
    `  ACC:${bar(engine.accent, 100, 8)}`
  );
  lines.push("");

  // ── COLUMN LAYOUT ─────────────────────────────────────────
  const lblW = 5;
  const stepW = STEPS * 3; // "XX " * 16
  const paramW = Math.min(45, Math.max(16, w - lblW - stepW - 8));

  // Step number header with group colours
  let hdr = " ".repeat(lblW + paramW) + ` ${A.gry}\u2502${A.r} `;
  for (let i = 0; i < STEPS; i++) {
    hdr += `${sc(i)}${String(i + 1).padStart(2)}${A.r} `;
  }
  lines.push(hdr);

  // Thin separator under step numbers
  lines.push(" ".repeat(lblW + paramW) + ` ${A.gry}\u2502${A.r} ` +
    `${A.gry}${"\u2500".repeat(stepW)}${A.r}`);

  // ── INSTRUMENT ROWS ───────────────────────────────────────
  for (const inst of INSTRUMENTS) {
    const isSel = sel === inst.id;
    const isMuted = engine.isMuted(inst.id);
    const isSoloed = engine.isSoloed(inst.id);

    // Label
    const mk = isSel ? `${A.cyn}\u25B6` : " ";
    const nm = isSel ? `${A.cyn}${inst.shortLabel.padEnd(2)}${A.r}` : `${A.wht}${inst.shortLabel.padEnd(2)}${A.r}`;
    const mf = isSoloed ? `${A.yel}S${A.r}` : isMuted ? `${A.red}M${A.r}` : " ";
    const label = `${mk}${nm}${mf}`;

    // Params
    const pp: string[] = [];
    for (const p of inst.params) {
      pp.push(`${A.gry}${p.label}${A.r}${knob(engine.getParam(inst.id, p.id), p.max)}`);
    }
    const params = pad(pp.join(" "), paramW);

    // Steps with group colours
    let steps = "";
    const stArr = engine.getSteps(inst.id);
    for (let i = 0; i < STEPS; i++) {
      const on = stArr[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;

      if (isHead && on)       steps += `${A.bgW}${A.blk}${ON}${A.r} `;
      else if (isHead)        steps += `${A.bgW}${A.blk}${OFF}${A.r} `;
      else if (isEdit && on)  steps += `${A.bgC}${A.blk}${ON}${A.r} `;
      else if (isEdit)        steps += `${A.cyn}\u2592\u2592${A.r} `;
      else if (on)            steps += `${sc(i)}${ON}${A.r} `;
      else                    steps += `${A.gry}${OFF}${A.r} `;
    }

    lines.push(`${label} ${params} ${A.gry}\u2502${A.r} ${steps}`);
  }

  // ── ACCENT ROW ────────────────────────────────────────────
  {
    const isSel = sel === "accent";
    const mk = isSel ? `${A.cyn}\u25B6` : " ";
    const nm = isSel ? `${A.cyn}AC${A.r}` : `${A.wht}AC${A.r}`;
    const label = `${mk}${nm} `;
    const params = pad(`LVL${bar(engine.accent, 100, 8)} ${engine.accent}%`, paramW);

    const acSteps = engine.getSteps("accent");
    let steps = "";
    for (let i = 0; i < STEPS; i++) {
      const on = acSteps[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;

      if (isHead && on)       steps += `${A.bgW}${A.blk}${ACC_ON}${A.r} `;
      else if (isHead)        steps += `${A.bgW}${A.blk}${ACC_OFF}${A.r} `;
      else if (isEdit && on)  steps += `${A.cyn}${ACC_ON}${A.r} `;
      else if (isEdit)        steps += `${A.cyn}${ACC_OFF}${A.r} `;
      else if (on)            steps += `${sc(i)}${ACC_ON}${A.r} `;
      else                    steps += `${A.gry}${ACC_OFF}${A.r} `;
    }

    lines.push(`${label}${params} ${A.gry}\u2502${A.r} ${steps}`);
  }

  // ── PLAYHEAD / CURSOR ─────────────────────────────────────
  lines.push("");
  const cursorOffset = lblW + paramW + 3;
  if (playing && cur >= 0) {
    lines.push(" ".repeat(cursorOffset + cur * 3) + `${A.wht}\u25B2\u25B2${A.r}`);
  } else if (editCursor >= 0) {
    lines.push(" ".repeat(cursorOffset + editCursor * 3) + `${A.cyn}\u25B2\u25B2${A.r}`);
  } else {
    lines.push("");
  }

  // ── GROUP DIVIDERS (visual) ───────────────────────────────
  let groupLine = " ".repeat(cursorOffset);
  for (let g = 0; g < 4; g++) {
    const col = STEP_COL[g]!;
    const start = g * 4 + 1;
    const end = g * 4 + 4;
    groupLine += `${col}${start}-${end}${A.r}`;
    if (g < 3) groupLine += `${A.gry}  \u2502  ${A.r}`;
  }
  lines.push(groupLine);

  // ── KEYBOARD HELP ─────────────────────────────────────────
  lines.push("");
  lines.push(`  ${A.gry}SPC:play/stop  ENTER:toggle  \u2190\u2192:cursor  1-0,-,=:inst  \`:accent  a/z:tempo  v:var  b:bank  p:preset  m:audio${A.r}`);

  while (lines.length < h) lines.push("");
  return lines.slice(0, h).join("\n");
}

/**
 * Compact state summary for API/agent consumption.
 */
export function summarizeState(engine: TR808Engine): string {
  const slot = engine.slot;
  const instCounts: string[] = [];
  for (const inst of INSTRUMENTS) {
    const count = engine.getSteps(inst.id).filter(Boolean).length;
    if (count > 0) instCounts.push(`${inst.shortLabel}:${count}`);
  }
  const accentCount = engine.getSteps("accent").filter(Boolean).length;
  if (accentCount > 0) instCounts.push(`AC:${accentCount}`);

  return [
    `TR-808 ${engine.state === "playing" ? "\u25B6" : "\u25A0"}`,
    `${engine.tempo}bpm`,
    `${slot.bank}${slot.number}-${slot.variation}`,
    instCounts.join(" ") || "(empty)",
  ].join(" \u2502 ");
}
