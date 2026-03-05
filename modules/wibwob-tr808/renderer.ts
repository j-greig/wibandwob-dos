/**
 * TR-808 ASCII Renderer — generates the visual representation.
 *
 * Faithful to the real Roland TR-808 three-band layout:
 *   Band 1 (top): Title + global controls (tempo, mode, transport)
 *   Band 2 (center): Instrument knob grid — columns per voice
 *   Band 3 (bottom): 16-step sequencer with colour-coded groups
 *
 * Pure function: takes engine state → returns string content.
 * No blessed dependency — could render to any text surface.
 */

import {
  type InstrumentId,
  type TR808Engine,
  INSTRUMENTS,
  STEPS,
} from "./engine.js";

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const STEP_ON  = "██";
const STEP_OFF = "░░";
const STEP_CURSOR_ON  = "▓▓";
const STEP_CURSOR_OFF = "▒▒";
const ACCENT_ON  = "▲▲";
const ACCENT_OFF = "△△";
const KNOB_CHARS = ["○", "◔", "◑", "◕", "●"]; // 5-level knob position

// Step colour groups (in real 808: red 1-4, orange 5-8, yellow 9-12, white 13-16)
const STEP_GROUP_CHARS = ["R", "O", "Y", "W"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function knobChar(value: number, max: number): string {
  const ratio = value / max;
  const idx = Math.min(4, Math.floor(ratio * 5));
  return KNOB_CHARS[idx];
}

function padCenter(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

function bar(value: number, max: number, width: number): string {
  const filled = Math.round((value / max) * width);
  return "▮".repeat(filled) + "▯".repeat(Math.max(0, width - filled));
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function renderTR808(engine: TR808Engine, width: number, height: number, audioEnabled = false): string {
  const lines: string[] = [];
  const safeWidth = Number.isFinite(width) ? Math.floor(width) : 80;
  const safeHeight = Number.isFinite(height) ? Math.floor(height) : 24;
  const w = Math.max(80, safeWidth);

  const slot = engine.slot;
  const currentStep = engine.step;
  const selectedInst = engine.selected;
  const isPlaying = engine.state === "playing";

  // ══════════════════════════════════════════════════════════
  // BAND 1: Title bar + global controls
  // ══════════════════════════════════════════════════════════

  // Title with wood panel sides
  const titleText = " R O L A N D    T R - 8 0 8    R H Y T H M   C O M P O S E R ";
  const woodL = "▐█";
  const woodR = "█▌";
  const innerW = w - woodL.length - woodR.length;
  lines.push(woodL + padCenter(titleText, innerW) + woodR);
  lines.push(woodL + "═".repeat(innerW) + woodR);

  // Transport + global status
  const transport = isPlaying ? " ▶ PLAYING " : " ■ STOPPED ";
  const tempoStr = ` TEMPO: ${engine.tempo} `;
  const bankStr = ` ${slot.bank}${slot.number}-${slot.variation} `;
  const scaleStr = ` ${engine.scaleLabel} `;
  const audioStr = audioEnabled ? " ♪ON " : " ♪-- ";
  const masterStr = ` VOL:${bar(engine.master, 100, 6)} `;
  const accentStr = ` ACC:${bar(engine.accent, 100, 6)} `;

  const statusLine = `${transport}│${tempoStr}│${bankStr}│${scaleStr}│${masterStr}│${accentStr}│${audioStr}`;
  lines.push(woodL + padRight(statusLine, innerW) + woodR);
  lines.push(woodL + "─".repeat(innerW) + woodR);

  // ══════════════════════════════════════════════════════════
  // BAND 2: Instrument grid — each row is one voice
  // ══════════════════════════════════════════════════════════

  // Column widths
  const selectorW = 5;  // "►BD "
  const stepAreaW = STEPS * 3; // "XX " * 16
  const sepW = 3; // " │ "
  const paramW = Math.max(20, innerW - selectorW - stepAreaW - sepW);

  // Step number header
  const stepNums = Array.from({ length: STEPS }, (_, i) => {
    const n = i + 1;
    return n < 10 ? ` ${n}` : `${n}`;
  }).join(" ");
  const groupBar = "  R  R  R  R  O  O  O  O  Y  Y  Y  Y  W  W  W  W";
  lines.push(woodL + " ".repeat(selectorW) + padRight("", paramW) + " │ " + stepNums + " ".repeat(Math.max(0, innerW - selectorW - paramW - sepW - stepAreaW)) + woodR);

  // Instrument rows
  for (const inst of INSTRUMENTS) {
    const isSelected = selectedInst === inst.id;
    const marker = isSelected ? "►" : " ";
    const label = `${marker}${inst.shortLabel} `;

    // Parameter knobs with labels
    const paramParts: string[] = [];
    for (const p of inst.params) {
      const val = engine.getParam(inst.id, p.id);
      paramParts.push(`${p.label}${knobChar(val, p.max)}`);
    }
    const paramStr = padRight(paramParts.join(" "), paramW);

    // Step buttons
    const steps = engine.getSteps(inst.id);
    const stepChars = Array.from({ length: STEPS }, (_, i) => {
      const active = steps[i];
      const isCursor = isPlaying && i === currentStep;
      if (isCursor && active) return STEP_CURSOR_ON;
      if (isCursor) return STEP_CURSOR_OFF;
      if (active) return STEP_ON;
      return STEP_OFF;
    }).join(" ");

    const row = `${label}${paramStr} │ ${stepChars}`;
    lines.push(woodL + padRight(row, innerW) + woodR);
  }

  // Accent row
  {
    const isAccSel = selectedInst === "accent";
    const marker = isAccSel ? "►" : " ";
    const label = `${marker}AC `;
    const paramStr = padRight(`LVL${bar(engine.accent, 100, 8)} ${engine.accent}%`, paramW);
    const accentSteps = engine.getSteps("accent");
    const stepChars = Array.from({ length: STEPS }, (_, i) => {
      const active = accentSteps[i];
      const isCursor = isPlaying && i === currentStep;
      if (isCursor && active) return "▲▲";
      if (isCursor) return STEP_CURSOR_OFF;
      if (active) return "▲ ";
      return "△ ";
    }).join(" ");
    const row = `${label}${paramStr} │ ${stepChars}`;
    lines.push(woodL + padRight(row, innerW) + woodR);
  }

  // ══════════════════════════════════════════════════════════
  // BAND 3: Sequencer footer
  // ══════════════════════════════════════════════════════════

  lines.push(woodL + "─".repeat(innerW) + woodR);

  // Playhead indicator
  if (isPlaying && currentStep >= 0) {
    const offset = selectorW + paramW + sepW + currentStep * 3;
    const cursorLine = " ".repeat(offset) + "▲▲";
    lines.push(woodL + padRight(cursorLine, innerW) + woodR);
  } else {
    lines.push(woodL + " ".repeat(innerW) + woodR);
  }

  // Step group colour indicators
  const groupLine = " ".repeat(selectorW + paramW + sepW) +
    " 1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16";
  lines.push(woodL + padRight(groupLine, innerW) + woodR);

  // Controls
  lines.push(woodL + "═".repeat(innerW) + woodR);
  const ctrl1 = " [SPACE] play/stop  [ENTER] toggle step  [1-0,-,=] instrument  [BKSP] CH  [`] accent";
  const ctrl2 = " [a/z] tempo  [v] var  [b] bank  [F1-8] pattern  [p] preset  [c] clear  [s] scale  [m] mute";
  lines.push(woodL + padRight(ctrl1, innerW) + woodR);
  lines.push(woodL + padRight(ctrl2, innerW) + woodR);
  lines.push(woodL + "═".repeat(innerW) + woodR);

  // Pad to height
  while (lines.length < safeHeight) lines.push("");
  return lines.slice(0, safeHeight).join("\n");
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
    `TR-808 ${engine.state === "playing" ? "▶" : "■"}`,
    `${engine.tempo}bpm`,
    `${slot.bank}${slot.number}-${slot.variation}`,
    instCounts.join(" ") || "(empty)",
  ].join(" │ ");
}
