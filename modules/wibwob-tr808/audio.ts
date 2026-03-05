/**
 * TR-808 Audio Engine — analog drum synthesis in TypeScript.
 *
 * Port of the Python chiptune-studio tr808.py synthesis.
 * Generates WAV samples at runtime, plays via macOS afplay.
 * Pure TypeScript — no Python, numpy, or external dependencies.
 *
 * Architecture: pre-renders each drum sound to a WAV buffer on init,
 * then triggers playback by spawning afplay per hit. Multiple
 * simultaneous sounds are supported (each is a separate process).
 */

import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { InstrumentId } from "./engine.js";

// ---------------------------------------------------------------------------
// DSP primitives
// ---------------------------------------------------------------------------

const SR = 22050;

function linspace(start: number, end: number, n: number): Float64Array {
  const arr = new Float64Array(n);
  const step = (end - start) / (n - 1 || 1);
  for (let i = 0; i < n; i++) arr[i] = start + i * step;
  return arr;
}

function noise(dur: number): Float64Array {
  const n = Math.floor(dur * SR);
  const arr = new Float64Array(n);
  for (let i = 0; i < n; i++) arr[i] = Math.random() * 2 - 1;
  return arr;
}

function sine(freq: number, dur: number): Float64Array {
  const n = Math.floor(dur * SR);
  const arr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = Math.sin(2 * Math.PI * freq * i / SR);
  }
  return arr;
}

/** Simple one-pole lowpass filter */
function lowpass(signal: Float64Array, cutoff: number): Float64Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const alpha = dt / (rc + dt);
  const out = new Float64Array(signal.length);
  out[0] = alpha * signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = out[i - 1] + alpha * (signal[i] - out[i - 1]);
  }
  return out;
}

/** Simple one-pole highpass filter */
function highpass(signal: Float64Array, cutoff: number): Float64Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const alpha = rc / (rc + dt);
  const out = new Float64Array(signal.length);
  out[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    out[i] = alpha * (out[i - 1] + signal[i] - signal[i - 1]);
  }
  return out;
}

/** ADSR envelope */
function env(signal: Float64Array, a: number, d: number, s: number, r: number): Float64Array {
  const out = new Float64Array(signal.length);
  const aN = Math.floor(a * SR);
  const dN = Math.floor(d * SR);
  const rN = Math.floor(r * SR);
  const sustainEnd = signal.length - rN;

  for (let i = 0; i < signal.length; i++) {
    let gain: number;
    if (i < aN) {
      gain = i / Math.max(1, aN); // attack
    } else if (i < aN + dN) {
      const t = (i - aN) / Math.max(1, dN);
      gain = 1 - t * (1 - s); // decay
    } else if (i < sustainEnd) {
      gain = s; // sustain
    } else {
      const t = (i - sustainEnd) / Math.max(1, rN);
      gain = s * (1 - t); // release
    }
    out[i] = signal[i] * Math.max(0, gain);
  }
  return out;
}

/** Mix signal b into a at offset, with volume */
function mixInto(a: Float64Array, b: Float64Array, offset: number, vol = 1): void {
  for (let i = 0; i < b.length && offset + i < a.length; i++) {
    a[offset + i] += b[i] * vol;
  }
}

/** Normalize to -1..1 */
function normalize(signal: Float64Array): Float64Array {
  let max = 0;
  for (let i = 0; i < signal.length; i++) {
    const abs = Math.abs(signal[i]);
    if (abs > max) max = abs;
  }
  if (max === 0) return signal;
  const out = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) out[i] = signal[i] / max;
  return out;
}

// ---------------------------------------------------------------------------
// Drum synthesis — faithful port of tr808.py
// ---------------------------------------------------------------------------

function synthKick(params: Record<string, number>): Float64Array {
  const tune = (params.tune ?? 50) / 100;
  const attack = (params.attack ?? 50) / 100;
  const decay = (params.decay ?? 50) / 100;
  const level = (params.level ?? 80) / 100;

  const pitch = 40 + tune * 30; // 40-70 Hz
  const pitchSweep = 100 + tune * 100;
  const sweepSpeed = 25 + (1 - decay) * 20;
  const dur = 0.2 + decay * 0.3;

  const n = Math.floor(dur * SR);
  const t = linspace(0, dur, n);
  const out = new Float64Array(n);

  // Pitch-sweeping sine
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const freq = pitch + pitchSweep * Math.exp(-t[i] * sweepSpeed);
    phase += (freq / SR) * 2 * Math.PI;
    out[i] = Math.sin(phase);
  }

  const body = env(out, 0.001, 0.05 + decay * 0.1, 0.1, 0.05 + decay * 0.1);

  // Click transient
  const click = env(highpass(noise(0.005), 3000), 0.001, 0.001, 0, 0.002);
  mixInto(body, click, 0, 0.3 * attack);

  // Apply level
  for (let i = 0; i < body.length; i++) body[i] *= level;
  return body;
}

function synthSnare(params: Record<string, number>): Float64Array {
  const tune = (params.tune ?? 50) / 100;
  const tone = (params.tone ?? 50) / 100;
  const snappy = (params.snappy ?? 50) / 100;
  const decay = (params.decay ?? 50) / 100;
  const level = (params.level ?? 80) / 100;

  const dur = 0.1 + decay * 0.15;
  const freq = 150 + tune * 100;
  const n = Math.floor(dur * SR);

  // Tone body
  const toneSignal = env(sine(freq, dur), 0.001, 0.04, 0.05 * tone, 0.08);

  // Noise body
  let ns = noise(dur);
  ns = highpass(ns, 1000);
  ns = lowpass(ns, 4000 + snappy * 2000);
  ns = env(ns, 0.001, 0.04, 0.05 + snappy * 0.1, 0.08);

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ti = i < toneSignal.length ? toneSignal[i] : 0;
    const ni = i < ns.length ? ns[i] : 0;
    out[i] = (ti * tone + ni * (1 - tone * 0.5)) * level;
  }
  return out;
}

function synthTom(params: Record<string, number>, baseFreq: number): Float64Array {
  const tune = (params.tune ?? 50) / 100;
  const decay = (params.decay ?? 50) / 100;
  const level = (params.level ?? 80) / 100;

  const freq = baseFreq * (0.7 + tune * 0.6);
  const dur = 0.15 + decay * 0.15;
  const n = Math.floor(dur * SR);
  const t = linspace(0, dur, n);
  const out = new Float64Array(n);

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const pitch = freq * (1 + 0.5 * Math.exp(-t[i] * 20));
    phase += (pitch / SR) * 2 * Math.PI;
    out[i] = Math.sin(phase);
  }

  const enved = env(out, 0.001, 0.06, 0.1, 0.05 + decay * 0.1);
  for (let i = 0; i < enved.length; i++) enved[i] *= level;
  return enved;
}

function synthRimshot(params: Record<string, number>): Float64Array {
  const level = (params.level ?? 80) / 100;
  const dur = 0.05;
  const toneSignal = env(sine(400, dur), 0.001, 0.02, 0, 0.02);
  const click = env(highpass(noise(0.003), 5000), 0.001, 0.001, 0, 0.001);
  const out = new Float64Array(toneSignal.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = toneSignal[i] * level;
    if (i < click.length) out[i] += click[i] * 0.5 * level;
  }
  return out;
}

function synthCowbell(params: Record<string, number>): Float64Array {
  const level = (params.level ?? 80) / 100;
  const dur = 0.12;
  const n = Math.floor(dur * SR);
  const t = linspace(0, dur, n);
  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const s1 = ((t[i] * 587) % 1 < 0.5) ? 1 : -1;
    const s2 = ((t[i] * 845) % 1 < 0.5) ? 1 : -1;
    out[i] = (s1 + s2) * 0.5;
  }

  const filtered = lowpass(out, 3000);
  const enved = env(filtered, 0.001, 0.03, 0.1, 0.06);
  for (let i = 0; i < enved.length; i++) enved[i] *= level;
  return enved;
}

function synthClap(params: Record<string, number>): Float64Array {
  const snappy = (params.snappy ?? 50) / 100;
  const level = (params.level ?? 80) / 100;
  const dur = 0.08 + snappy * 0.04;
  const n = Math.floor(dur * SR);
  const out = new Float64Array(n);
  const layers = 4;

  for (let l = 0; l < layers; l++) {
    let c = noise(0.02 + l * 0.005);
    c = highpass(c, 1500 + l * 400);
    c = env(c, 0.001, 0.008, 0.04, 0.015);
    const offset = Math.floor(l * 0.003 * SR);
    mixInto(out, c, offset, level);
  }
  return out;
}

function synthMaracas(params: Record<string, number>): Float64Array {
  const level = (params.level ?? 80) / 100;
  let n = noise(0.03);
  n = highpass(n, 6000);
  n = env(n, 0.001, 0.005, 0.02, 0.01);
  for (let i = 0; i < n.length; i++) n[i] *= level;
  return n;
}

function synthClaves(params: Record<string, number>): Float64Array {
  const level = (params.level ?? 80) / 100;
  const s = env(sine(2500, 0.02), 0.001, 0.005, 0, 0.01);
  for (let i = 0; i < s.length; i++) s[i] *= level;
  return s;
}

function synthCymbal(params: Record<string, number>): Float64Array {
  const tune = (params.tune ?? 50) / 100;
  const decay = (params.decay ?? 50) / 100;
  const level = (params.level ?? 80) / 100;
  const dur = 0.3 + decay * 0.5;

  let n = noise(dur);
  n = highpass(n, 4000 + tune * 4000);
  n = lowpass(n, 10000 + tune * 4000);
  n = env(n, 0.001, 0.05, 0.1 + decay * 0.1, 0.1 + decay * 0.3);
  for (let i = 0; i < n.length; i++) n[i] *= level;
  return n;
}

function synthOpenHat(params: Record<string, number>): Float64Array {
  const decay = (params.decay ?? 50) / 100;
  const level = (params.level ?? 80) / 100;
  const dur = 0.06 + decay * 0.15;

  let n = noise(dur);
  n = highpass(n, 6000);
  n = env(n, 0.001, 0.02, 0.08 + decay * 0.1, 0.04);
  for (let i = 0; i < n.length; i++) n[i] *= level;
  return n;
}

function synthClosedHat(params: Record<string, number>): Float64Array {
  const level = (params.level ?? 80) / 100;
  let n = noise(0.03);
  n = highpass(n, 8000);
  n = env(n, 0.001, 0.005, 0.02, 0.005);
  for (let i = 0; i < n.length; i++) n[i] *= level;
  return n;
}

// ---------------------------------------------------------------------------
// WAV encoding
// ---------------------------------------------------------------------------

function encodeWav(samples: Float64Array, sampleRate = SR): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buf.write("RIFF", offset); offset += 4;
  buf.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buf.write("WAVE", offset); offset += 4;

  // fmt chunk
  buf.write("fmt ", offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4; // chunk size
  buf.writeUInt16LE(1, offset); offset += 2; // PCM
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4;
  buf.writeUInt16LE(blockAlign, offset); offset += 2;
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buf.write("data", offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = Math.round(clamped * 32767);
    buf.writeInt16LE(int16, offset); offset += 2;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Audio manager
// ---------------------------------------------------------------------------

const SYNTH_MAP: Record<InstrumentId, (params: Record<string, number>) => Float64Array> = {
  bd: synthKick,
  sd: synthSnare,
  lt: (p) => synthTom(p, 100),
  mt: (p) => synthTom(p, 150),
  ht: (p) => synthTom(p, 200),
  rs: synthRimshot,
  cb: synthCowbell,
  cp: synthClap,
  ma: synthMaracas,
  cl: synthClaves,
  cy: synthCymbal,
  oh: synthOpenHat,
  ch: synthClosedHat,
};

export class TR808Audio {
  private sampleDir: string;
  private procs: ChildProcess[] = [];
  private enabled = true;

  constructor() {
    this.sampleDir = join(tmpdir(), "wibwob-tr808-samples");
    mkdirSync(this.sampleDir, { recursive: true });
  }

  /** Pre-render all default samples */
  renderSamples(allParams: Record<InstrumentId, Record<string, number>>): void {
    for (const [id, synthFn] of Object.entries(SYNTH_MAP)) {
      const params = allParams[id as InstrumentId] ?? {};
      const samples = normalize(synthFn(params));
      const wav = encodeWav(samples);
      writeFileSync(join(this.sampleDir, `${id}.wav`), wav);
    }
  }

  /** Render a single instrument sample (call after param change) */
  renderSingle(id: InstrumentId, params: Record<string, number>): void {
    const synthFn = SYNTH_MAP[id];
    if (!synthFn) return;
    const samples = normalize(synthFn(params));
    const wav = encodeWav(samples);
    writeFileSync(join(this.sampleDir, `${id}.wav`), wav);
  }

  /** Play a drum hit — spawns afplay in background */
  play(id: InstrumentId, accentBoost = false): void {
    if (!this.enabled) return;
    const wavPath = join(this.sampleDir, `${id}.wav`);
    if (!existsSync(wavPath)) return;

    const vol = accentBoost ? "1.2" : "0.9";
    const proc = spawn("afplay", ["-v", vol, wavPath], {
      stdio: "ignore",
      detached: true,
    });
    proc.unref();

    // Track for cleanup
    this.procs.push(proc);
    proc.on("exit", () => {
      this.procs = this.procs.filter(p => p !== proc);
    });
  }

  /** Play multiple hits simultaneously (one step) */
  playStep(instruments: InstrumentId[], accent: boolean): void {
    for (const id of instruments) {
      this.play(id, accent);
    }
  }

  /** Enable/disable audio */
  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Bounce current pattern to a WAV file.
   * Renders one full loop of the pattern at the given tempo.
   */
  bouncePattern(
    instruments: { id: InstrumentId; steps: boolean[]; params: Record<string, number> }[],
    accent: boolean[],
    tempo: number,
    lastStep: number,
    outPath: string,
    loops = 2,
  ): string {
    const stepDurSec = 60 / tempo / 4; // 16th note duration
    const loopDurSec = lastStep * stepDurSec;
    const totalDurSec = loopDurSec * loops;
    const totalSamples = Math.ceil(totalDurSec * SR);
    const mix = new Float64Array(totalSamples);

    for (let loop = 0; loop < loops; loop++) {
      for (let step = 0; step < lastStep; step++) {
        const stepOffset = Math.floor((loop * loopDurSec + step * stepDurSec) * SR);
        const isAccented = accent[step];

        for (const inst of instruments) {
          if (!inst.steps[step]) continue;
          const synthFn = SYNTH_MAP[inst.id];
          if (!synthFn) continue;

          const samples = synthFn(inst.params);
          const vol = isAccented ? 1.2 : 0.9;
          mixInto(mix, samples, stepOffset, vol);
        }
      }
    }

    // Normalize
    const normalized = normalize(mix);
    const wav = encodeWav(normalized);
    writeFileSync(outPath, wav);
    return outPath;
  }

  /** Kill all playing sounds and clean up */
  destroy(): void {
    for (const proc of this.procs) {
      try { proc.kill(); } catch {}
    }
    this.procs = [];

    // Clean up sample files
    try {
      for (const id of Object.keys(SYNTH_MAP)) {
        const wavPath = join(this.sampleDir, `${id}.wav`);
        if (existsSync(wavPath)) unlinkSync(wavPath);
      }
    } catch {}
  }
}
