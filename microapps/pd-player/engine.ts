/**
 * Pure Data Engine — real Pd subprocess driver.
 *
 * Writes .pd patch files, spawns `pd -nogui`, and communicates
 * via pdsend UDP messages on port 9001.
 *
 * Pure state machine — no UI, no audio synthesis in JS.
 */

import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Pd binary paths
// ---------------------------------------------------------------------------

const PD_APP = "/Applications/Pd-0.56-2.app/Contents/Resources/bin";
export const PD_BIN   = `${PD_APP}/pd`;
export const PDSEND   = `${PD_APP}/pdsend`;
export const PD_PORT  = 9001;

export function pdAvailable(): boolean {
  return existsSync(PD_BIN);
}

// ---------------------------------------------------------------------------
// Pd patch data model
// ---------------------------------------------------------------------------

export interface PdObject {
  id: number;
  type: string;
  args: (string | number)[];
  x: number;
  y: number;
}

export interface PdConnection {
  sourceId: number;
  sourceOutlet: number;
  sinkId: number;
  sinkInlet: number;
}

export interface PdPatch {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  objects: PdObject[];
  connections: PdConnection[];
}

// ---------------------------------------------------------------------------
// Parser — reads .pd text format
// ---------------------------------------------------------------------------

export function parsePdPatch(source: string, name = "untitled"): PdPatch {
  const lines = source.split("\n").map(l => l.replace(/;\s*$/, "").trim()).filter(Boolean);
  const objects: PdObject[] = [];
  const connections: PdConnection[] = [];
  let canvasWidth = 450;
  let canvasHeight = 300;
  let nextId = 0;

  for (const line of lines) {
    const tokens = tokenize(line);
    if (tokens.length < 2) continue;

    if (tokens[0] === "#N" && tokens[1] === "canvas") {
      canvasWidth  = num(tokens[4], 450);
      canvasHeight = num(tokens[5], 300);
      continue;
    }
    if (tokens[0] === "#X" && tokens[1] === "obj") {
      const x    = num(tokens[2], 0);
      const y    = num(tokens[3], 0);
      const type = String(tokens[4] ?? "");
      const args = tokens.slice(5).map(t => { const n = Number(t); return Number.isFinite(n) ? n : String(t); });
      objects.push({ id: nextId++, type, args, x, y });
      continue;
    }
    if (tokens[0] === "#X" && tokens[1] === "msg") {
      const x       = num(tokens[2], 0);
      const y       = num(tokens[3], 0);
      const content = tokens.slice(4).join(" ");
      objects.push({ id: nextId++, type: "msg", args: [content], x, y });
      continue;
    }
    if (tokens[0] === "#X" && tokens[1] === "floatatom") {
      const x = num(tokens[2], 0);
      const y = num(tokens[3], 0);
      objects.push({ id: nextId++, type: "floatatom", args: [], x, y });
      continue;
    }
    if (tokens[0] === "#X" && tokens[1] === "connect") {
      connections.push({
        sourceId:    num(tokens[2], 0),
        sourceOutlet: num(tokens[3], 0),
        sinkId:      num(tokens[4], 0),
        sinkInlet:   num(tokens[5], 0),
      });
      continue;
    }
  }

  return { name, canvasWidth, canvasHeight, objects, connections };
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && line[i] === " ") i++;
    if (i >= line.length) break;
    let tok = "";
    while (i < line.length && line[i] !== " " && line[i] !== ";") tok += line[i++];
    if (tok) tokens.push(tok);
    if (i < line.length && line[i] === ";") i++;
  }
  return tokens;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

export function serializePdPatch(patch: PdPatch): string {
  const lines: string[] = [];
  lines.push(`#N canvas 0 0 ${patch.canvasWidth} ${patch.canvasHeight} 12;`);
  for (const obj of patch.objects) {
    if (obj.type === "msg") {
      lines.push(`#X msg ${obj.x} ${obj.y} ${obj.args[0] ?? ""};`);
    } else if (obj.type === "floatatom") {
      lines.push(`#X floatatom ${obj.x} ${obj.y} 5 0 0 0 - - - 0;`);
    } else {
      const args = obj.args.length > 0 ? " " + obj.args.join(" ") : "";
      lines.push(`#X obj ${obj.x} ${obj.y} ${obj.type}${args};`);
    }
  }
  for (const conn of patch.connections) {
    lines.push(`#X connect ${conn.sourceId} ${conn.sourceOutlet} ${conn.sinkId} ${conn.sinkInlet};`);
  }
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Melody types + note helpers
// ---------------------------------------------------------------------------

export interface MelodyNote {
  note: string | number; // "C4", MIDI 60, Hz 440, "rest"/"-"
  dur: number;           // seconds
  vel?: number;          // 0–127 (default 80)
}

export type MelodyWave = "sine" | "saw" | "square" | "triangle";

const NOTE_SEMIS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function noteToMidi(note: string | number): number {
  if (typeof note === "number") {
    if (note <= 0) return -1;
    if (note <= 127) return Math.round(note);
    // raw Hz → midi
    return Math.round(69 + 12 * Math.log2(note / 440));
  }
  const s = String(note).trim();
  if (!s || s === "rest" || s === "-" || s === "_") return -1;
  const m = s.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return 69;
  const letter = m[1]!.toUpperCase();
  const acc    = m[2]!;
  const oct    = parseInt(m[3]!);
  const semi   = NOTE_SEMIS[letter + acc] ?? NOTE_SEMIS[letter] ?? 0;
  return (oct + 1) * 12 + semi;
}

export function noteToFreq(note: string | number): number {
  const midi = noteToMidi(note);
  if (midi < 0) return 0;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// Preset patches (real Pd DSP)
// ---------------------------------------------------------------------------

// DSP-on header: every patch needs loadbang -> "; pd dsp 1" to enable audio in -nogui mode
// Each patch template is a function so the port is baked in fresh each time.
// IDs: 0=loadbang, 1=dsp-msg, 2=netreceive, 3=route, 4..=signal chain.
// Signal flow: route.freq(outlet 0) → osc freq inlets
//              route.gate(outlet 1) → line~ inlet
//              osc(s) → +~/mix → *~.in0 (signal)
//              line~ → *~.in1 (amplitude)
//              *~ → [lop~] → dac~

function pdHeader(port: number, w = 500, h = 440): string {
  return `#N canvas 0 0 ${w} ${h} 12;
#X obj 10 10 loadbang;
#X msg 10 40 \\; pd dsp 1;
#X obj 100 70 netreceive ${port};
#X connect 0 0 1 0;`;
}

type PatchFn = (port: number) => string;

const PATCH_TEMPLATES: Record<string, PatchFn> = {
  "sine-drone": (port) => `${pdHeader(port, 450, 340)}
#X obj 100 110 route freq gate;
#X obj 100 150 osc~ 220;
#X obj 100 190 line~;
#X obj 100 230 *~;
#X obj 100 270 dac~;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 1 5 0;
#X connect 4 0 6 0;
#X connect 5 0 6 1;
#X connect 6 0 7 0;
#X connect 6 0 7 1;
`,

  "detuned-pad": (port) => `${pdHeader(port, 500, 400)}
#X obj 100 110 route freq gate;
#X obj 80  150 osc~ 220;
#X obj 210 150 osc~ 223;
#X obj 145 190 +~;
#X obj 145 230 line~;
#X obj 145 270 *~;
#X obj 145 310 lop~ 1200;
#X obj 145 350 dac~;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 0 5 0;
#X connect 3 1 7 0;
#X connect 4 0 6 0;
#X connect 5 0 6 1;
#X connect 6 0 8 0;
#X connect 7 0 8 1;
#X connect 8 0 9 0;
#X connect 9 0 10 0;
#X connect 9 0 10 1;
`,

  "fm-bell": (port) => `${pdHeader(port, 500, 440)}
#X obj 100 110 route freq gate;
#X obj 100 150 osc~ 880;
#X obj 100 190 *~ 300;
#X obj 100 230 +~ 440;
#X obj 100 270 osc~ 440;
#X obj 100 310 line~;
#X obj 100 350 *~;
#X obj 100 390 dac~;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 0 6 0;
#X connect 3 1 9 0;
#X connect 4 0 5 0;
#X connect 5 0 6 1;
#X connect 6 0 8 0;
#X connect 8 0 10 0;
#X connect 9 0 10 1;
#X connect 10 0 11 0;
#X connect 10 0 11 1;
`,

  "melody-synth": (port) => `${pdHeader(port, 500, 440)}
#X obj 100 110 route freq gate;
#X obj 80  150 osc~ 440;
#X obj 220 150 osc~ 443;
#X obj 150 190 +~;
#X obj 150 230 line~;
#X obj 150 270 *~;
#X obj 150 310 lop~ 3000;
#X obj 150 350 dac~;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 0 5 0;
#X connect 3 1 7 0;
#X connect 4 0 6 0;
#X connect 5 0 6 1;
#X connect 6 0 8 0;
#X connect 7 0 8 1;
#X connect 8 0 9 0;
#X connect 9 0 10 0;
#X connect 9 0 10 1;
`,
};

// Unique port allocator — avoids collisions between engine instances
let _nextPort = 9010;
function allocPort(): number { return _nextPort++; }

export const PRESET_PATCHES: Record<string, string> = Object.fromEntries(
  Object.entries(PATCH_TEMPLATES).map(([k, fn]) => [k, fn(PD_PORT)])
);

export const PRESET_NAMES = Object.keys(PRESET_PATCHES);

// ---------------------------------------------------------------------------
// Preset melodies
// ---------------------------------------------------------------------------

function makeBpm(b: number) {
  const q = 60 / b;
  return { q, e: q / 2, h: q * 2, dq: q * 1.5 };
}

function tetrisMelody(): MelodyNote[] {
  const { q, e, h, dq } = makeBpm(140);
  return [
    { note: "E5", dur: q  }, { note: "B4", dur: e  }, { note: "C5", dur: e  },
    { note: "D5", dur: q  }, { note: "C5", dur: e  }, { note: "B4", dur: e  },
    { note: "A4", dur: q  }, { note: "A4", dur: e  }, { note: "C5", dur: e  },
    { note: "E5", dur: q  }, { note: "D5", dur: e  }, { note: "C5", dur: e  },
    { note: "B4", dur: dq }, { note: "C5", dur: e  },
    { note: "D5", dur: q  }, { note: "E5", dur: q  },
    { note: "C5", dur: q  }, { note: "A4", dur: q  }, { note: "A4", dur: h  },
    { note: "-",  dur: e  },
    { note: "D5", dur: dq }, { note: "F5", dur: e  },
    { note: "A5", dur: q  }, { note: "G5", dur: e  }, { note: "F5", dur: e  },
    { note: "E5", dur: dq }, { note: "C5", dur: e  },
    { note: "E5", dur: q  }, { note: "D5", dur: e  }, { note: "C5", dur: e  },
    { note: "B4", dur: q  }, { note: "B4", dur: e  }, { note: "C5", dur: e  },
    { note: "D5", dur: q  }, { note: "E5", dur: q  },
    { note: "C5", dur: q  }, { note: "A4", dur: q  }, { note: "A4", dur: h  },
  ];
}

function twinkleMelody(): MelodyNote[] {
  const { q, h } = makeBpm(108);
  const n = [
    "C4","C4","G4","G4","A4","A4","G4",
    "F4","F4","E4","E4","D4","D4","C4",
    "G4","G4","F4","F4","E4","E4","D4",
    "G4","G4","F4","F4","E4","E4","D4",
    "C4","C4","G4","G4","A4","A4","G4",
    "F4","F4","E4","E4","D4","D4","C4",
  ];
  const d = [
    q,q,q,q,q,q,h, q,q,q,q,q,q,h,
    q,q,q,q,q,q,h, q,q,q,q,q,q,h,
    q,q,q,q,q,q,h, q,q,q,q,q,q,h,
  ];
  return n.map((note, i) => ({ note, dur: d[i]! }));
}

function marioMelody(): MelodyNote[] {
  const { q, e, h } = makeBpm(200);
  const t = e * 1.33;
  return [
    { note: "E5",  dur: e }, { note: "E5",  dur: e }, { note: "-",   dur: e },
    { note: "E5",  dur: e }, { note: "-",   dur: e }, { note: "C5",  dur: e },
    { note: "E5",  dur: q }, { note: "G5",  dur: q }, { note: "-",   dur: q },
    { note: "G4",  dur: q }, { note: "-",   dur: q },
    { note: "C5",  dur: q }, { note: "-",   dur: e }, { note: "G4",  dur: e },
    { note: "-",   dur: e }, { note: "E4",  dur: q }, { note: "-",   dur: e },
    { note: "A4",  dur: q }, { note: "-",   dur: e }, { note: "B4",  dur: q },
    { note: "-",   dur: e }, { note: "A#4", dur: e }, { note: "A4",  dur: q },
    { note: "G4",  dur: t }, { note: "E5",  dur: t }, { note: "G5",  dur: t },
    { note: "A5",  dur: q }, { note: "-",   dur: e }, { note: "F5",  dur: e },
    { note: "G5",  dur: e }, { note: "-",   dur: e }, { note: "E5",  dur: q },
    { note: "-",   dur: e }, { note: "C5",  dur: e }, { note: "D5",  dur: e },
    { note: "B4",  dur: q }, { note: "-",   dur: q },
  ];
}

function wibwobMelody(): MelodyNote[] {
  const { q, e, h, dq } = makeBpm(120);
  return [
    { note: "G4", dur: q  }, { note: "A4", dur: q  }, { note: "B4", dur: q  }, { note: "D5", dur: q  },
    { note: "E5", dur: dq }, { note: "D5", dur: e  }, { note: "B4", dur: h  },
    { note: "A4", dur: q  }, { note: "G4", dur: q  }, { note: "A4", dur: q  }, { note: "B4", dur: q  },
    { note: "G4", dur: h  }, { note: "-",  dur: h  },
    { note: "D5", dur: q  }, { note: "E5", dur: q  }, { note: "D5", dur: q  }, { note: "B4", dur: q  },
    { note: "A4", dur: dq }, { note: "G4", dur: e  }, { note: "A4", dur: h  },
    { note: "G4", dur: q  }, { note: "B4", dur: q  }, { note: "D5", dur: q  }, { note: "G5", dur: q  },
    { note: "E5", dur: h  }, { note: "D5", dur: h  },
    { note: "G4", dur: q  }, { note: "A4", dur: q  }, { note: "B4", dur: q  }, { note: "C5", dur: q  },
    { note: "D5", dur: q  }, { note: "E5", dur: q  }, { note: "D5", dur: e  }, { note: "C5", dur: e  }, { note: "B4", dur: h  },
    { note: "A4", dur: q  }, { note: "G4", dur: h  },
  ];
}

export const PRESET_MELODIES: Record<string, MelodyNote[]> = {
  tetris:  tetrisMelody(),
  twinkle: twinkleMelody(),
  mario:   marioMelody(),
  wibwob:  wibwobMelody(),
};

export const PRESET_MELODY_NAMES = Object.keys(PRESET_MELODIES);

// ---------------------------------------------------------------------------
// pdsend helper — sends a UDP message to a running Pd patch
// ---------------------------------------------------------------------------

export function pdsend(msg: string, port = PD_PORT): void {
  // Note: use engine.send() for instance-specific port
  try {
    const proc = spawn(PDSEND, [String(port)], { stdio: ["pipe", "ignore", "ignore"] });
    proc.stdin.write(msg + "\n");
    proc.stdin.end();
  } catch { /* silent */ }
}

// ---------------------------------------------------------------------------
// Engine state types
// ---------------------------------------------------------------------------

export type TransportState = "stopped" | "playing";

export type EngineEvent =
  | { type: "transport"; state: TransportState }
  | { type: "patch-loaded"; name: string }
  | { type: "patch-modified" }
  | { type: "melody-note"; index: number; note: MelodyNote }
  | { type: "melody-done" }
  | { type: "cursor-moved"; objectId: number }
  | { type: "object-selected"; objectId: number };

export type EngineListener = (event: EngineEvent) => void;

// ---------------------------------------------------------------------------
// PdEngine — wraps a real Pd subprocess
// ---------------------------------------------------------------------------

export class PdEngine {
  private _patch: PdPatch;
  private _patchName = "sine-drone";
  private _transport: TransportState = "stopped";
  private _selectedObjectId = -1;
  private _cursorIndex = 0;
  private _pdProc: ChildProcess | undefined;
  private _pdPatchFile: string | undefined;
  private _renderDuration = 4;
  private _port: number;

  // melody sequencer state
  private _melody: MelodyNote[] | null = null;
  private _melodyWave: MelodyWave = "sine";
  private _melodyName = "";
  private _melodyIndex = 0;
  private _melodyTimer: ReturnType<typeof setTimeout> | undefined;

  private listeners: EngineListener[] = [];

  constructor() {
    this._port  = allocPort();
    this._patch = parsePdPatch(PATCH_TEMPLATES["sine-drone"]!(this._port), "sine-drone");
  }

  // -- Listeners --

  on(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }

  // -- Accessors --

  get patch(): PdPatch { return this._patch; }
  get transport(): TransportState { return this._transport; }
  get selectedObjectId(): number { return this._selectedObjectId; }
  get cursorIndex(): number { return this._cursorIndex; }
  get renderDuration(): number { return this._renderDuration; }
  get melody(): MelodyNote[] | null { return this._melody; }
  get melodyWave(): MelodyWave { return this._melodyWave; }
  get melodyName(): string { return this._melodyName; }
  get melodyIndex(): number { return this._melodyIndex; }
  get pdRunning(): boolean { return !!this._pdProc; }

  set renderDuration(sec: number) {
    this._renderDuration = Math.max(0.5, Math.min(60, sec));
  }

  // -- Patch loading --

  loadSource(source: string, name = "untitled"): void {
    this._stopPd();
    this._patch = parsePdPatch(source, name);
    this._patchName = name;
    this._selectedObjectId = -1;
    this._cursorIndex = 0;
    this._transport = "stopped";
    this.emit({ type: "patch-loaded", name });
  }

  loadPreset(name: string): void {
    const fn = PATCH_TEMPLATES[name];
    if (!fn) return;
    this.loadSource(fn(this._port), name);
  }

  // -- Melody loading --

  loadMelody(notes: MelodyNote[], wave: MelodyWave = "sine", name = "melody"): void {
    this._stopMelody();
    this._stopPd();
    this._melody     = notes;
    this._melodyWave = wave;
    this._melodyName = name;
    this._melodyIndex = 0;
    this._transport  = "stopped";
    this.emit({ type: "patch-loaded", name });
  }

  clearMelody(): void {
    this._stopMelody();
    this._stopPd();
    this._melody     = null;
    this._melodyWave = "sine";
    this._melodyName = "";
    this._melodyIndex = 0;
    this.emit({ type: "patch-modified" });
  }

  // -- Transport --

  play(): void {
    if (this._melody) {
      this._playMelody();
    } else {
      this._playPatch();
    }
  }

  stop(): void {
    this._stopMelody();
    this._stopPd();
    this._transport = "stopped";
    this.emit({ type: "transport", state: "stopped" });
  }

  toggle(): void {
    if (this._transport === "playing") this.stop();
    else this.play();
  }

  /** @deprecated kept for API compat — real Pd doesn't need offline render */
  render(): void { /* no-op */ }

  // -- Pd subprocess --

  private _writePatch(): string {
    const dir  = join(tmpdir(), "wibwob-pd-player");
    try { require("fs").mkdirSync(dir, { recursive: true }); } catch {}
    const file = join(dir, `patch-${Date.now()}.pd`);

    // Melody uses the melody-synth template with this engine's port
    const src = this._melody
      ? PATCH_TEMPLATES["melody-synth"]!(this._port)
      : serializePdPatch(this._patch);

    writeFileSync(file, src);
    return file;
  }

  private _startPd(patchFile: string): void {
    if (!pdAvailable()) return;
    const args = ["-nogui", "-nrt", "-audiobuf", "25", patchFile];
    this._pdProc = spawn(PD_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });
    this._pdProc.stderr?.on("data", () => {}); // swallow
    this._pdProc.on("exit", () => {
      this._pdProc = undefined;
      if (this._transport === "playing") {
        this._transport = "stopped";
        this.emit({ type: "transport", state: "stopped" });
      }
    });
  }

  private _stopPd(): void {
    if (this._pdProc) {
      try { this._pdProc.kill(); } catch {}
      this._pdProc = undefined;
    }
    if (this._pdPatchFile && existsSync(this._pdPatchFile)) {
      try { require("fs").unlinkSync(this._pdPatchFile); } catch {}
      this._pdPatchFile = undefined;
    }
  }

  private _playPatch(): void {
    this._stopPd();
    if (!pdAvailable()) return;

    this._pdPatchFile = this._writePatch();
    this._startPd(this._pdPatchFile);

    // Give Pd 300ms to start audio engine, then send gate open
    setTimeout(() => {
      pdsend("gate 0.7 20;", this._port);
    }, 300);

    this._transport = "playing";
    this.emit({ type: "transport", state: "playing" });
  }

  // -- Melody sequencer --

  private _playMelody(): void {
    if (!this._melody || this._melody.length === 0) return;
    this._stopMelody();
    this._stopPd();
    if (!pdAvailable()) return;

    this._pdPatchFile = this._writePatch(); // writes melody-synth patch
    this._startPd(this._pdPatchFile);

    this._melodyIndex = 0;
    this._transport = "playing";
    this.emit({ type: "transport", state: "playing" });

    // Give Pd 400ms to start audio, then begin sequencing
    this._melodyTimer = setTimeout(() => this._scheduleNextNote(), 400);
  }

  private _scheduleNextNote(): void {
    if (!this._melody || !this._pdProc) {
      this._stopMelody();
      return;
    }

    const idx  = this._melodyIndex;
    const note = this._melody[idx];

    if (!note) {
      // End of melody
      pdsend("gate 0 30;");
      this._melodyIndex = 0;
      this._transport   = "stopped";
      this.emit({ type: "melody-done" });
      this.emit({ type: "transport", state: "stopped" });
      this._stopPd();
      return;
    }

    this.emit({ type: "melody-note", index: idx, note });

    const freq = noteToFreq(note.note);
    const vel  = typeof note.vel === "number" ? note.vel / 127 : 0.5;

    if (freq > 0) {
      pdsend(`freq ${freq.toFixed(2)};`, this._port);
      pdsend(`gate ${(vel * 0.8).toFixed(3)} 10;`, this._port);
      // Cut note slightly before next to articulate
      const cutMs = Math.max(20, note.dur * 1000 * 0.85);
      setTimeout(() => pdsend("gate 0 20;", this._port), cutMs);
    }

    this._melodyIndex = idx + 1;
    this._melodyTimer = setTimeout(() => this._scheduleNextNote(), note.dur * 1000);
  }

  private _stopMelody(): void {
    if (this._melodyTimer) {
      clearTimeout(this._melodyTimer);
      this._melodyTimer = undefined;
    }
    if (this._pdProc) pdsend("gate 0 30;", this._port);
  }

  // -- Patch editing --

  addObject(type: string, args: (string | number)[] = [], x = 100, y = 100): number {
    const maxId = this._patch.objects.reduce((m, o) => Math.max(m, o.id), -1);
    const id    = maxId + 1;
    const lastObj = this._patch.objects[this._patch.objects.length - 1];
    this._patch.objects.push({ id, type, args, x: lastObj?.x ?? x, y: (lastObj?.y ?? y) + 50 });
    this._cursorIndex      = this._patch.objects.length - 1;
    this._selectedObjectId = id;
    this.emit({ type: "patch-modified" });
    return id;
  }

  removeObject(id: number): void {
    this._patch.objects     = this._patch.objects.filter(o => o.id !== id);
    this._patch.connections = this._patch.connections.filter(c => c.sourceId !== id && c.sinkId !== id);
    if (this._selectedObjectId === id) {
      this._selectedObjectId = -1;
      this._cursorIndex = Math.min(this._cursorIndex, this._patch.objects.length - 1);
    }
    this.emit({ type: "patch-modified" });
  }

  addConnection(sourceId: number, sourceOutlet: number, sinkId: number, sinkInlet: number): void {
    const exists = this._patch.connections.some(
      c => c.sourceId === sourceId && c.sourceOutlet === sourceOutlet &&
           c.sinkId === sinkId && c.sinkInlet === sinkInlet
    );
    if (exists) return;
    this._patch.connections.push({ sourceId, sourceOutlet, sinkId, sinkInlet });
    this.emit({ type: "patch-modified" });
  }

  removeConnection(sourceId: number, sourceOutlet: number, sinkId: number, sinkInlet: number): void {
    this._patch.connections = this._patch.connections.filter(
      c => !(c.sourceId === sourceId && c.sourceOutlet === sourceOutlet &&
             c.sinkId === sinkId && c.sinkInlet === sinkInlet)
    );
    this.emit({ type: "patch-modified" });
  }

  clearPatch(): void {
    this._stopPd();
    this._patch = { name: "new-patch", canvasWidth: 450, canvasHeight: 300, objects: [], connections: [] };
    this._selectedObjectId = -1;
    this._cursorIndex      = 0;
    this.emit({ type: "patch-modified" });
  }

  getSource(): string { return serializePdPatch(this._patch); }

  selectObject(id: number): void {
    this._selectedObjectId = id;
    this.emit({ type: "object-selected", objectId: id });
  }

  moveCursor(delta: number): void {
    const len = this._patch.objects.length;
    if (len === 0) return;
    this._cursorIndex      = ((this._cursorIndex + delta) % len + len) % len;
    this._selectedObjectId = this._patch.objects[this._cursorIndex]!.id;
    this.emit({ type: "cursor-moved", objectId: this._selectedObjectId });
  }

  getObjectById(id: number): PdObject | undefined { return this._patch.objects.find(o => o.id === id); }
  getConnectionsFrom(id: number): PdConnection[] { return this._patch.connections.filter(c => c.sourceId === id); }
  getConnectionsTo(id: number): PdConnection[] { return this._patch.connections.filter(c => c.sinkId === id); }

  // -- Serialization --

  serialize(): Record<string, unknown> {
    return {
      source:          serializePdPatch(this._patch),
      name:            this._patch.name,
      renderDuration:  this._renderDuration,
      selectedObjectId: this._selectedObjectId,
      cursorIndex:     this._cursorIndex,
      melody:          this._melody,
      melodyWave:      this._melodyWave,
      melodyName:      this._melodyName,
    };
  }

  hydrate(data: Record<string, unknown>): void {
    if (typeof data.source === "string" && data.source.trim()) {
      this._patch = parsePdPatch(data.source, typeof data.name === "string" ? data.name : "restored");
    }
    if (typeof data.renderDuration === "number") this._renderDuration = data.renderDuration;
    if (typeof data.selectedObjectId === "number") this._selectedObjectId = data.selectedObjectId;
    if (typeof data.cursorIndex === "number") this._cursorIndex = data.cursorIndex;
    if (Array.isArray(data.melody)) this._melody = data.melody as MelodyNote[];
    if (typeof data.melodyWave === "string") this._melodyWave = data.melodyWave as MelodyWave;
    if (typeof data.melodyName === "string") this._melodyName = data.melodyName;
  }

  destroy(): void {
    this._stopMelody();
    this._stopPd();
    this.listeners = [];
  }
}
