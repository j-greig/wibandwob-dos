/**
 * TR-808 ASCII Renderer — pure ANSI colour output.
 *
 * Uses raw ANSI escape codes for colour. Content is set via
 * (display.node).setContent() which bypasses blessed's tag parser
 * and wrapping. ANSI codes render directly in blessed's terminal output.
 *
 * Colour-coded step groups matching the real TR-808:
 *   Group 1 (1-4): red, Group 2 (5-8): orange/yellow,
 *   Group 3 (9-12): yellow, Group 4 (13-16): white
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

const R = "\x1b[0m";       // reset
const B = "\x1b[1m";       // bold
const DIM = "\x1b[2m";     // dim

const FG = {
  red:    "\x1b[91m",  green: "\x1b[92m",  yellow: "\x1b[93m",
  cyan:   "\x1b[96m",  white: "\x1b[97m",  gray:   "\x1b[90m",
  black:  "\x1b[30m",  mag:   "\x1b[95m",
} as const;

const BG = {
  red:    "\x1b[41m",  yellow: "\x1b[43m",
  white:  "\x1b[47m",  cyan:   "\x1b[46m",
} as const;

// Step group colours — matching the real TR-808 button colours
// Using DIFFERENT characters per group to distinguish even without colour
const STEP_GROUP = [
  { fg: FG.red,    bg: BG.red,    on: "\u2588\u2588" },  // ██ solid red
  { fg: FG.yellow, bg: BG.yellow, on: "\u2593\u2593" },  // ▓▓ dark shade yellow
  { fg: FG.yellow, bg: BG.yellow, on: "\u2593\u2593" },  // ▓▓ dark shade yellow
  { fg: FG.white,  bg: BG.white,  on: "\u2592\u2592" },  // ▒▒ medium shade white
] as const;

function sg(i: number) { return STEP_GROUP[Math.floor(i / 4)]!; }

const OFF = "\u2591\u2591"; // ░░ light shade (empty)

// Accent markers
const ACC_ON  = "\u25B2 ";  // ▲
const ACC_OFF = "\u25BD ";  // ▽

// Knob display (phase indicators)
const KNOB = ["\u25CB", "\u25D4", "\u25D1", "\u25D5", "\u25CF"]; // ○ ◔ ◑ ◕ ●
function knob(v: number, mx: number) {
  return KNOB[Math.min(4, Math.floor((v / Math.max(1, mx)) * 5))] ?? "\u25CB";
}

function bar(v: number, mx: number, w: number): string {
  const f = Math.round((v / Math.max(1, mx)) * w);
  return "\u25AE".repeat(f) + "\u25AF".repeat(Math.max(0, w - f));
}

/** Strip ANSI escapes to measure visual width */
function vlen(s: string): number { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }
function pad(s: string, w: number): string {
  const vw = vlen(s);
  return vw >= w ? s : s + " ".repeat(w - vw);
}
function centre(s: string, w: number): string {
  const vw = vlen(s);
  if (vw >= w) return s;
  const l = Math.floor((w - vw) / 2);
  return " ".repeat(l) + s + " ".repeat(w - vw - l);
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
  lines.push(`${B}${FG.white}${centre("T R - 8 0 8   R H Y T H M   C O M P O S E R", w)}${R}`);
  lines.push("");

  // ── TRANSPORT BAR ─────────────────────────────────────────
  const stC = playing ? FG.green : FG.gray;
  const stI = playing ? "\u25B6 PLAY" : "\u25A0 STOP";
  const aud = audioEnabled ? `${FG.green}\u266B ON${R}` : `${FG.gray}\u266B --${R}`;
  lines.push(
    `  ${stC}${stI}${R}  ${FG.white}${engine.tempo}${R} ${FG.gray}BPM${R}` +
    `  ${FG.cyan}${slot.bank}${slot.number}-${slot.variation}${R}` +
    `  ${FG.gray}${engine.scaleLabel}${R}` +
    (engine.swing !== 50 ? `  SWG:${FG.white}${engine.swing}%${R}` : "") +
    `  ${aud}` +
    `    VOL:${bar(engine.master, 100, 8)}` +
    `  ACC:${bar(engine.accent, 100, 8)}`
  );
  lines.push("");

  // ── COLUMN LAYOUT ─────────────────────────────────────────
  const lblW = 5;       // ▶BD M
  const stepW = STEPS * 3;  // "XX " * 16 = 48
  const paramW = Math.min(45, Math.max(16, w - lblW - stepW - 8));

  // Step number header with group colours
  let hdr = " ".repeat(lblW + paramW) + ` ${FG.gray}\u2502${R} `;
  for (let i = 0; i < STEPS; i++) {
    const g = sg(i);
    hdr += `${g.fg}${String(i + 1).padStart(2)}${R} `;
  }
  lines.push(hdr);

  // Thin separator
  lines.push(
    " ".repeat(lblW + paramW) + ` ${FG.gray}\u2502${R} ` +
    `${FG.gray}${"\u2500".repeat(stepW)}${R}`
  );

  // ── INSTRUMENT ROWS ───────────────────────────────────────
  for (const inst of INSTRUMENTS) {
    const isSel = sel === inst.id;
    const isMuted = engine.isMuted(inst.id);
    const isSoloed = engine.isSoloed(inst.id);

    // Label: ▶BD M (5 chars visual)
    const mk = isSel ? `${FG.cyan}\u25B6` : " ";
    const nm = isSel
      ? `${FG.cyan}${inst.shortLabel.padEnd(2)}${R}`
      : `${FG.white}${inst.shortLabel.padEnd(2)}${R}`;
    const mf = isSoloed ? `${FG.yellow}S${R}` : isMuted ? `${FG.red}M${R}` : " ";
    const label = `${mk}${nm}${mf}`;

    // Params with knobs
    const pp: string[] = [];
    for (const p of inst.params) {
      pp.push(`${FG.gray}${p.label}${R}${knob(engine.getParam(inst.id, p.id), p.max)}`);
    }
    const params = pad(pp.join(" "), paramW);

    // Step grid — colour + shape per group
    let steps = "";
    const stArr = engine.getSteps(inst.id);
    for (let i = 0; i < STEPS; i++) {
      const on = stArr[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;
      const g = sg(i);

      if (isHead && on)       steps += `${BG.white}${FG.black}${g.on}${R} `;
      else if (isHead)        steps += `${BG.white}${FG.black}${OFF}${R} `;
      else if (isEdit && on)  steps += `${BG.cyan}${FG.black}${g.on}${R} `;
      else if (isEdit)        steps += `${FG.cyan}\u2592\u2592${R} `;
      else if (on)            steps += `${g.fg}${g.on}${R} `;
      else                    steps += `${FG.gray}${OFF}${R} `;
    }

    lines.push(`${label} ${params} ${FG.gray}\u2502${R} ${steps}`);
  }

  // ── ACCENT ROW ────────────────────────────────────────────
  {
    const isSel = sel === "accent";
    const mk = isSel ? `${FG.cyan}\u25B6` : " ";
    const nm = isSel ? `${FG.cyan}AC${R}` : `${FG.white}AC${R}`;
    const label = `${mk}${nm} `;
    const params = pad(`LVL${bar(engine.accent, 100, 8)} ${engine.accent}%`, paramW);

    const acSteps = engine.getSteps("accent");
    let steps = "";
    for (let i = 0; i < STEPS; i++) {
      const on = acSteps[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;
      const g = sg(i);

      if (isHead && on)       steps += `${BG.white}${FG.black}${ACC_ON}${R} `;
      else if (isHead)        steps += `${BG.white}${FG.black}${ACC_OFF}${R} `;
      else if (isEdit && on)  steps += `${FG.cyan}${ACC_ON}${R} `;
      else if (isEdit)        steps += `${FG.cyan}${ACC_OFF}${R} `;
      else if (on)            steps += `${g.fg}${ACC_ON}${R} `;
      else                    steps += `${FG.gray}${ACC_OFF}${R} `;
    }

    lines.push(`${label}${params} ${FG.gray}\u2502${R} ${steps}`);
  }

  // ── PLAYHEAD / CURSOR ─────────────────────────────────────
  lines.push("");
  const off = lblW + paramW + 3;
  if (playing && cur >= 0) {
    lines.push(" ".repeat(off + cur * 3) + `${FG.white}\u25B2\u25B2${R}`);
  } else if (editCursor >= 0) {
    lines.push(" ".repeat(off + editCursor * 3) + `${FG.cyan}\u25B2\u25B2${R}`);
  } else {
    lines.push("");
  }

  // ── GROUP LABELS ──────────────────────────────────────────
  let grp = " ".repeat(off);
  for (let g = 0; g < 4; g++) {
    const c = STEP_GROUP[g]!.fg;
    grp += `${c}${g * 4 + 1}-${g * 4 + 4}${R}`;
    if (g < 3) grp += `  ${FG.gray}\u2502${R}  `;
  }
  lines.push(grp);

  // ── KEYBOARD HELP ─────────────────────────────────────────
  lines.push("");
  lines.push(`  ${FG.gray}SPC:play/stop  ENTER:toggle  \u2190\u2192:cursor  1-0,-,=:inst  \`:accent  a/z:tempo  v:var  b:bank  p:preset  m:audio${R}`);

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
