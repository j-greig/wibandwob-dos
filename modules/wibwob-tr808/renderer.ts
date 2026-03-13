/**
 * TR-808 ASCII Renderer — blessed tag colour output.
 *
 * Uses blessed {colour-fg}/{colour-bg} tags for reliable colour rendering.
 * The host widget MUST have tags:true for this to work.
 *
 * Colour-coded step groups matching the real TR-808:
 *   Group 1 (1-4): red, Group 2 (5-8): yellow,
 *   Group 3 (9-12): yellow, Group 4 (13-16): white
 */

import {
  type InstrumentId,
  type TR808Engine,
  INSTRUMENTS,
  STEPS,
} from "./engine.js";

// ---------------------------------------------------------------------------
// Colour helpers using blessed tags
// ---------------------------------------------------------------------------

const STEP_FG = ["red", "yellow", "yellow", "white"] as const;
const STEP_BG = ["red", "yellow", "yellow", "white"] as const;
function sfg(i: number) { return STEP_FG[Math.floor(i / 4)] ?? "white"; }
function sbg(i: number) { return STEP_BG[Math.floor(i / 4)] ?? "white"; }

// Tag helpers
function fg(col: string, text: string) { return `{${col}-fg}${text}{/${col}-fg}`; }
function bg(col: string, text: string) { return `{${col}-bg}${text}{/${col}-bg}`; }
function bold(text: string) { return `{bold}${text}{/bold}`; }

// Step characters
const ON  = "\u2588\u2588"; // ██
const OFF = "\u2591\u2591"; // ░░
const ACC_ON  = "\u25B2 ";  // ▲
const ACC_OFF = "\u25BD ";  // ▽

// Knob display
const KNOB = ["\u25CB", "\u25D4", "\u25D1", "\u25D5", "\u25CF"];
function knob(v: number, mx: number) {
  return KNOB[Math.min(4, Math.floor((v / Math.max(1, mx)) * 5))] ?? "\u25CB";
}

function bar(v: number, mx: number, w: number): string {
  const f = Math.round((v / Math.max(1, mx)) * w);
  return "\u25AE".repeat(f) + "\u25AF".repeat(Math.max(0, w - f));
}

/** Strip blessed tags to get visual width */
function vlen(s: string): number { return s.replace(/\{[^}]*\}/g, "").length; }
function pad(s: string, w: number): string {
  const vw = vlen(s);
  if (vw >= w) return s;
  return s + " ".repeat(w - vw);
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
  lines.push(bold(centre("T R - 8 0 8   R H Y T H M   C O M P O S E R", w)));
  lines.push("");

  // ── TRANSPORT BAR ─────────────────────────────────────────
  const stC = playing ? "green" : "gray";
  const stI = playing ? "\u25B6 PLAY" : "\u25A0 STOP";
  const aud = audioEnabled ? fg("green", "\u266B ON") : fg("gray", "\u266B --");
  lines.push(
    `  ${fg(stC, stI)}  {white-fg}${engine.tempo}{/white-fg} ${fg("gray", "BPM")}` +
    `  ${fg("cyan", `${slot.bank}${slot.number}-${slot.variation}`)}` +
    `  ${fg("gray", engine.scaleLabel)}` +
    (engine.swing !== 50 ? `  SWG:{white-fg}${engine.swing}%{/white-fg}` : "") +
    `  ${aud}` +
    `    VOL:${bar(engine.master, 100, 8)}` +
    `  ACC:${bar(engine.accent, 100, 8)}`
  );
  lines.push("");

  // ── COLUMN LAYOUT ─────────────────────────────────────────
  const lblW = 5;
  const stepW = STEPS * 3;
  const paramW = Math.min(45, Math.max(16, w - lblW - stepW - 8));

  // Step number header
  let hdr = " ".repeat(lblW + paramW) + ` ${fg("gray", "\u2502")} `;
  for (let i = 0; i < STEPS; i++) {
    hdr += `${fg(sfg(i), String(i + 1).padStart(2))} `;
  }
  lines.push(hdr);
  lines.push(" ".repeat(lblW + paramW) + ` ${fg("gray", "\u2502")} ${fg("gray", "\u2500".repeat(stepW))}`);

  // ── INSTRUMENT ROWS ───────────────────────────────────────
  for (const inst of INSTRUMENTS) {
    const isSel = sel === inst.id;
    const isMuted = engine.isMuted(inst.id);
    const isSoloed = engine.isSoloed(inst.id);

    const mk = isSel ? fg("cyan", "\u25B6") : " ";
    const nm = fg(isSel ? "cyan" : "white", inst.shortLabel.padEnd(2));
    const mf = isSoloed ? fg("yellow", "S") : isMuted ? fg("red", "M") : " ";
    const label = `${mk}${nm}${mf}`;

    const pp: string[] = [];
    for (const p of inst.params) {
      pp.push(`${fg("gray", p.label)}${knob(engine.getParam(inst.id, p.id), p.max)}`);
    }
    const params = pad(pp.join(" "), paramW);

    let steps = "";
    const stArr = engine.getSteps(inst.id);
    for (let i = 0; i < STEPS; i++) {
      const on = stArr[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;

      if (isHead && on)       steps += `{white-bg}{black-fg}${ON}{/black-fg}{/white-bg} `;
      else if (isHead)        steps += `{white-bg}{black-fg}${OFF}{/black-fg}{/white-bg} `;
      else if (isEdit && on)  steps += `{cyan-bg}{black-fg}${ON}{/black-fg}{/cyan-bg} `;
      else if (isEdit)        steps += `${fg("cyan", "\u2592\u2592")} `;
      else if (on)            steps += `{${sbg(i)}-bg}{black-fg}${ON}{/black-fg}{/${sbg(i)}-bg} `;
      else                    steps += `${fg("gray", OFF)} `;
    }

    lines.push(`${label} ${params} ${fg("gray", "\u2502")} ${steps}`);
  }

  // ── ACCENT ROW ────────────────────────────────────────────
  {
    const isSel = sel === "accent";
    const mk = isSel ? fg("cyan", "\u25B6") : " ";
    const nm = fg(isSel ? "cyan" : "white", "AC");
    const label = `${mk}${nm} `;
    const params = pad(`LVL${bar(engine.accent, 100, 8)} ${engine.accent}%`, paramW);

    const acSteps = engine.getSteps("accent");
    let steps = "";
    for (let i = 0; i < STEPS; i++) {
      const on = acSteps[i];
      const isHead = playing && i === cur;
      const isEdit = !playing && i === editCursor;

      if (isHead && on)       steps += `{white-bg}{black-fg}${ACC_ON}{/black-fg}{/white-bg} `;
      else if (isHead)        steps += `{white-bg}{black-fg}${ACC_OFF}{/black-fg}{/white-bg} `;
      else if (isEdit && on)  steps += `${fg("cyan", ACC_ON)} `;
      else if (isEdit)        steps += `${fg("cyan", ACC_OFF)} `;
      else if (on)            steps += `{${sbg(i)}-bg}{black-fg}${ACC_ON}{/black-fg}{/${sbg(i)}-bg} `;
      else                    steps += `${fg("gray", ACC_OFF)} `;
    }

    lines.push(`${label}${params} ${fg("gray", "\u2502")} ${steps}`);
  }

  // ── PLAYHEAD / CURSOR ─────────────────────────────────────
  lines.push("");
  const off = lblW + paramW + 3;
  if (playing && cur >= 0) {
    lines.push(" ".repeat(off + cur * 3) + fg("white", "\u25B2\u25B2"));
  } else if (editCursor >= 0) {
    lines.push(" ".repeat(off + editCursor * 3) + fg("cyan", "\u25B2\u25B2"));
  } else {
    lines.push("");
  }

  // ── GROUP LABELS ──────────────────────────────────────────
  let grp = " ".repeat(off);
  for (let g = 0; g < 4; g++) {
    const c = STEP_FG[g]!;
    grp += fg(c, `${g * 4 + 1}-${g * 4 + 4}`);
    if (g < 3) grp += `  ${fg("gray", "\u2502")}  `;
  }
  lines.push(grp);

  // ── KEYBOARD HELP ─────────────────────────────────────────
  lines.push("");
  lines.push(fg("gray", "  SPC:play/stop  ENTER:toggle  \u2190\u2192:cursor  1-0,-,=:inst  \\`:accent  a/z:tempo  v:var  b:bank  p:preset  m:audio"));

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
