/**
 * Pd Player ASCII Renderer — pure ANSI colour output.
 *
 * Renders the patch graph as ASCII art with node boxes, connections,
 * transport bar, and waveform preview. Uses raw ANSI escapes.
 *
 * UI features:
 *  - Inlet/outlet port indicators on object boxes
 *  - Connection flow arrows between objects
 *  - Mode indicator (edit / play)
 *  - Selected-object detail panel (connections, params)
 *  - Signal flow summary
 *  - Preset browser hint
 *  - Context-sensitive keyboard help
 */

import type { PdEngine, PdObject, PdConnection, PdPatch, MelodyNote } from "./engine.js";

// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

const R = "\x1b[0m";
const B = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const UNDERLINE = "\x1b[4m";

const FG = {
  red: "\x1b[91m", green: "\x1b[92m", yellow: "\x1b[93m",
  blue: "\x1b[94m", mag: "\x1b[95m", cyan: "\x1b[96m",
  white: "\x1b[97m", gray: "\x1b[90m", black: "\x1b[30m",
} as const;

const BG = {
  cyan: "\x1b[46m", white: "\x1b[47m", yellow: "\x1b[43m",
  red: "\x1b[41m", blue: "\x1b[44m", gray: "\x1b[100m",
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
  "bp~": FG.mag,
  "vcf~": FG.mag,
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
  "sig~": FG.blue,
  "samphold~": FG.cyan,
  "rpole~": FG.mag,
  "rzero~": FG.mag,
  "env~": FG.yellow,
  "snapshot~": FG.yellow,
  "msg": FG.white,
  "floatatom": FG.white,
};

function typeColour(type: string): string {
  return TYPE_COLOUR[type] ?? FG.gray;
}

// Category labels for object types
function typeCategory(type: string): string {
  if (type.match(/^(osc~|phasor~|noise~|tabosc4~)$/)) return "SRC";
  if (type.match(/^(\*~|\+~|-~|clip~|wrap~|abs~|sqrt~|pow~|max~|min~|samphold~)$/)) return "MATH";
  if (type.match(/^(lop~|hip~|bp~|vcf~|rpole~|rzero~)$/)) return "FLT";
  if (type.match(/^(line~|vline~|sig~)$/)) return "ENV";
  if (type.match(/^(delwrite~|delread~)$/)) return "DLY";
  if (type.match(/^(env~|snapshot~)$/)) return "ANA";
  if (type === "dac~") return "OUT";
  return "CTL";
}

// ---------------------------------------------------------------------------
// Inlet/outlet count for Pd objects
// ---------------------------------------------------------------------------

function inletCount(obj: PdObject): number {
  switch (obj.type) {
    case "osc~": case "phasor~": return 2;  // freq, phase-reset
    case "noise~": return 0;
    case "*~": case "+~": case "-~": return 2;
    case "lop~": case "hip~": return 2;  // signal, cutoff
    case "bp~": case "vcf~": return 3;   // signal, freq, q
    case "clip~": return 3;   // signal, lo, hi
    case "line~": case "vline~": return 1;
    case "dac~": return 2;    // left, right
    case "delwrite~": return 1;
    case "delread~": return 1;
    case "wrap~": case "abs~": case "sqrt~": return 1;
    case "pow~": case "max~": case "min~": return 2;
    case "sig~": return 1;
    case "samphold~": return 2;
    case "rpole~": case "rzero~": return 2;
    case "env~": case "snapshot~": return 1;
    default: return 1;
  }
}

function outletCount(obj: PdObject): number {
  switch (obj.type) {
    case "dac~": return 0;
    case "vcf~": return 2;  // real, imag
    case "noise~": return 1;
    default: return 1;
  }
}

// ---------------------------------------------------------------------------
// Render object box with inlet/outlet port indicators
// ---------------------------------------------------------------------------

function renderObjectBox(
  obj: PdObject,
  isSelected: boolean,
  boxWidth: number,
  inConns: number,
  outConns: number,
): string {
  const argsStr = obj.args.length > 0
    ? " " + obj.args.map(a => String(a)).join(" ")
    : "";
  const label = `${obj.type}${argsStr}`;
  const truncLabel = label.length > boxWidth - 4
    ? label.slice(0, boxWidth - 7) + "..."
    : label;

  const tc = typeColour(obj.type);
  const cat = typeCategory(obj.type);
  const inlets = inletCount(obj);
  const outlets = outletCount(obj);

  // Inlet port row: ○ for unconnected, ● for connected
  const inletStr = renderPorts(inlets, inConns, boxWidth - 2);
  // Outlet port row
  const outletStr = renderPorts(outlets, outConns, boxWidth - 2);

  if (isSelected) {
    const inner = pad(`${tc}${B}${truncLabel}${R}`, boxWidth - 2);
    return `${BG.cyan}${FG.black} ${inletStr}${R}\n` +
           `${BG.cyan}${FG.black}\u250C${"\u2500".repeat(boxWidth - 2)}\u2510${R}\n` +
           `${BG.cyan}${FG.black}\u2502${R}${inner}${BG.cyan}${FG.black}\u2502${R}\n` +
           `${BG.cyan}${FG.black}\u2514${"\u2500".repeat(boxWidth - 2)}\u2518${R} ${DIM}${cat}${R}\n` +
           `${BG.cyan}${FG.black} ${outletStr}${R}`;
  }

  const border = tc;
  const inner = pad(`${tc}${truncLabel}${R}`, boxWidth - 2);
  return `${border} ${inletStr}${R}\n` +
         `${border}\u250C${"\u2500".repeat(boxWidth - 2)}\u2510${R}\n` +
         `${border}\u2502${R}${inner}${border}\u2502${R}\n` +
         `${border}\u2514${"\u2500".repeat(boxWidth - 2)}\u2518${R} ${DIM}${cat}${R}\n` +
         `${border} ${outletStr}${R}`;
}

function renderPorts(count: number, connectedCount: number, width: number): string {
  if (count === 0) return " ".repeat(width);
  const filled = Math.min(count, connectedCount);
  const spacing = count === 1 ? 0 : Math.max(1, Math.floor((width - count) / (count - 1)));
  let result = "";
  for (let i = 0; i < count; i++) {
    result += i < filled ? "\u25CF" : "\u25CB";
    if (i < count - 1) result += " ".repeat(Math.min(spacing, 3));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Render connection as text
// ---------------------------------------------------------------------------

function renderConnectionLine(conn: PdConnection, objects: PdObject[]): string {
  const src = objects.find(o => o.id === conn.sourceId);
  const snk = objects.find(o => o.id === conn.sinkId);
  if (!src || !snk) return "";
  return `${DIM}${FG.gray}      \u2502 ${src.type}[${conn.sourceOutlet}] \u2500\u25B6 ${snk.type}[${conn.sinkInlet}]${R}`;
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
// Selected object detail panel
// ---------------------------------------------------------------------------

function renderDetailPanel(
  engine: PdEngine,
  w: number,
): string[] {
  const lines: string[] = [];
  const obj = engine.patch.objects.find(o => o.id === engine.selectedObjectId);
  if (!obj) return lines;

  const tc = typeColour(obj.type);
  const cat = typeCategory(obj.type);

  lines.push(`  ${B}${FG.yellow}\u2500\u2500 Selected: ${tc}${obj.type}${FG.yellow} ${DIM}(id:${obj.id})${R} ${"\u2500".repeat(Math.max(0, w - 24 - obj.type.length))}${R}`);

  // Args
  if (obj.args.length > 0) {
    lines.push(`  ${FG.gray}Args:${R} ${obj.args.map(a => `${FG.white}${a}${R}`).join(" ")}`);
  }

  // Inlet/outlet info
  const inlets = inletCount(obj);
  const outlets = outletCount(obj);
  lines.push(`  ${FG.gray}Ports:${R} ${FG.cyan}${inlets} in${R} ${FG.green}${outlets} out${R}  ${FG.gray}Category:${R} ${tc}${cat}${R}`);

  // Incoming connections
  const inConns = engine.getConnectionsTo(obj.id);
  if (inConns.length > 0) {
    const sources = inConns.map(c => {
      const src = engine.patch.objects.find(o => o.id === c.sourceId);
      return src ? `${typeColour(src.type)}${src.type}${R}[${c.sourceOutlet}]\u2192[${c.sinkInlet}]` : "?";
    });
    lines.push(`  ${FG.gray}\u25C0 From:${R} ${sources.join("  ")}`);
  }

  // Outgoing connections
  const outConns = engine.getConnectionsFrom(obj.id);
  if (outConns.length > 0) {
    const sinks = outConns.map(c => {
      const snk = engine.patch.objects.find(o => o.id === c.sinkId);
      return snk ? `[${c.sourceOutlet}]\u2192${typeColour(snk.type)}${snk.type}${R}[${c.sinkInlet}]` : "?";
    });
    lines.push(`  ${FG.gray}\u25B6 To:${R}   ${sinks.join("  ")}`);
  }

  if (inConns.length === 0 && outConns.length === 0) {
    lines.push(`  ${DIM}${FG.gray}(no connections \u2014 press [c] to connect to next)${R}`);
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

  // ── MODE + TRANSPORT BAR ─────────────────────────────────
  const playing = engine.transport === "playing";
  const rendering = engine.transport === "rendering";
  const stC = playing ? FG.green : rendering ? FG.yellow : FG.gray;
  const stI = playing ? "\u25B6 PLAY" : rendering ? "\u25CF RENDER" : "\u25A0 STOP";
  const patchName = patch.name || "untitled";
  const objCount = patch.objects.length;
  const connCount = patch.connections.length;

  // Mode indicator
  const mode = playing ? `${BG.gray}${FG.green} PLAY ${R}` : `${BG.gray}${FG.cyan} EDIT ${R}`;

  lines.push(
    `  ${mode} ${stC}${stI}${R}  ${B}${FG.white}${patchName}${R}` +
    `  ${FG.gray}\u2502${R} ${FG.gray}${objCount} obj${R}` +
    `  ${FG.gray}${connCount} conn${R}` +
    `  ${FG.gray}${engine.renderDuration}s${R}` +
    `  ${FG.gray}\u2502${R} ${engine.audioBuffer ? `${FG.green}\u2588 audio${R}` : `${DIM}${FG.gray}\u2591 no audio${R}`}`
  );
  lines.push("");

  // ── PATCH GRAPH or MELODY ─────────────────────────────────
  if (engine.melody) {
    const melH = Math.max(4, h - lines.length - 10);
    lines.push(...renderMelodySection(engine, w, melH));
  } else {
  lines.push(`  ${B}${FG.cyan}\u2500\u2500 Patch Graph ${"\u2500".repeat(Math.max(0, w - 18))}${R}`);

  if (patch.objects.length === 0) {
    lines.push(`  ${DIM}${FG.gray}(empty patch \u2014 press [a] to add objects)${R}`);
    lines.push("");
  } else {
    const boxWidth = Math.min(40, Math.max(20, w - 10));

    for (let idx = 0; idx < patch.objects.length; idx++) {
      const obj = patch.objects[idx]!;
      const isSelected = obj.id === engine.selectedObjectId;

      // Count connections for port indicators
      const inConns = engine.getConnectionsTo(obj.id).length;
      const outConns = engine.getConnectionsFrom(obj.id).length;

      // Object number prefix + selection marker
      const marker = isSelected ? `${FG.cyan}\u25B8${R}` : " ";
      const prefix = `  ${marker}${isSelected ? FG.cyan : FG.gray}${String(obj.id).padStart(2)}${R} `;

      const boxLines = renderObjectBox(obj, isSelected, boxWidth, inConns, outConns).split("\n");
      for (const bl of boxLines) {
        lines.push(prefix + bl);
      }

      // Draw connections FROM this object
      const fromConns = engine.getConnectionsFrom(obj.id);
      for (const conn of fromConns) {
        lines.push(renderConnectionLine(conn, patch.objects));
      }

      // Connection wire to next object if connected
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
  } // end melody else

  // ── SELECTED OBJECT DETAIL PANEL ──────────────────────────
  if (engine.selectedObjectId >= 0 && patch.objects.length > 0) {
    const detailLines = renderDetailPanel(engine, w);
    lines.push(...detailLines);
    if (detailLines.length > 0) lines.push("");
  }

  // ── WAVEFORM PREVIEW ──────────────────────────────────────
  const waveHeight = Math.max(3, Math.min(8, h - lines.length - 8));
  lines.push(`  ${B}${FG.green}\u2500\u2500 Waveform ${"\u2500".repeat(Math.max(0, w - 14))}${R}`);
  const waveLines = renderWaveform(engine.audioBuffer, w, waveHeight);
  lines.push(...waveLines);
  lines.push("");

  // ── SIGNAL FLOW SUMMARY ────────────────────────────────────
  if (patch.objects.length > 0) {
    const sources = patch.objects.filter(o => ["osc~", "phasor~", "noise~"].includes(o.type));
    const filters = patch.objects.filter(o => ["lop~", "hip~", "bp~", "vcf~", "clip~"].includes(o.type));
    const math = patch.objects.filter(o => ["*~", "+~", "-~"].includes(o.type));
    const delays = patch.objects.filter(o => ["delwrite~", "delread~"].includes(o.type));
    const hasDac = patch.objects.some(o => o.type === "dac~");

    const flowParts: string[] = [];
    if (sources.length > 0) flowParts.push(`${FG.green}${sources.map(s => s.type).join("+")}${R}`);
    if (math.length > 0) flowParts.push(`${FG.cyan}${math.length} math${R}`);
    if (filters.length > 0) flowParts.push(`${FG.mag}${filters.map(f => f.type).join("+")}${R}`);
    if (delays.length > 0) flowParts.push(`${FG.yellow}${delays.length} delay${R}`);
    if (hasDac) flowParts.push(`${FG.red}dac~${R}`);

    if (flowParts.length > 0) {
      lines.push(`  ${DIM}Flow: ${flowParts.join(` ${FG.gray}\u2192${R} `)}${R}`);
      lines.push("");
    }
  }

  // ── PRESET HINT ────────────────────────────────────────────
  lines.push(`  ${DIM}${FG.gray}Presets: ${PRESET_DISPLAY.map(p =>
    p === patchName ? `${FG.cyan}[${p}]${FG.gray}` : p
  ).join(" \u2022 ")}${R}`);

  // ── KEYBOARD HELP ─────────────────────────────────────────
  // Context-sensitive: show different hints depending on state
  if (engine.melody) {
    if (playing) {
      lines.push(`  ${FG.gray}SPC:stop  m:next-melody  w:cycle-wave  x:back-to-patch  q:close${R}`);
    } else {
      lines.push(`  ${FG.gray}SPC:play  r:re-render  m:next-melody  w:cycle-wave  x:back-to-patch  q:close${R}`);
    }
  } else if (playing) {
    lines.push(`  ${FG.gray}SPC:stop  r:render  p:preset  q:close${R}`);
  } else if (patch.objects.length === 0) {
    lines.push(`  ${FG.gray}a:add object  p:preset  q:close${R}`);
  } else {
    lines.push(`  ${FG.gray}SPC:play/stop  r:render  p:preset  \u2191\u2193:select  a:add  d:delete  c:connect  Cd:disconnect  x:clear  R:duration  q:close${R}`);
  }

  while (lines.length < h) lines.push("");
  return lines.slice(0, h).join("\n");
}

// Preset names for display (subset for the hint bar)
const PRESET_DISPLAY = [
  "sine-drone", "detuned-pad", "bass-pulse", "noise-filter",
  "fm-bell", "dual-saw", "sub-bass", "delay-drone",
];

// ---------------------------------------------------------------------------
// Melody section renderer
// ---------------------------------------------------------------------------

function noteOctave(note: string | number): number {
  if (typeof note === "number") return 4;
  const m = String(note).match(/(\d+)$/);
  return m ? parseInt(m[1]!) : 4;
}

const OCT_COLORS = [FG.blue, FG.blue, FG.blue, FG.cyan, FG.green, FG.yellow, FG.red, FG.red];

function noteDisplayColor(note: string | number): string {
  const s = String(note);
  if (s === "rest" || s === "-" || s === "_") return FG.gray;
  const oct = noteOctave(note);
  return OCT_COLORS[Math.max(0, Math.min(7, oct))] ?? FG.white;
}

function noteDisplayLabel(note: string | number): string {
  const s = String(note);
  if (s === "rest" || s === "-" || s === "_") return "  ";
  const m = s.match(/^([A-Ga-g][#b]?)(\d+)$/);
  if (!m) return s.slice(0, 2).padEnd(2);
  const name = m[1]!;
  const oct  = m[2]!;
  return name.length === 1 ? name + oct : name.slice(0, 2);
}

function renderMelodySection(engine: PdEngine, w: number, maxH: number): string[] {
  const melody   = engine.melody!;
  const lines: string[] = [];
  const totalDur = melody.reduce((s, n) => s + n.dur, 0);

  lines.push(
    `  ${B}${FG.mag}\u2500\u2500 Melody: ${FG.white}${engine.melodyName}${FG.mag}` +
    `  [${engine.melodyWave}]  ${melody.length} notes  ${totalDur.toFixed(1)}s` +
    `  ${"\u2500".repeat(Math.max(0, w - 22 - engine.melodyName.length - engine.melodyWave.length))}${R}`
  );
  lines.push("");

  const cellW  = 4; // "[XX]" = 4 chars visual
  const indent = 4;
  const rowCap = Math.max(1, Math.floor((w - indent) / cellW));

  for (let start = 0; start < melody.length; start += rowCap) {
    if (lines.length >= maxH - 2) break;
    let row = "    ";
    for (let j = start; j < Math.min(start + rowCap, melody.length); j++) {
      const n   = melody[j]!;
      const col = noteDisplayColor(n.note);
      const lbl = noteDisplayLabel(n.note);
      row += `${col}[${lbl}]${R}`;
    }
    lines.push(row);
  }

  lines.push("");
  return lines.slice(0, maxH);
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
