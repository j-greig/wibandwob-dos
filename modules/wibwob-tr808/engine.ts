/**
 * TR-808 Sequencer Engine — pure state machine, no UI.
 *
 * Owns: pattern data, transport, instrument parameters, accent, tempo.
 * Does NOT own: rendering, sound output, UI widgets.
 *
 * Designed as a reusable module — could drive any drum machine UI.
 */

// ---------------------------------------------------------------------------
// Instrument definitions
// ---------------------------------------------------------------------------

export type InstrumentId =
  | "bd" | "sd" | "lt" | "mt" | "ht"
  | "rs" | "cb" | "cp" | "ma" | "cl"
  | "cy" | "oh" | "ch";

export interface InstrumentDef {
  id: InstrumentId;
  label: string;
  shortLabel: string;
  color: string; // semantic color hint for UI
  params: ParamDef[];
}

export interface ParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

/** Level param shared by all instruments. */
const levelParam: ParamDef = { id: "level", label: "LVL", min: 0, max: 100, default: 80, step: 5 };
const tuneParam: ParamDef = { id: "tune", label: "TUN", min: 0, max: 100, default: 50, step: 5 };
const decayParam: ParamDef = { id: "decay", label: "DEC", min: 0, max: 100, default: 50, step: 5 };

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: "bd", label: "Bass Drum", shortLabel: "BD", color: "red",
    params: [tuneParam, { id: "attack", label: "ATK", min: 0, max: 100, default: 50, step: 5 }, decayParam, levelParam],
  },
  {
    id: "sd", label: "Snare Drum", shortLabel: "SD", color: "yellow",
    params: [tuneParam, { id: "tone", label: "TON", min: 0, max: 100, default: 50, step: 5 }, { id: "snappy", label: "SNP", min: 0, max: 100, default: 50, step: 5 }, decayParam, levelParam],
  },
  {
    id: "lt", label: "Low Tom", shortLabel: "LT", color: "green",
    params: [tuneParam, decayParam, levelParam],
  },
  {
    id: "mt", label: "Mid Tom", shortLabel: "MT", color: "green",
    params: [tuneParam, decayParam, levelParam],
  },
  {
    id: "ht", label: "Hi Tom", shortLabel: "HT", color: "green",
    params: [tuneParam, decayParam, levelParam],
  },
  {
    id: "rs", label: "Rim Shot", shortLabel: "RS", color: "cyan",
    params: [levelParam],
  },
  {
    id: "cb", label: "Cowbell", shortLabel: "CB", color: "cyan",
    params: [levelParam],
  },
  {
    id: "cp", label: "Hand Clap", shortLabel: "CP", color: "magenta",
    params: [{ id: "snappy", label: "SNP", min: 0, max: 100, default: 50, step: 5 }, levelParam],
  },
  {
    id: "ma", label: "Maracas", shortLabel: "MA", color: "white",
    params: [levelParam],
  },
  {
    id: "cl", label: "Claves", shortLabel: "CL", color: "white",
    params: [levelParam],
  },
  {
    id: "cy", label: "Cymbal", shortLabel: "CY", color: "blue",
    params: [tuneParam, decayParam, levelParam],
  },
  {
    id: "oh", label: "Open Hi-Hat", shortLabel: "OH", color: "blue",
    params: [decayParam, levelParam],
  },
  {
    id: "ch", label: "Closed Hi-Hat", shortLabel: "CH", color: "blue",
    params: [levelParam],
  },
];

export const INSTRUMENT_IDS = INSTRUMENTS.map(i => i.id);
export const INSTRUMENT_MAP = new Map(INSTRUMENTS.map(i => [i.id, i]));

// ---------------------------------------------------------------------------
// Pattern data
// ---------------------------------------------------------------------------

export const STEPS = 16;

export type PatternBank = "A" | "B";
export type PatternVariation = "A" | "B"; // A=basic, B=fill

export interface PatternData {
  /** steps[instrumentId] = boolean[16] */
  steps: Record<InstrumentId, boolean[]>;
  /** accent[step] = true if accented */
  accent: boolean[];
  /** Per-instrument params */
  params: Record<InstrumentId, Record<string, number>>;
  /** Last step (1-16), default 16 */
  lastStep: number;
}

export interface PatternSlot {
  bank: PatternBank;
  number: number; // 1-8
  variation: PatternVariation;
}

function emptySteps(): boolean[] {
  return Array(STEPS).fill(false);
}

function defaultParams(inst: InstrumentDef): Record<string, number> {
  const p: Record<string, number> = {};
  for (const param of inst.params) {
    p[param.id] = param.default;
  }
  return p;
}

export function createEmptyPattern(): PatternData {
  const steps: Record<string, boolean[]> = {};
  const params: Record<string, Record<string, number>> = {};
  for (const inst of INSTRUMENTS) {
    steps[inst.id] = emptySteps();
    params[inst.id] = defaultParams(inst);
  }
  return {
    steps: steps as PatternData["steps"],
    accent: emptySteps(),
    params: params as PatternData["params"],
    lastStep: STEPS,
  };
}

/** Serializable pattern key */
function patternKey(slot: PatternSlot): string {
  return `${slot.bank}${slot.number}${slot.variation}`;
}

// ---------------------------------------------------------------------------
// Pre-scale
// ---------------------------------------------------------------------------

export type PreScale = "16th" | "32nd" | "8th-triplet";

const PRESCALE_LABELS: Record<PreScale, string> = {
  "16th": "16th",
  "32nd": "32nd",
  "8th-triplet": "8T",
};

// ---------------------------------------------------------------------------
// Transport state
// ---------------------------------------------------------------------------

export type TransportState = "stopped" | "playing";

// ---------------------------------------------------------------------------
// Engine events
// ---------------------------------------------------------------------------

export type EngineEvent =
  | { type: "step"; step: number; instruments: InstrumentId[]; accent: boolean }
  | { type: "transport"; state: TransportState }
  | { type: "tempo"; bpm: number }
  | { type: "pattern-changed" }
  | { type: "instrument-selected"; instrument: InstrumentId | "accent" }
  | { type: "param-changed"; instrument: InstrumentId; param: string; value: number }
  | { type: "step-toggled"; instrument: InstrumentId | "accent"; step: number; active: boolean };

export type EngineListener = (event: EngineEvent) => void;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class TR808Engine {
  // Pattern storage: 2 banks x 8 patterns x 2 variations = 32 slots
  private patterns = new Map<string, PatternData>();
  private currentSlot: PatternSlot = { bank: "A", number: 1, variation: "A" };
  private selectedInstrument: InstrumentId | "accent" = "bd";
  private transport: TransportState = "stopped";
  private _tempo = 120;
  private preScale: PreScale = "16th";
  private currentStep = -1;
  private accentLevel = 80; // 0-100
  private masterLevel = 100; // 0-100
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: EngineListener[] = [];

  constructor() {
    // Initialize all pattern slots
    for (const bank of ["A", "B"] as PatternBank[]) {
      for (let n = 1; n <= 8; n++) {
        for (const variation of ["A", "B"] as PatternVariation[]) {
          const key = patternKey({ bank, number: n, variation });
          this.patterns.set(key, createEmptyPattern());
        }
      }
    }
  }

  // -- Listeners --

  on(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }

  // -- Pattern access --

  get pattern(): PatternData {
    return this.patterns.get(patternKey(this.currentSlot))!;
  }

  get slot(): PatternSlot { return { ...this.currentSlot }; }

  setSlot(slot: Partial<PatternSlot>): void {
    if (slot.bank !== undefined) this.currentSlot.bank = slot.bank;
    if (slot.number !== undefined) this.currentSlot.number = slot.number;
    if (slot.variation !== undefined) this.currentSlot.variation = slot.variation;
    this.emit({ type: "pattern-changed" });
  }

  // -- Instrument selection --

  get selected(): InstrumentId | "accent" { return this.selectedInstrument; }

  selectInstrument(id: InstrumentId | "accent"): void {
    this.selectedInstrument = id;
    this.emit({ type: "instrument-selected", instrument: id });
  }

  // -- Step editing --

  toggleStep(step: number, instrument?: InstrumentId | "accent"): void {
    const inst = instrument ?? this.selectedInstrument;
    const pat = this.pattern;
    if (inst === "accent") {
      pat.accent[step] = !pat.accent[step];
      this.emit({ type: "step-toggled", instrument: "accent", step, active: pat.accent[step] });
    } else {
      pat.steps[inst][step] = !pat.steps[inst][step];
      this.emit({ type: "step-toggled", instrument: inst, step, active: pat.steps[inst][step] });
    }
  }

  setStep(step: number, active: boolean, instrument?: InstrumentId | "accent"): void {
    const inst = instrument ?? this.selectedInstrument;
    const pat = this.pattern;
    if (inst === "accent") {
      pat.accent[step] = active;
    } else {
      pat.steps[inst][step] = active;
    }
    this.emit({ type: "step-toggled", instrument: inst, step, active });
  }

  getSteps(instrument?: InstrumentId | "accent"): boolean[] {
    const inst = instrument ?? this.selectedInstrument;
    return inst === "accent" ? [...this.pattern.accent] : [...this.pattern.steps[inst]];
  }

  // -- Parameters --

  getParam(instrument: InstrumentId, param: string): number {
    return this.pattern.params[instrument]?.[param] ?? 0;
  }

  setParam(instrument: InstrumentId, param: string, value: number): void {
    const def = INSTRUMENT_MAP.get(instrument);
    if (!def) return;
    const paramDef = def.params.find(p => p.id === param);
    if (!paramDef) return;
    const clamped = Math.max(paramDef.min, Math.min(paramDef.max, value));
    this.pattern.params[instrument][param] = clamped;
    this.emit({ type: "param-changed", instrument, param, value: clamped });
  }

  // -- Global controls --

  get tempo(): number { return this._tempo; }
  set tempo(bpm: number) {
    this._tempo = Math.max(35, Math.min(300, bpm));
    if (this.transport === "playing") {
      this.stopTimer();
      this.startTimer();
    }
    this.emit({ type: "tempo", bpm: this._tempo });
  }

  get accent(): number { return this.accentLevel; }
  set accent(level: number) { this.accentLevel = Math.max(0, Math.min(100, level)); }

  get master(): number { return this.masterLevel; }
  set master(level: number) { this.masterLevel = Math.max(0, Math.min(100, level)); }

  get scale(): PreScale { return this.preScale; }
  set scale(s: PreScale) { this.preScale = s; }

  get scaleLabel(): string { return PRESCALE_LABELS[this.preScale]; }

  // -- Transport --

  get state(): TransportState { return this.transport; }
  get step(): number { return this.currentStep; }

  start(): void {
    if (this.transport === "playing") return;
    this.transport = "playing";
    this.currentStep = -1;
    this.startTimer();
    this.emit({ type: "transport", state: "playing" });
  }

  stop(): void {
    if (this.transport === "stopped") return;
    this.transport = "stopped";
    this.stopTimer();
    this.currentStep = -1;
    this.emit({ type: "transport", state: "stopped" });
  }

  toggle(): void {
    if (this.transport === "playing") this.stop();
    else this.start();
  }

  private stepIntervalMs(): number {
    const beatsPerMin = this._tempo;
    switch (this.preScale) {
      case "16th": return (60000 / beatsPerMin) / 4;
      case "32nd": return (60000 / beatsPerMin) / 8;
      case "8th-triplet": return (60000 / beatsPerMin) / 3;
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const interval = this.stepIntervalMs();
    this.timer = setInterval(() => this.advanceStep(), interval);
    // Fire first step immediately
    this.advanceStep();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private advanceStep(): void {
    const pat = this.pattern;
    this.currentStep = (this.currentStep + 1) % pat.lastStep;

    // Collect which instruments fire on this step
    const firing: InstrumentId[] = [];
    for (const inst of INSTRUMENTS) {
      if (pat.steps[inst.id][this.currentStep]) {
        firing.push(inst.id);
      }
    }

    this.emit({
      type: "step",
      step: this.currentStep,
      instruments: firing,
      accent: pat.accent[this.currentStep],
    });
  }

  // -- Pattern operations --

  clearInstrument(instrument?: InstrumentId | "accent"): void {
    const inst = instrument ?? this.selectedInstrument;
    const pat = this.pattern;
    if (inst === "accent") {
      pat.accent.fill(false);
    } else {
      pat.steps[inst].fill(false);
    }
    this.emit({ type: "pattern-changed" });
  }

  clearPattern(): void {
    const pat = this.pattern;
    for (const inst of INSTRUMENTS) {
      pat.steps[inst.id].fill(false);
    }
    pat.accent.fill(false);
    this.emit({ type: "pattern-changed" });
  }

  setLastStep(step: number): void {
    this.pattern.lastStep = Math.max(1, Math.min(STEPS, step));
    this.emit({ type: "pattern-changed" });
  }

  // -- Preset patterns --

  loadPreset(name: string): void {
    const preset = PRESETS[name];
    if (!preset) return;
    const pat = this.pattern;
    // Clear first
    for (const inst of INSTRUMENTS) pat.steps[inst.id].fill(false);
    pat.accent.fill(false);
    // Apply
    for (const [instId, steps] of Object.entries(preset)) {
      if (instId === "accent") {
        for (const s of steps) pat.accent[s] = true;
      } else if (instId in pat.steps) {
        for (const s of steps) (pat.steps as any)[instId][s] = true;
      }
    }
    this.emit({ type: "pattern-changed" });
  }

  // -- Serialization --

  serialize(): Record<string, unknown> {
    return {
      slot: this.currentSlot,
      tempo: this._tempo,
      accentLevel: this.accentLevel,
      masterLevel: this.masterLevel,
      preScale: this.preScale,
      selectedInstrument: this.selectedInstrument,
      patterns: Object.fromEntries(this.patterns),
    };
  }

  hydrate(data: Record<string, unknown>): void {
    if (typeof data.tempo === "number") this._tempo = data.tempo;
    if (typeof data.accentLevel === "number") this.accentLevel = data.accentLevel;
    if (typeof data.masterLevel === "number") this.masterLevel = data.masterLevel;
    if (typeof data.preScale === "string") this.preScale = data.preScale as PreScale;
    if (data.slot && typeof data.slot === "object") {
      const s = data.slot as Record<string, unknown>;
      if (typeof s.bank === "string") this.currentSlot.bank = s.bank as PatternBank;
      if (typeof s.number === "number") this.currentSlot.number = s.number;
      if (typeof s.variation === "string") this.currentSlot.variation = s.variation as PatternVariation;
    }
    if (typeof data.selectedInstrument === "string") {
      this.selectedInstrument = data.selectedInstrument as InstrumentId | "accent";
    }
    if (data.patterns && typeof data.patterns === "object") {
      for (const [key, val] of Object.entries(data.patterns as Record<string, unknown>)) {
        if (val && typeof val === "object") {
          this.patterns.set(key, val as PatternData);
        }
      }
    }
  }

  destroy(): void {
    this.stopTimer();
    this.listeners = [];
  }
}

// ---------------------------------------------------------------------------
// Preset patterns
// ---------------------------------------------------------------------------

const PRESETS: Record<string, Record<string, number[]>> = {
  "classic-house": {
    bd: [0, 4, 8, 12],
    sd: [4, 12],
    ch: [0, 2, 4, 6, 8, 10, 12, 14],
    oh: [2, 6, 10, 14],
    cp: [4, 12],
    accent: [0, 4, 8, 12],
  },
  "electro": {
    bd: [0, 3, 6, 10, 12],
    sd: [4, 12],
    ch: [0, 2, 4, 6, 8, 10, 12, 14],
    cp: [4, 12],
    cb: [0, 4, 8, 12],
    rs: [2, 10],
    accent: [0, 6, 12],
  },
  "trap": {
    bd: [0, 7, 8, 11],
    sd: [4, 12],
    ch: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    oh: [6, 14],
    accent: [0, 4, 8, 12],
  },
  "bossa": {
    bd: [0, 6, 10],
    rs: [2, 5, 8, 12],
    ch: [0, 2, 4, 6, 8, 10, 12, 14],
    ma: [1, 3, 5, 7, 9, 11, 13, 15],
    accent: [0, 6, 10],
  },
  "breakbeat": {
    bd: [0, 6, 10],
    sd: [4, 12],
    ch: [0, 2, 4, 6, 8, 10, 12, 14],
    oh: [3, 11],
    lt: [14],
    mt: [13],
    accent: [0, 4, 10, 12],
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
