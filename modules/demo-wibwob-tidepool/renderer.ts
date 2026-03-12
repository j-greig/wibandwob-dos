/**
 * Tide Pool Renderer — unified ASCII display surface.
 *
 * Renders the grid + sidebar content as a single text block.
 * Following the TR-808 pattern: one pure function, engine state → string.
 * No blessed dependency — could render to any text surface.
 *
 * Does NOT draw outer borders, header, or footer — those are SDK parts.
 * Renders only the grid area (left) and sidebar (right).
 */

import { TidePoolEngine, type Era, type TideLevel } from "./engine.js";
import { SPECIES, SPECIES_IDS, MAX_SHANNON, type SpeciesId } from "./species.js";
import { TIDEPOOL_SIDEBAR_WIDTH } from "./layout-constants.js";

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const EMPTY_CELL = "·";
const CELL_SEP = " ";
/** Terminal columns per grid cell: glyph(1) + sep(1) = 2 */
export const CELL_COLS = 2;

/** Tide visualisation glyphs */
const TIDE_GLYPHS: Record<TideLevel, string> = {
  low:  "░░▒░░░",
  mid:  "▒▓▓▓▒▒",
  high: "█████▓",
};

/** Era badge glyphs */
const ERA_BADGES: Record<Era, string> = {
  genesis:     "·GENESIS·",
  bloom:       "✿ BLOOM ✿",
  equilibrium: "⚖ EQUILIB",
  collapse:    "⚠ COLLAPS",
  recovery:    "↻ RECOVER",
};

/** Bar graph characters */
const BAR_FULL = "▓";
const BAR_EMPTY = "░";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

function bar(value: number, max: number, width: number): string {
  if (max <= 0) return BAR_EMPTY.repeat(width);
  const filled = Math.round((value / max) * width);
  return BAR_FULL.repeat(Math.min(filled, width)) + BAR_EMPTY.repeat(Math.max(0, width - filled));
}

/** Render a sparkline of recent values */
function sparkline(values: number[], width: number, maxVal: number): string {
  const chars = " ▁▂▃▄▅▆▇█";
  if (values.length === 0) return " ".repeat(width);
  const slice = values.slice(-width);
  const padded = slice.length < width
    ? new Array(width - slice.length).fill(0).concat(slice)
    : slice;
  return padded.map(v => {
    const ratio = maxVal > 0 ? Math.min(1, v / maxVal) : 0;
    const idx = Math.min(chars.length - 1, Math.floor(ratio * (chars.length - 1)));
    return chars[idx];
  }).join("");
}

// ---------------------------------------------------------------------------
// Tide / Lunar cycle rendering
// ---------------------------------------------------------------------------

/** Moon phase glyphs mapped to tide phase (0→1) */
const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
// Fallback single-width glyphs for blessed (emoji may cause issues)
const MOON_GLYPHS = ["●", "◐", "◑", "◒", "○", "◓", "◔", "◕"];

function renderMoonPhase(phase: number): string {
  const idx = Math.floor(phase * MOON_GLYPHS.length) % MOON_GLYPHS.length;
  return MOON_GLYPHS[idx];
}

/** Render a mini sine wave showing the tide curve with a position marker */
function renderTideCurve(phase: number, width: number): string {
  const chars: string[] = [];
  for (let i = 0; i < width; i++) {
    const p = i / width;
    const val = Math.sin(p * 2 * Math.PI);
    // Map -1..+1 to glyph set
    if (val > 0.5) chars.push("⌃");
    else if (val > 0) chars.push("~");
    else if (val > -0.5) chars.push("~");
    else chars.push("⌄");
  }
  // Mark current position
  const pos = Math.floor(phase * width) % width;
  chars[pos] = "◆";
  return chars.join("");
}

/** Render a tide level bar: low ░░░▒▓████▓▒░░░ high */
function renderTideBar(sine: number, width: number): string {
  // sine is -1..+1, map to 0..1
  const level = (sine + 1) / 2;
  const filled = Math.round(level * width);
  const waterChars = "░▒▓█";
  const result: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      // Gradient: deeper water toward the right
      const depth = i / Math.max(1, filled);
      const ci = Math.min(waterChars.length - 1, Math.floor(depth * waterChars.length));
      result.push(waterChars[ci]);
    } else {
      result.push("·");
    }
  }
  return result.join("");
}

// ---------------------------------------------------------------------------
// Main renderer — grid + sidebar content only
// ---------------------------------------------------------------------------

export function renderTidePool(
  engine: TidePoolEngine,
  width: number,
  height: number,
  shannonHistory: number[],
  highlight: SpeciesId | null,
): string {
  const lines: string[] = [];
  const w = Math.max(60, Math.floor(width));
  const h = Math.max(5, Math.floor(height));

  const sidebarW = TIDEPOOL_SIDEBAR_WIDTH;
  const dividerW = 3; // " │ "
  const gridAreaW = w - sidebarW - dividerW - 2; // 2 for left/right padding

  // Use engine's actual dimensions, clamped to available space
  const gridCellsX = Math.max(5, Math.floor(gridAreaW / CELL_COLS));
  const gridCellsY = Math.max(5, h);
  const renderW = Math.min(engine.width, gridCellsX);
  const renderH = Math.min(engine.height, gridCellsY);

  // Build sidebar content
  const sidebarLines = renderSidebar(engine, sidebarW, shannonHistory, highlight);

  // Render grid rows with sidebar
  for (let y = 0; y < gridCellsY; y++) {
    let gridLine = " ";
    for (let x = 0; x < renderW; x++) {
      const cell = engine.cellAt(x, y);
      if (cell === null) {
        gridLine += EMPTY_CELL;
      } else {
        if (highlight !== null && cell !== highlight) {
          gridLine += "· "; // dim non-highlighted species
        } else {
          gridLine += SPECIES[cell].glyphs[0];
        }
      }
      if (x < renderW - 1) gridLine += CELL_SEP;
    }

    const gridPadded = padRight(gridLine, gridAreaW + 1);
    const sidebar = y < sidebarLines.length ? sidebarLines[y] : "";
    lines.push(gridPadded + " │ " + padRight(sidebar, sidebarW));
  }

  // Pad to height
  while (lines.length < h) lines.push("");
  return lines.slice(0, h).join("\n");
}

// ---------------------------------------------------------------------------
// Header/Status text generators (consumed by SDK parts in index.ts)
// ---------------------------------------------------------------------------

export function headerLeft(engine: TidePoolEngine): string {
  const eraBadge = ERA_BADGES[engine.era] ?? engine.era.toUpperCase();
  const tideVis = TIDE_GLYPHS[engine.tide];
  const moon = renderMoonPhase(engine.tidePhase);
  return `${eraBadge}  ${moon} TIDE ${tideVis}`;
}

export function headerRight(engine: TidePoolEngine, speed: number): string {
  const state = engine.running ? "▶" : "❚❚";
  const seedHex = (engine.seed >>> 0).toString(16).toUpperCase().slice(0, 6);
  return `gen:${engine.generation}  ${state} ${speed}x  seed:${seedHex}`;
}

export function statusLeft(engine: TidePoolEngine): string {
  const dom = engine.dominant;
  const h = engine.shannonDiversity;
  const total = engine.totalPopulation;
  const fillPct = engine.width * engine.height > 0
    ? Math.round((total / (engine.width * engine.height)) * 100) : 0;
  return ` H':${h.toFixed(2)}  dom:${dom ? SPECIES[dom].label : "none"}  fill:${fillPct}%  pop:${total}`;
}

export function statusRight(engine: TidePoolEngine): string {
  const lastEvent = engine.events[engine.events.length - 1];
  return lastEvent ? `${lastEvent.detail.slice(0, 30)} @${lastEvent.generation}` : "";
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function renderSidebar(
  engine: TidePoolEngine,
  width: number,
  shannonHistory: number[],
  highlight: SpeciesId | null,
): string[] {
  const lines: string[] = [];
  const barW = Math.max(4, width - 20); // space for glyph+name+count
  const maxPop = Math.max(1, ...SPECIES_IDS.map(id => engine.populations[id]));

  // -- Species Legend --
  lines.push("── SPECIES ──────────");
  for (const id of SPECIES_IDS) {
    const def = SPECIES[id];
    const pop = engine.populations[id];
    const ext = engine.extinct.has(id);
    const hl = highlight === id ? "▸" : " ";
    if (ext) {
      lines.push(`${hl}${def.glyphs[0]} ${def.label.slice(0, 7).padEnd(7)} ${String(pop).padStart(3)} †`);
    } else {
      lines.push(`${hl}${def.glyphs[0]} ${def.label.slice(0, 7).padEnd(7)} ${String(pop).padStart(3)} ${bar(pop, maxPop, barW)}`);
    }
  }

  lines.push("");

  // -- Biodiversity --
  lines.push("── BIODIVERSITY ─────");
  const h = engine.shannonDiversity;
  lines.push(` H': ${h.toFixed(2)} / ${MAX_SHANNON.toFixed(2)}`);
  lines.push(` ${bar(h, MAX_SHANNON, Math.min(20, width - 2))}`);

  // Shannon sparkline (history over time)
  if (shannonHistory.length > 2) {
    const spark = sparkline(shannonHistory, Math.min(20, width - 2), MAX_SHANNON);
    lines.push(` ${spark}`);
  }

  lines.push("");

  // -- Tide / Lunar Cycle --
  lines.push("── TIDE CYCLE ───────");
  lines.push(` ${renderMoonPhase(engine.tidePhase)} ${renderTideCurve(engine.tidePhase, Math.min(16, width - 8))}`);
  lines.push(` ${renderTideBar(engine.tideSine, Math.min(20, width - 2))}`);
  const tideDir = engine.tideSine > 0 ? "▲ rising" : engine.tideSine < -0.1 ? "▼ falling" : "─ slack";
  lines.push(` ${TIDE_GLYPHS[engine.tide]}  ${tideDir}`);

  lines.push("");

  // -- Ecology --
  lines.push("── ECOLOGY ──────────");
  const dom = engine.dominant;
  if (dom) {
    lines.push(` dominant: ${SPECIES[dom].label}`);
  }

  const total = engine.totalPopulation;
  const area = engine.width * engine.height;
  const fillPct = area > 0 ? Math.round((total / area) * 100) : 0;
  lines.push(` fill: ${fillPct}%  pop: ${total}`);
  lines.push(` extinctions: ${engine.extinct.size}`);

  // Last event
  const lastEvent = engine.events[engine.events.length - 1];
  if (lastEvent) {
    lines.push("");
    lines.push("── EVENT ────────────");
    lines.push(` ${lastEvent.detail.slice(0, width - 2)}`);
    lines.push(` @ gen ${lastEvent.generation}`);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Summary for describeState
// ---------------------------------------------------------------------------

export function summarizeState(engine: TidePoolEngine, speed: number): string {
  const h = engine.shannonDiversity;
  const dom = engine.dominant;
  const state = engine.running ? "running" : "paused";
  return `Tide Pool — gen:${engine.generation} era:${engine.era} H':${h.toFixed(2)} `
    + `dom:${dom ?? "none"} tide:${engine.tide} ${state} ${speed}x`;
}
