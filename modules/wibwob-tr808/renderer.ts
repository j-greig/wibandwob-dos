/**
 * TR-808 ASCII Renderer — generates the visual representation.
 *
 * Design philosophy: don't mimic hardware chrome in ASCII (it always
 * looks broken). Instead, use what terminals are good at: colour-coded
 * text, clean alignment, and dense information display.
 *
 * The real TR-808's iconic features that DO translate to terminal:
 *   - 16-step grid with 4 colour-coded groups of 4
 *   - Instrument rows with clear labels
 *   - Transport state prominent at top
 *   - Knob positions as visual indicators
 *
 * Pure function: takes engine state → returns string content.
 */

import {
  type InstrumentId,
  type TR808Engine,
  INSTRUMENTS,
  STEPS,
} from "./engine.js";

// ---------------------------------------------------------------------------
// Visual constants — colour tags for blessed
// ---------------------------------------------------------------------------

// Step group colours matching the real TR-808 button colours
const GROUP_COLOURS = [
  "red",      // steps 1-4
  "yellow",   // steps 5-8
  "yellow",   // steps 9-12
  "white",    // steps 13-16
] as const;

function stepColour(stepIdx: number): string {
  return GROUP_COLOURS[Math.floor(stepIdx / 4)] ?? "white";
}

// Step characters
const STEP_ON  = "\u2588\u2588"; // ██
const STEP_OFF = "\u2591\u2591"; // ░░
const ACCENT_ON  = "\u25B2 ";    // ▲
const ACCENT_OFF = "\u25BD ";    // ▽

// Knob display — 9-level for finer resolution
const KNOB_CHARS = ["\u25CB", "\u25D4", "\u25D1", "\u25D5", "\u25CF"]; // ○ ◔ ◑ ◕ ●

function knobChar(value: number, max: number): string {
  const idx = Math.min(4, Math.floor((value / Math.max(1, max)) * 5));
  return KNOB_CHARS[idx] ?? "\u25CB";
}

function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

function padCenter(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

function bar(value: number, max: number, width: number): string {
  const filled = Math.round((value / Math.max(1, max)) * width);
  return "\u25AE".repeat(filled) + "\u25AF".repeat(Math.max(0, width - filled));
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
  const currentStep = engine.step;
  const selectedInst = engine.selected;
  const isPlaying = engine.state === "playing";

  // ── HEADER: Title ─────────────────────────────────────────────
  const title = "T R - 8 0 8   R H Y T H M   C O M P O S E R";
  lines.push(`{bold}${padCenter(title, w)}{/bold}`);

  // ── TRANSPORT BAR ─────────────────────────────────────────────
  const stateCol = isPlaying ? "green" : "gray";
  const stateIcon = isPlaying ? "\u25B6" : "\u25A0";
  const stateLbl = isPlaying ? "PLAY" : "STOP";
  const tempo = `{white-fg}${engine.tempo}{/white-fg} BPM`;
  const pattern = `{cyan-fg}${slot.bank}${slot.number}-${slot.variation}{/cyan-fg}`;
  const scale = `{gray-fg}${engine.scaleLabel}{/gray-fg}`;
  const swing = engine.swing !== 50 ? `  SWG:{white-fg}${engine.swing}%{/white-fg}` : "";
  const audioTag = audioEnabled ? "  {green-fg}\u266B ON{/green-fg}" : "  {gray-fg}\u266B --{/gray-fg}";
  const masterBar = `VOL:${bar(engine.master, 100, 8)}`;
  const accentBar = `ACC:${bar(engine.accent, 100, 8)}`;

  lines.push("");
  lines.push(`  {${stateCol}-fg}${stateIcon} ${stateLbl}{/${stateCol}-fg}  ${tempo}  ${pattern}  ${scale}${swing}${audioTag}    ${masterBar}  ${accentBar}`);
  lines.push("");

  // ── STEP GRID: column headers with colour-coded groups ────────
  // Calculate layout widths
  const labelW = 5;   // "►BD "
  const paramAreaW = Math.min(40, Math.max(16, w - labelW - STEPS * 4 - 8));
  const stepStartCol = labelW + paramAreaW + 3; // " | "

  // Step number header with group colours
  let stepHeader = " ".repeat(labelW + paramAreaW) + " \u2502 ";
  for (let i = 0; i < STEPS; i++) {
    const col = stepColour(i);
    const num = String(i + 1).padStart(2, " ");
    stepHeader += `{${col}-fg}${num}{/${col}-fg} `;
  }
  lines.push(stepHeader);

  // Thin separator
  const sepW = labelW + paramAreaW;
  lines.push(" ".repeat(sepW) + " \u2502 " + "{gray-fg}" + "\u2500".repeat(STEPS * 3) + "{/gray-fg}");

  // ── INSTRUMENT ROWS ───────────────────────────────────────────
  for (const inst of INSTRUMENTS) {
    const isSelected = selectedInst === inst.id;
    const isMuted = engine.isMuted(inst.id);
    const isSoloed = engine.isSoloed(inst.id);

    // Label with selection marker — keep tags outside padRight
    const marker = isSelected ? "\u25B6" : " ";
    const muteFlag = isSoloed ? "S" : isMuted ? "M" : " ";
    const labelPlain = `${marker}${inst.shortLabel.padEnd(2)}${muteFlag}`;
    // Colourise the whole label
    const labelCol = isSelected ? "cyan" : "white";
    const muteFlagCol = isSoloed ? "{yellow-fg}S{/yellow-fg}" : isMuted ? "{red-fg}M{/red-fg}" : " ";
    const label = isSelected 
      ? `{cyan-fg}${marker}${inst.shortLabel.padEnd(2)}{/cyan-fg}${muteFlagCol}`
      : ` {white-fg}${inst.shortLabel.padEnd(2)}{/white-fg}${muteFlagCol}`;

    // Parameter knobs — build plain text then wrap in single tag
    const paramParts: string[] = [];
    for (const p of inst.params) {
      const val = engine.getParam(inst.id, p.id);
      const k = knobChar(val, p.max);
      paramParts.push(`${p.label}${k}`);
    }
    const paramStr = padRight(paramParts.join(" "), paramAreaW);

    // Step buttons with colour-coded groups
    let stepStr = "";
    const steps = engine.getSteps(inst.id);
    for (let i = 0; i < STEPS; i++) {
      const active = steps[i];
      const col = stepColour(i);
      const isPlayHead = isPlaying && i === currentStep;
      const isEditCur = !isPlaying && i === editCursor;

      if (isPlayHead && active) {
        stepStr += `{white-bg}{black-fg}${STEP_ON}{/black-fg}{/white-bg} `;
      } else if (isPlayHead) {
        stepStr += `{white-bg}{black-fg}${STEP_OFF}{/black-fg}{/white-bg} `;
      } else if (isEditCur && active) {
        stepStr += `{cyan-bg}{black-fg}${STEP_ON}{/black-fg}{/cyan-bg} `;
      } else if (isEditCur) {
        stepStr += `{cyan-fg}\u2592\u2592{/cyan-fg} `;
      } else if (active) {
        stepStr += `{${col}-fg}${STEP_ON}{/${col}-fg} `;
      } else {
        stepStr += `{gray-fg}${STEP_OFF}{/gray-fg} `;
      }
    }

    lines.push(`${label} ${paramStr} \u2502 ${stepStr}`);
  }

  // ── ACCENT ROW ────────────────────────────────────────────────
  {
    const isAccSel = selectedInst === "accent";
    const label = isAccSel 
      ? `{cyan-fg}\u25B6AC{/cyan-fg} `
      : ` {white-fg}AC{/white-fg} `;
    const accentLvl = `LVL${bar(engine.accent, 100, 8)} ${engine.accent}%`;
    const paramStr = padRight(accentLvl, paramAreaW);

    const accentSteps = engine.getSteps("accent");
    let stepStr = "";
    for (let i = 0; i < STEPS; i++) {
      const active = accentSteps[i];
      const col = stepColour(i);
      const isPlayHead = isPlaying && i === currentStep;
      const isEditCur = !isPlaying && i === editCursor;

      if (isPlayHead && active) {
        stepStr += `{white-bg}{black-fg}${ACCENT_ON}{/black-fg}{/white-bg} `;
      } else if (isPlayHead) {
        stepStr += `{white-bg}{black-fg}${ACCENT_OFF}{/black-fg}{/white-bg} `;
      } else if (isEditCur && active) {
        stepStr += `{cyan-fg}${ACCENT_ON}{/cyan-fg} `;
      } else if (isEditCur) {
        stepStr += `{cyan-fg}${ACCENT_OFF}{/cyan-fg} `;
      } else if (active) {
        stepStr += `{${col}-fg}${ACCENT_ON}{/${col}-fg} `;
      } else {
        stepStr += `{gray-fg}${ACCENT_OFF}{/gray-fg} `;
      }
    }
    lines.push(`${label}${paramStr} \u2502 ${stepStr}`);
  }

  // ── PLAYHEAD INDICATOR ────────────────────────────────────────
  lines.push("");
  if (isPlaying && currentStep >= 0) {
    const offset = labelW + paramAreaW + 3 + currentStep * 3;
    lines.push(" ".repeat(offset) + "{white-fg}\u25B2\u25B2{/white-fg}");
  } else if (editCursor >= 0) {
    const offset = labelW + paramAreaW + 3 + editCursor * 3;
    lines.push(" ".repeat(offset) + "{cyan-fg}\u25B2\u25B2{/cyan-fg}");
  } else {
    lines.push("");
  }

  // ── STEP GROUP LABELS ─────────────────────────────────────────
  let groupLine = " ".repeat(labelW + paramAreaW + 3);
  for (let i = 0; i < STEPS; i++) {
    const col = stepColour(i);
    // Group divider every 4
    if (i > 0 && i % 4 === 0) {
      groupLine += `{gray-fg}\u2502{/gray-fg}`;
    } else {
      groupLine += " ";
    }
    const num = String(i + 1).padStart(2, " ");
    groupLine += `{${col}-fg}${num}{/${col}-fg}`;
  }
  // Don't duplicate — step nums already in header

  // ── KEYBOARD HELP ─────────────────────────────────────────────
  lines.push("");
  lines.push(`  {gray-fg}SPC:play/stop  ENTER:toggle step  \u2190\u2192:cursor  1-0,-,=:instrument  \`:accent  a/z:tempo  v:var  b:bank  p:preset  m:audio{/gray-fg}`);

  // Pad to height
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
