/**
 * TR-808 ASCII Renderer — generates the visual representation.
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
// Box-drawing characters
// ---------------------------------------------------------------------------

const BOX = {
  tl: "╔", tr: "╗", bl: "╚", br: "╝",
  h: "═", v: "║",
  t: "╦", b: "╩", l: "╠", r: "╣", x: "╬",
  // Single-line variants for inner divisions
  stl: "┌", str: "┐", sbl: "└", sbr: "┘",
  sh: "─", sv: "│",
  st: "┬", sb: "┴", sl: "├", sr: "┤", sx: "┼",
};

const KNOB_CHARS = ["○", "◐", "●"]; // low, mid, high
const STEP_ON = "█";
const STEP_OFF = "░";
const STEP_CURSOR = "▶";
const ACCENT_ON = "▲";
const ACCENT_OFF = "△";

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function knobChar(value: number, max: number): string {
  const ratio = value / max;
  if (ratio < 0.33) return KNOB_CHARS[0];
  if (ratio < 0.66) return KNOB_CHARS[1];
  return KNOB_CHARS[2];
}

function knobBar(value: number, max: number, width: number): string {
  const filled = Math.round((value / max) * width);
  return "▮".repeat(filled) + "▯".repeat(width - filled);
}

function padCenter(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}

function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

export function renderTR808(engine: TR808Engine, width: number, height: number): string {
  const lines: string[] = [];
  const safeWidth = Number.isFinite(width) ? Math.floor(width) : 80;
  const safeHeight = Number.isFinite(height) ? Math.floor(height) : 24;
  const w = Math.max(80, safeWidth);
  const h = Math.max(1, safeHeight);

  // ── Header ──────────────────────────────────────────────
  const title = "R O L A N D    T R - 8 0 8    R H Y T H M   C O M P O S E R";
  lines.push(padCenter(title, w));
  lines.push("═".repeat(w));

  // ── Status bar ──────────────────────────────────────────
  const slot = engine.slot;
  const transport = engine.state === "playing" ? "▶ PLAY" : "■ STOP";
  const tempo = `BPM:${engine.tempo}`;
  const bank = `${slot.bank}${slot.number}`;
  const variation = `VAR:${slot.variation}`;
  const scale = `SCALE:${engine.scaleLabel}`;
  const master = `MASTER:${engine.master}%`;
  const accentLvl = `ACCENT:${engine.accent}%`;
  const statusParts = [transport, tempo, bank, variation, scale, master, accentLvl];
  const statusLine = ` ${statusParts.join("  │  ")} `;
  lines.push(padRight(statusLine, w));
  lines.push("─".repeat(w));

  // ── Instrument grid with step sequencer ─────────────────
  // Each row: [INST] [PARAMS...] │ [16 steps]
  const stepAreaWidth = STEPS * 3 + 1; // "XX " * 16 + border
  const paramAreaWidth = Math.max(20, w - 6 - stepAreaWidth - 3);

  // Header for step numbers
  const stepNums = Array.from({ length: STEPS }, (_, i) =>
    (i + 1).toString().padStart(2, " ")
  ).join(" ");
  const gridHeader = padRight("", 6) + padRight("", paramAreaWidth) + " │ " + stepNums;
  lines.push(gridHeader);
  lines.push("─".repeat(w));

  const currentStep = engine.step;
  const selectedInst = engine.selected;

  for (const inst of INSTRUMENTS) {
    const isSelected = selectedInst === inst.id;
    const marker = isSelected ? "►" : " ";
    const label = `${marker}${inst.shortLabel}`.padEnd(5);

    // Param summary
    const paramParts: string[] = [];
    for (const p of inst.params) {
      const val = engine.getParam(inst.id, p.id);
      paramParts.push(`${p.label}:${knobChar(val, p.max)}`);
    }
    const paramStr = padRight(paramParts.join(" "), paramAreaWidth);

    // Steps
    const steps = engine.getSteps(inst.id);
    const stepChars = Array.from({ length: STEPS }, (_, i) => {
      const active = steps[i];
      const isCursor = engine.state === "playing" && i === currentStep;
      if (isCursor && active) return "▓▓";
      if (isCursor) return "▒▒";
      if (active) return STEP_ON + STEP_ON;
      return STEP_OFF + STEP_OFF;
    }).join(" ");

    lines.push(`${label}${paramStr} │ ${stepChars}`);
  }

  // Accent row
  {
    const isAccentSelected = selectedInst === "accent";
    const marker = isAccentSelected ? "►" : " ";
    const label = `${marker}AC `.padEnd(5);
    const paramStr = padRight(`LVL:${knobBar(engine.accent, 100, 10)} ${engine.accent}%`, paramAreaWidth);
    const accentSteps = engine.getSteps("accent");
    const stepChars = Array.from({ length: STEPS }, (_, i) => {
      const active = accentSteps[i];
      const isCursor = engine.state === "playing" && i === currentStep;
      if (isCursor && active) return ACCENT_ON + ACCENT_ON;
      if (isCursor) return "▒▒";
      if (active) return ACCENT_ON + " ";
      return ACCENT_OFF + " ";
    }).join(" ");
    lines.push(`${label}${paramStr} │ ${stepChars}`);
  }

  lines.push("─".repeat(w));

  // ── Playhead position indicator ─────────────────────────
  if (engine.state === "playing" && currentStep >= 0) {
    const offset = 6 + paramAreaWidth + 3;
    const pos = offset + currentStep * 3;
    const cursor = " ".repeat(pos) + "▲▲";
    lines.push(cursor);
  } else {
    lines.push("");
  }

  // ── Controls footer ─────────────────────────────────────
  lines.push("─".repeat(w));
  const controls = [
    "[SPACE] play/stop",
    "[1-9,0,−,=] select inst",
    "[F1-F8] pattern",
    "[←→] step cursor",
  ];
  lines.push(` ${controls.join("  ")}`);
  const controls2 = [
    "[a/z] tempo ±5",
    "[v] variation",
    "[b] bank",
    "[p] preset",
    "[c] clear",
    "[s] scale",
  ];
  lines.push(` ${controls2.join("  ")}`);

  // Pad or trim to height
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
    `TR-808 ${engine.state === "playing" ? "▶" : "■"}`,
    `${engine.tempo}bpm`,
    `${slot.bank}${slot.number}-${slot.variation}`,
    instCounts.join(" ") || "(empty)",
  ].join(" │ ");
}
