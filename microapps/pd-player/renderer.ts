/**
 * Pd Player ASCII Renderer — pure ANSI colour output.
 *
 * Renders the patch graph as ASCII art with node boxes, connections,
 * transport bar, and waveform preview. Uses raw ANSI escapes.
 */

import type { PdEngine, PdObject, PdConnection, PdPatch } from "./engine.js";

// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

const R = "\x1b[0m";
const B = "\x1b[1m";
const DIM = "\x1b[2m";

const FG = {
  red: "\x1b[91m", green: "\x1b[92m", yellow: "\x1b[93m",
  blue: "\x1b[94m", mag: "\x1b[95m", cyan: "\x1b[96m",
  white: "\x1b[97m", gray: "\x1b[90m", black: "\x1b[30m",
} as const;

const BG = {
  cyan: "\x1b[46m", white: "\x1b[47m", yellow: "\x1b[43m",
  red: "\x1b[41m", blue: "\x1b[44m",
} as const;

/** Visual length stripping ANSI codes */
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
// Object type → colour mapping
// ---------------------------------------------------------------------------

const TYPE_COLOUR: Record<string, string> = {
  "osc~": FG.green,
  "phasor~": FG.green,
  "noise~": FG.yellow,
  "*~": FG.cyan,
  "+~": FG.cyan,
  "-~": FG.cyan,
  "lop~": FG.mag,
  "hip~": FG.mag,
  "clip~": FG.mag,
  "line~": FG.blue,
  "vline~": FG.blue,
  "dac~": FG.red,
  "delwrite~": FG.yellow,
  "delread~": FG.yellow,
  "wrap~": FG.cyan,
  "abs~": FG.cyan,
  "sqrt~": FG.cyan,
  "pow~": FG.cyan,
  "max~": FG.cyan,
  "min~": FG.cyan,
  "msg": FG.white,
  "floatatom": FG.white,
};

function typeColour(type: string): string {
  return TYPE_COLOUR[type] ?? FG.gray;
}

// Category labels for object types
function typeCategory(type: string): string {
  if (type.match(/^(osc~|phasor~|noise~|tabosc4~)$/)) return "SRC";
  if (type.match(/^(\*~|\+~|-~|clip~|wrap~|abs~|sqrt~|pow~|max~|min~)$/)) return "MATH";
  if (type.match(/^(lop~|hip~)$/)) return "FLT";
  if (type.match(/^(line~|vline~)$/)) return "ENV";
  if (type.match(/^(delwrite~|delread~)$/)) return "DLY";
  if (type === "dac~") return "OUT";
  return "CTL";
}

// ---------------------------------------------------------------------------
// Render object box
// ---------------------------------------------------------------------------

function renderObjectBox(obj: PdObject, isSelected: boolean, boxWidth: number): string {
  const argsStr = obj.args.length > 0
    ? " " + obj.args.map(a => String(a)).join(" ")
    : "";
  const label = `${obj.type}${argsStr}`;
  const truncLabel = label.length > boxWidth - 4
    ? label.slice(0, boxWidth - 7) + "..."
    : label;

  const tc = typeColour(obj.type);
  const cat = typeCategory(obj.type);

  if (isSelected) {
    const inner = pad(`${tc}${truncLabel}${R}`, boxWidth - 2);
    return `${BG.cyan}${FG.black}\u250C${"\u2500".repeat(boxWidth - 2)}\u2510${R}\n` +
           `${BG.cyan}${FG.black}\u2502${R}${inner}${BG.cyan}${FG.black}\u2502${R}\n` +
           `${BG.cyan}${FG.black}\u2514${"\u2500".repeat(boxWidth - 2)}\u2518${R} ${DIM}${cat}${R}`;
  }

  const border = tc;
  const inner = pad(`${tc}${truncLabel}${R}`, boxWidth - 2);
  return `${border}\u250C${"\u2500".repeat(boxWidth - 2)}\u2510${R}\n` +
         `${border}\u2502${R}${inner}${border}\u2502${R}\n` +
         `${border}\u2514${"\u2500".repeat(boxWidth - 2)}\u2518${R} ${DIM}${cat}${R}`;
}

// ---------------------------------------------------------------------------
// Render connection as text
// ---------------------------------------------------------------------------

function renderConnectionLine(conn: PdConnection, objects: PdObject[]): string {
  const src = objects.find(o => o.id === conn.sourceId);
  const snk = objects.find(o => o.id === conn.sinkId);
  if (!src || !snk) return "";
  return `${DIM}${FG.gray}  ${src.type}[${conn.sourceOutlet}] \u2500\u2500\u25B6 ${snk.type}[${conn.sinkInlet}]${R}`;
}

// ---------------------------------------------------------------------------
// Waveform mini-display
// ---------------------------------------------------------------------------

function renderWaveform(buffer: Float64Array | null, width: number, height: number): string[] {
  const lines: string[] = [];
  if (!buffer || buffer.length === 0) {
    lines.push(`${DIM}${FG.gray}  (no audio rendered)${R}`);
    return lines;
  }

  const w = Math.max(20, width - 4);
  const h = Math.max(3, height);
  const samplesPerCol = Math.max(1, Math.floor(buffer.length / w));

  // Build min/max per column
  const mins = new Float64Array(w);
  const maxs = new Float64Array(w);
  for (let col = 0; col < w; col++) {
    let mn = 1, mx = -1;
    const start = col * samplesPerCol;
    const end = Math.min(start + samplesPerCol, buffer.length);
    for (let i = start; i < end; i++) {
      if (buffer[i] < mn) mn = buffer[i];
      if (buffer[i] > mx) mx = buffer[i];
    }
    mins[col] = mn;
    maxs[col] = mx;
  }

  // Render rows
  for (let row = 0; row < h; row++) {
    const rowTop = 1 - (row / h) * 2;       // +1 at top
    const rowBot = 1 - ((row + 1) / h) * 2; // -1 at bottom
    let line = "  ";
    for (let col = 0; col < w; col++) {
      const mn = mins[col];
      const mx = maxs[col];
      if (mx >= rowBot && mn <= rowTop) {
        // Signal passes through this cell
        if (row === Math.floor(h / 2)) {
          line += `${FG.green}\u2588${R}`;
        } else {
          line += `${FG.cyan}\u2593${R}`;
        }
      } else if (row === Math.floor(h / 2)) {
        line += `${DIM}${FG.gray}\u2500${R}`;
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function renderPdPlayer(
  engine: PdEngine,
  width: number,
  height: number,
): string {
  const lines: string[] = [];
  const w = Math.max(60, Math.floor(Number.isFinite(width) ? width : 80));
  const h = Math.max(20, Math.floor(Number.isFinite(height) ? height : 30));
  const patch = engine.patch;

  // ── TITLE ─────────────────────────────────────────────────
  lines.push(`${B}${FG.white}${centre("P U R E   D A T A   P L A Y E R", w)}${R}`);
  lines.push("");

  // ── TRANSPORT BAR ─────────────────────────────────────────
  const playing = engine.transport === "playing";
  const rendering = engine.transport === "rendering";
  const stC = playing ? FG.green : rendering ? FG.yellow : FG.gray;
  const stI = playing ? "\u25B6 PLAY" : rendering ? "\u25CF RENDER" : "\u25A0 STOP";
  const patchName = patch.name || "untitled";
  const objCount = patch.objects.length;
  const connCount = patch.connections.length;

  lines.push(
    `  ${stC}${stI}${R}  ${FG.white}${patchName}${R}` +
    `  ${FG.gray}${objCount} objects${R}` +
    `  ${FG.gray}${connCount} connections${R}` +
    `  ${FG.gray}${engine.renderDuration}s${R}`
  );
  lines.push("");

  // ── PATCH GRAPH ───────────────────────────────────────────
  lines.push(`  ${B}${FG.cyan}\u2500\u2500 Patch Graph ${"\u2500".repeat(Math.max(0, w - 18))}${R}`);

  if (patch.objects.length === 0) {
    lines.push(`  ${DIM}${FG.gray}(empty patch \u2014 press [a] to add objects)${R}`);
    lines.push("");
  } else {
    const boxWidth = Math.min(40, Math.max(20, w - 10));

    for (let idx = 0; idx < patch.objects.length; idx++) {
      const obj = patch.objects[idx]!;
      const isSelected = obj.id === engine.selectedObjectId;

      // Object number prefix
      const prefix = `  ${isSelected ? FG.cyan : FG.gray}${String(obj.id).padStart(2)}${R} `;

      const boxLines = renderObjectBox(obj, isSelected, boxWidth).split("\n");
      for (const bl of boxLines) {
        lines.push(prefix + bl);
      }

      // Draw connections FROM this object
      const outConns = engine.getConnectionsFrom(obj.id);
      for (const conn of outConns) {
        lines.push(renderConnectionLine(conn, patch.objects));
      }

      // Connection line to next object if connected
      if (idx < patch.objects.length - 1) {
        const nextObj = patch.objects[idx + 1]!;
        const hasConn = patch.connections.some(
          c => c.sourceId === obj.id && c.sinkId === nextObj.id
        );
        if (hasConn) {
          lines.push(`      ${FG.gray}\u2502${R}`);
          lines.push(`      ${FG.gray}\u25BC${R}`);
        } else {
          lines.push("");
        }
      }
    }
    lines.push("");
  }

  // ── WAVEFORM PREVIEW ──────────────────────────────────────
  const waveHeight = Math.max(3, Math.min(8, h - lines.length - 6));
  lines.push(`  ${B}${FG.green}\u2500\u2500 Waveform ${"\u2500".repeat(Math.max(0, w - 14))}${R}`);
  const waveLines = renderWaveform(engine.audioBuffer, w, waveHeight);
  lines.push(...waveLines);
  lines.push("");

  // ── SIGNAL FLOW SUMMARY ────────────────────────────────────
  if (patch.objects.length > 0) {
    const sources = patch.objects.filter(o => ["osc~", "phasor~", "noise~"].includes(o.type));
    const filters = patch.objects.filter(o => ["lop~", "hip~", "bp~", "vcf~", "clip~"].includes(o.type));
    const math = patch.objects.filter(o => ["*~", "+~", "-~"].includes(o.type));
    const hasDac = patch.objects.some(o => o.type === "dac~");

    const flowParts: string[] = [];
    if (sources.length > 0) flowParts.push(`${FG.green}${sources.map(s => s.type).join("+")}${R}`);
    if (math.length > 0) flowParts.push(`${FG.cyan}${math.length} math${R}`);
    if (filters.length > 0) flowParts.push(`${FG.mag}${filters.map(f => f.type).join("+")}${R}`);
    if (hasDac) flowParts.push(`${FG.red}dac~${R}`);

    if (flowParts.length > 0) {
      lines.push(`  ${DIM}Flow: ${flowParts.join(` ${FG.gray}\u2192${R} `)}${R}`);
      lines.push("");
    }
  }

  // ── KEYBOARD HELP ─────────────────────────────────────────
  lines.push(`  ${FG.gray}SPC:play/stop  r:render  p:preset  \u2191\u2193:select  a:add  d:delete  c:connect  x:clear  q:close${R}`);

  while (lines.length < h) lines.push("");
  return lines.slice(0, h).join("\n");
}

/**
 * Compact state summary for API/agent consumption.
 */
export function summarizeState(engine: PdEngine): string {
  const patch = engine.patch;
  const objTypes = [...new Set(patch.objects.map(o => o.type))];
  return [
    `Pd ${engine.transport === "playing" ? "\u25B6" : "\u25A0"}`,
    patch.name,
    `${patch.objects.length} obj`,
    `${patch.connections.length} conn`,
    objTypes.slice(0, 5).join(",") + (objTypes.length > 5 ? "..." : ""),
  ].join(" \u2502 ");
}
