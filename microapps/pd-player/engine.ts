/**
 * Pure Data Engine — patch parser, DSP graph, and audio scheduler.
 *
 * Parses the Pd text file format and evaluates a subset of DSP objects
 * sufficient for musical patches: oscillators, filters, envelopes, math.
 *
 * Pure state machine — no UI, no sound output.
 */

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
      canvasWidth = num(tokens[4], 450);
      canvasHeight = num(tokens[5], 300);
      continue;
    }

    if (tokens[0] === "#X" && tokens[1] === "obj") {
      const x = num(tokens[2], 0);
      const y = num(tokens[3], 0);
      const type = String(tokens[4] ?? "");
      const args = tokens.slice(5).map(t => {
        const n = Number(t);
        return Number.isFinite(n) ? n : String(t);
      });
      objects.push({ id: nextId++, type, args, x, y });
      continue;
    }

    if (tokens[0] === "#X" && tokens[1] === "msg") {
      const x = num(tokens[2], 0);
      const y = num(tokens[3], 0);
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
        sourceId: num(tokens[2], 0),
        sourceOutlet: num(tokens[3], 0),
        sinkId: num(tokens[4], 0),
        sinkInlet: num(tokens[5], 0),
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
    while (i < line.length && line[i] !== " " && line[i] !== ";") {
      tok += line[i];
      i++;
    }
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
// Serializer — writes .pd text format
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
// DSP evaluation — offline render of patch to audio buffer
// ---------------------------------------------------------------------------

export const SAMPLE_RATE = 22050;
const TWO_PI = 2 * Math.PI;

export type DspNodeState = {
  type: string;
  phase: number;
  freq: number;
  value: number;
  buffer: Float64Array;
  filterState: number;
  envTarget: number;
  envRate: number;
  delayBuffer: Float64Array;
  delayWritePos: number;
  table: Float64Array;
};

function createNodeState(): DspNodeState {
  return {
    type: "",
    phase: 0,
    freq: 440,
    value: 0,
    buffer: new Float64Array(0),
    filterState: 0,
    envTarget: 0,
    envRate: 0,
    delayBuffer: new Float64Array(0),
    delayWritePos: 0,
    table: new Float64Array(0),
  };
}

/** Topological sort of patch objects by connections (source before sink). */
export function topoSort(patch: PdPatch): number[] {
  const n = patch.objects.length;
  const inDegree = new Map<number, number>();
  const adj = new Map<number, number[]>();

  for (const obj of patch.objects) {
    inDegree.set(obj.id, 0);
    adj.set(obj.id, []);
  }
  for (const conn of patch.connections) {
    adj.get(conn.sourceId)?.push(conn.sinkId);
    inDegree.set(conn.sinkId, (inDegree.get(conn.sinkId) ?? 0) + 1);
  }

  const queue: number[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  // If cyclic, append remaining nodes
  if (sorted.length < n) {
    for (const obj of patch.objects) {
      if (!sorted.includes(obj.id)) sorted.push(obj.id);
    }
  }

  return sorted;
}

/**
 * Render a Pd patch to an audio buffer.
 * Returns a Float64Array of mono samples at SAMPLE_RATE.
 */
export function renderPatch(patch: PdPatch, durationSec: number): Float64Array {
  const numSamples = Math.floor(durationSec * SAMPLE_RATE);
  const output = new Float64Array(numSamples);
  if (patch.objects.length === 0) return output;

  const objMap = new Map<number, PdObject>();
  for (const obj of patch.objects) objMap.set(obj.id, obj);

  const states = new Map<number, DspNodeState>();
  for (const obj of patch.objects) {
    const s = createNodeState();
    s.type = obj.type;

    switch (obj.type) {
      case "osc~":
        s.freq = numArg(obj.args, 0, 440);
        break;
      case "phasor~":
        s.freq = numArg(obj.args, 0, 440);
        break;
      case "noise~":
        break;
      case "*~":
      case "+~":
      case "-~":
        s.value = numArg(obj.args, 0, obj.type === "*~" ? 1 : 0);
        break;
      case "lop~":
        s.freq = numArg(obj.args, 0, 1000);
        break;
      case "hip~":
        s.freq = numArg(obj.args, 0, 100);
        break;
      case "line~":
        s.value = 0;
        s.envTarget = 0;
        s.envRate = 0;
        break;
      case "vline~":
        s.value = 0;
        s.envTarget = 0;
        s.envRate = 0;
        break;
      case "delwrite~": {
        const delayMs = numArg(obj.args, 1, 500);
        const delaySamples = Math.floor((delayMs / 1000) * SAMPLE_RATE);
        s.delayBuffer = new Float64Array(Math.max(1, delaySamples));
        break;
      }
      case "delread~": {
        const delayMs = numArg(obj.args, 1, 100);
        s.value = delayMs;
        break;
      }
      case "clip~":
        break;
      case "dac~":
        break;
      case "metro":
        s.value = numArg(obj.args, 0, 500); // interval ms
        break;
      case "floatatom":
        s.value = 0;
        break;
      case "msg":
        break;
      case "tabwrite~": {
        const tableSize = 1024;
        s.table = new Float64Array(tableSize);
        break;
      }
      case "tabosc4~":
        s.freq = numArg(obj.args, 0, 440);
        break;
      case "wrap~":
        break;
      case "abs~":
        break;
      case "sqrt~":
        break;
      case "pow~":
        s.value = numArg(obj.args, 0, 2);
        break;
      case "max~":
        s.value = numArg(obj.args, 0, 0);
        break;
      case "min~":
        s.value = numArg(obj.args, 0, 1);
        break;
      case "bp~": // bandpass filter
        s.freq = numArg(obj.args, 0, 1000);
        s.value = numArg(obj.args, 1, 1); // Q
        break;
      case "vcf~": // voltage-controlled filter
        s.freq = numArg(obj.args, 0, 1000);
        s.value = numArg(obj.args, 1, 5); // Q
        break;
      case "samphold~": // sample and hold
        break;
      case "rpole~": // real one-pole recursive filter
        s.value = numArg(obj.args, 0, 0);
        break;
      case "rzero~": // real one-zero filter
        s.value = numArg(obj.args, 0, 0);
        break;
      case "sig~": // signal constant
        s.value = numArg(obj.args, 0, 0);
        break;
      case "snapshot~":
        break;
      case "env~": // envelope follower
        s.value = numArg(obj.args, 0, 1024); // window size
        break;
      case "tabread~":
        break;
      default:
        break;
    }

    states.set(obj.id, s);
  }

  // Build connection lookup: for each object+inlet, what source provides input?
  const inlets = new Map<string, { sourceId: number; outlet: number }[]>();
  for (const conn of patch.connections) {
    const key = `${conn.sinkId}:${conn.sinkInlet}`;
    if (!inlets.has(key)) inlets.set(key, []);
    inlets.get(key)!.push({ sourceId: conn.sourceId, outlet: conn.sourceOutlet });
  }

  // Named delay lines (for delwrite~/delread~ pairs)
  const delayLines = new Map<string, DspNodeState>();
  for (const obj of patch.objects) {
    if (obj.type === "delwrite~" && typeof obj.args[0] === "string") {
      delayLines.set(obj.args[0], states.get(obj.id)!);
    }
  }

  const order = topoSort(patch);
  const nodeOutputs = new Map<string, number>(); // "id:outlet" → sample value

  // Process sample by sample
  for (let i = 0; i < numSamples; i++) {
    nodeOutputs.clear();

    for (const id of order) {
      const obj = objMap.get(id)!;
      const s = states.get(id)!;

      // Gather inputs
      const getInput = (inlet: number, fallback: number): number => {
        const key = `${id}:${inlet}`;
        const sources = inlets.get(key);
        if (!sources || sources.length === 0) return fallback;
        let sum = 0;
        for (const src of sources) {
          sum += nodeOutputs.get(`${src.sourceId}:${src.outlet}`) ?? 0;
        }
        return sum;
      };

      let out = 0;

      switch (obj.type) {
        case "osc~": {
          const freq = getInput(0, s.freq);
          s.phase += (freq / SAMPLE_RATE) * TWO_PI;
          if (s.phase > TWO_PI) s.phase -= TWO_PI;
          out = Math.sin(s.phase);
          break;
        }
        case "phasor~": {
          const freq = getInput(0, s.freq);
          s.phase += freq / SAMPLE_RATE;
          if (s.phase >= 1) s.phase -= 1;
          out = s.phase;
          break;
        }
        case "noise~": {
          out = Math.random() * 2 - 1;
          break;
        }
        case "*~": {
          const a = getInput(0, 0);
          const b = getInput(1, s.value);
          out = a * b;
          break;
        }
        case "+~": {
          const a = getInput(0, 0);
          const b = getInput(1, s.value);
          out = a + b;
          break;
        }
        case "-~": {
          const a = getInput(0, 0);
          const b = getInput(1, s.value);
          out = a - b;
          break;
        }
        case "lop~": {
          const input = getInput(0, 0);
          const cutoff = getInput(1, s.freq);
          const rc = 1 / (TWO_PI * Math.max(1, cutoff));
          const dt = 1 / SAMPLE_RATE;
          const alpha = dt / (rc + dt);
          s.filterState += alpha * (input - s.filterState);
          out = s.filterState;
          break;
        }
        case "hip~": {
          const input = getInput(0, 0);
          const cutoff = getInput(1, s.freq);
          const rc = 1 / (TWO_PI * Math.max(1, cutoff));
          const dt = 1 / SAMPLE_RATE;
          const alpha = rc / (rc + dt);
          const prev = s.value;
          s.value = input;
          s.filterState = alpha * (s.filterState + input - prev);
          out = s.filterState;
          break;
        }
        case "line~": {
          // Simple ramp generator
          if (s.envRate > 0) {
            const step = (s.envTarget - s.value) * (1 / (s.envRate * SAMPLE_RATE / 1000));
            if (Math.abs(s.envTarget - s.value) < Math.abs(step)) {
              s.value = s.envTarget;
              s.envRate = 0;
            } else {
              s.value += step > 0
                ? Math.min(step, s.envTarget - s.value)
                : Math.max(step, s.envTarget - s.value);
            }
          }
          out = s.value;
          break;
        }
        case "vline~": {
          // Same as line~ for our subset
          if (s.envRate > 0) {
            const step = (s.envTarget - s.value) / (s.envRate * SAMPLE_RATE / 1000);
            s.value += step;
            if ((step > 0 && s.value >= s.envTarget) || (step < 0 && s.value <= s.envTarget)) {
              s.value = s.envTarget;
              s.envRate = 0;
            }
          }
          out = s.value;
          break;
        }
        case "delwrite~": {
          const input = getInput(0, 0);
          s.delayBuffer[s.delayWritePos] = input;
          s.delayWritePos = (s.delayWritePos + 1) % s.delayBuffer.length;
          out = 0;
          break;
        }
        case "delread~": {
          const delayName = typeof obj.args[0] === "string" ? obj.args[0] : "";
          const delState = delayLines.get(delayName);
          if (delState) {
            const delaySamples = Math.floor((s.value / 1000) * SAMPLE_RATE);
            const readPos = (delState.delayWritePos - delaySamples + delState.delayBuffer.length * 2) % delState.delayBuffer.length;
            out = delState.delayBuffer[Math.floor(readPos)] ?? 0;
          }
          break;
        }
        case "clip~": {
          const input = getInput(0, 0);
          const lo = numArg(obj.args, 0, -1);
          const hi = numArg(obj.args, 1, 1);
          out = Math.max(lo, Math.min(hi, input));
          break;
        }
        case "wrap~": {
          const input = getInput(0, 0);
          out = input - Math.floor(input);
          break;
        }
        case "abs~": {
          out = Math.abs(getInput(0, 0));
          break;
        }
        case "sqrt~": {
          out = Math.sqrt(Math.abs(getInput(0, 0)));
          break;
        }
        case "pow~": {
          const base = getInput(0, 0);
          const exp = getInput(1, s.value);
          out = Math.pow(Math.abs(base), exp) * (base < 0 ? -1 : 1);
          break;
        }
        case "max~": {
          out = Math.max(getInput(0, 0), getInput(1, s.value));
          break;
        }
        case "min~": {
          out = Math.min(getInput(0, 0), getInput(1, s.value));
          break;
        }
        case "bp~": {
          // Simple bandpass via difference of two lowpass filters
          const input = getInput(0, 0);
          const centerFreq = getInput(1, s.freq);
          const q = Math.max(0.1, s.value);
          const bw = centerFreq / q;
          const rcLo = 1 / (TWO_PI * Math.min(SAMPLE_RATE / 2, centerFreq + bw / 2));
          const rcHi = 1 / (TWO_PI * Math.max(1, centerFreq - bw / 2));
          const dtBp = 1 / SAMPLE_RATE;
          const alphaLo = dtBp / (rcLo + dtBp);
          const alphaHi = rcHi / (rcHi + dtBp);
          // Low-pass part
          s.filterState += alphaLo * (input - s.filterState);
          // High-pass part (reuse envTarget as second state)
          const prevHp = s.envTarget;
          s.envTarget = alphaHi * (prevHp + s.filterState - s.envRate);
          s.envRate = s.filterState;
          out = s.envTarget;
          break;
        }
        case "vcf~": {
          // Voltage-controlled resonant filter — state variable approach
          const input = getInput(0, 0);
          const cutoff = getInput(1, s.freq);
          const q = Math.max(0.5, Math.min(20, s.value));
          const freq = Math.min(cutoff, SAMPLE_RATE * 0.4);
          const w = 2 * Math.sin(Math.PI * freq / SAMPLE_RATE);
          const fb = 1 / q;
          // State variable filter
          const lp = s.filterState + w * s.envRate;
          const hp = input - lp - fb * s.envRate;
          const bp = w * hp + s.envRate;
          s.filterState = Math.max(-10, Math.min(10, lp));
          s.envRate = Math.max(-10, Math.min(10, bp));
          out = s.filterState; // lowpass output
          break;
        }
        case "samphold~": {
          const input = getInput(0, 0);
          const trigger = getInput(1, 0);
          // Sample when trigger crosses zero upward
          if (trigger > 0 && s.envRate <= 0) s.value = input;
          s.envRate = trigger;
          out = s.value;
          break;
        }
        case "rpole~": {
          const input = getInput(0, 0);
          const coeff = getInput(1, s.value);
          s.filterState = input + coeff * s.filterState;
          out = s.filterState;
          break;
        }
        case "rzero~": {
          const input = getInput(0, 0);
          const coeff = getInput(1, s.value);
          out = input - coeff * s.filterState;
          s.filterState = input;
          break;
        }
        case "sig~": {
          out = getInput(0, s.value);
          break;
        }
        case "env~": {
          const input = getInput(0, 0);
          // Simple envelope follower
          const absInput = Math.abs(input);
          if (absInput > s.filterState) {
            s.filterState = absInput;
          } else {
            s.filterState *= 0.9995; // slow release
          }
          out = s.filterState;
          break;
        }
        case "snapshot~": {
          out = getInput(0, s.value);
          s.value = out;
          break;
        }
        case "dac~": {
          const left = getInput(0, 0);
          const right = getInput(1, left);
          out = (left + right) * 0.5;
          output[i] += out;
          break;
        }
        case "floatatom": {
          out = getInput(0, s.value);
          s.value = out;
          break;
        }
        default: {
          out = getInput(0, 0);
          break;
        }
      }

      nodeOutputs.set(`${id}:0`, out);
      // Secondary outlet for some objects
      if (obj.type === "noise~" || obj.type === "osc~" || obj.type === "phasor~") {
        nodeOutputs.set(`${id}:1`, out);
      }
    }
  }

  // Normalize
  let peak = 0;
  for (let i = 0; i < output.length; i++) {
    const abs = Math.abs(output[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const scale = 0.9 / peak;
    for (let i = 0; i < output.length; i++) output[i] *= scale;
  }

  return output;
}

function numArg(args: (string | number)[], idx: number, fallback: number): number {
  const v = args[idx];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// WAV encoding (matches TR-808 approach)
// ---------------------------------------------------------------------------

export function encodeWav(samples: Float64Array, sampleRate = SAMPLE_RATE): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let offset = 0;

  buf.write("RIFF", offset); offset += 4;
  buf.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buf.write("WAVE", offset); offset += 4;

  buf.write("fmt ", offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;
  buf.writeUInt16LE(1, offset); offset += 2;
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4;
  buf.writeUInt16LE(blockAlign, offset); offset += 2;
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

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
// Preset patches
// ---------------------------------------------------------------------------

export const PRESET_PATCHES: Record<string, string> = {
  "sine-drone": `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 220;
#X obj 100 100 *~ 0.3;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 1 0 2 1;
`,

  "detuned-pad": `#N canvas 0 0 500 350 12;
#X obj 50 50 osc~ 220;
#X obj 200 50 osc~ 222;
#X obj 125 120 +~ 0;
#X obj 125 170 *~ 0.25;
#X obj 125 220 lop~ 800;
#X obj 125 270 dac~;
#X connect 0 0 2 0;
#X connect 1 0 2 1;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 4 0 5 1;
`,

  "bass-pulse": `#N canvas 0 0 500 400 12;
#X obj 100 50 phasor~ 55;
#X obj 100 100 *~ 2;
#X obj 100 150 clip~ -1 1;
#X obj 100 200 lop~ 400;
#X obj 100 250 *~ 0.4;
#X obj 100 300 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 4 0 5 1;
`,

  "noise-filter": `#N canvas 0 0 500 350 12;
#X obj 100 50 noise~;
#X obj 100 100 lop~ 500;
#X obj 100 150 hip~ 200;
#X obj 100 200 *~ 0.3;
#X obj 100 250 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 0 4 1;
`,

  "fm-bell": `#N canvas 0 0 550 400 12;
#X obj 100 50 osc~ 880;
#X obj 100 100 *~ 200;
#X obj 100 150 +~ 440;
#X obj 100 200 osc~ 440;
#X obj 100 260 *~ 0.3;
#X obj 100 310 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 4 0 5 1;
`,

  "dual-saw": `#N canvas 0 0 500 400 12;
#X obj 50 50 phasor~ 110;
#X obj 200 50 phasor~ 165;
#X obj 50 100 *~ 2;
#X obj 200 100 *~ 2;
#X obj 50 150 -~ 1;
#X obj 200 150 -~ 1;
#X obj 125 200 +~ 0;
#X obj 125 250 *~ 0.2;
#X obj 125 300 lop~ 2000;
#X obj 125 350 dac~;
#X connect 0 0 2 0;
#X connect 1 0 3 0;
#X connect 2 0 4 0;
#X connect 3 0 5 0;
#X connect 4 0 6 0;
#X connect 5 0 6 1;
#X connect 6 0 7 0;
#X connect 7 0 8 0;
#X connect 8 0 9 0;
#X connect 8 0 9 1;
`,

  "noise-burst": `#N canvas 0 0 450 350 12;
#X obj 100 50 noise~;
#X obj 100 100 hip~ 4000;
#X obj 100 150 *~ 0.5;
#X obj 100 200 lop~ 8000;
#X obj 100 250 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 3 0 4 1;
`,

  "sub-bass": `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 40;
#X obj 100 100 *~ 0.6;
#X obj 100 150 lop~ 80;
#X obj 100 200 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 2 0 3 1;
`,

  "delay-drone": `#N canvas 0 0 600 400 12;
#X obj 100 50 osc~ 330;
#X obj 100 100 *~ 0.15;
#X obj 250 50 osc~ 333;
#X obj 250 100 *~ 0.15;
#X obj 175 150 +~ 0;
#X obj 175 200 lop~ 1200;
#X obj 175 250 *~ 0.5;
#X obj 175 300 dac~;
#X connect 0 0 1 0;
#X connect 1 0 4 0;
#X connect 2 0 3 0;
#X connect 3 0 4 1;
#X connect 4 0 5 0;
#X connect 5 0 6 0;
#X connect 6 0 7 0;
#X connect 6 0 7 1;
`,

  "ring-mod": `#N canvas 0 0 500 400 12;
#X obj 100 50 osc~ 440;
#X obj 250 50 osc~ 55;
#X obj 175 120 *~ 0;
#X obj 175 170 *~ 0.4;
#X obj 175 220 lop~ 3000;
#X obj 175 270 dac~;
#X connect 0 0 2 0;
#X connect 1 0 2 1;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 4 0 5 1;
`,

  "harsh-square": `#N canvas 0 0 500 350 12;
#X obj 100 50 phasor~ 110;
#X obj 100 100 -~ 0.5;
#X obj 100 150 clip~ -0.5 0.5;
#X obj 100 200 *~ 4;
#X obj 100 250 clip~ -1 1;
#X obj 100 300 *~ 0.3;
#X obj 100 350 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 5 0 6 0;
#X connect 5 0 6 1;
`,

  "organ-tones": `#N canvas 0 0 600 400 12;
#X obj 50 50 osc~ 261;
#X obj 200 50 osc~ 522;
#X obj 350 50 osc~ 783;
#X obj 50 100 *~ 0.3;
#X obj 200 100 *~ 0.15;
#X obj 350 100 *~ 0.08;
#X obj 175 170 +~ 0;
#X obj 175 210 +~ 0;
#X obj 175 260 lop~ 2000;
#X obj 175 310 dac~;
#X connect 0 0 3 0;
#X connect 1 0 4 0;
#X connect 2 0 5 0;
#X connect 3 0 6 0;
#X connect 4 0 6 1;
#X connect 5 0 7 1;
#X connect 6 0 7 0;
#X connect 7 0 8 0;
#X connect 8 0 9 0;
#X connect 8 0 9 1;
`,

  "wind": `#N canvas 0 0 500 350 12;
#X obj 100 50 noise~;
#X obj 100 100 lop~ 300;
#X obj 100 150 hip~ 50;
#X obj 100 200 *~ 0.8;
#X obj 100 250 lop~ 200;
#X obj 100 300 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 4 0 5 1;
`,

  "theremin": `#N canvas 0 0 500 400 12;
#X obj 100 50 osc~ 3;
#X obj 100 100 *~ 50;
#X obj 100 150 +~ 440;
#X obj 100 200 osc~ 440;
#X obj 100 260 *~ 0.35;
#X obj 100 310 lop~ 2000;
#X obj 100 360 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 3 0 4 0;
#X connect 4 0 5 0;
#X connect 5 0 6 0;
#X connect 5 0 6 1;
`,
};

export const PRESET_NAMES = Object.keys(PRESET_PATCHES);

// ---------------------------------------------------------------------------
// Engine — manages patches, playback state
// ---------------------------------------------------------------------------

export type TransportState = "stopped" | "playing" | "rendering";

export type EngineEvent =
  | { type: "transport"; state: TransportState }
  | { type: "patch-loaded"; name: string }
  | { type: "patch-modified" }
  | { type: "render-complete"; durationSec: number }
  | { type: "cursor-moved"; objectId: number }
  | { type: "object-selected"; objectId: number };

export type EngineListener = (event: EngineEvent) => void;

export class PdEngine {
  private _patch: PdPatch;
  private _transport: TransportState = "stopped";
  private _selectedObjectId = -1;
  private _cursorIndex = 0;
  private _audioBuffer: Float64Array | null = null;
  private _renderDuration = 4; // seconds
  private listeners: EngineListener[] = [];

  constructor() {
    this._patch = parsePdPatch(PRESET_PATCHES["sine-drone"]!, "sine-drone");
  }

  // -- Listeners --

  on(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }

  // -- Patch access --

  get patch(): PdPatch { return this._patch; }

  get transport(): TransportState { return this._transport; }

  get selectedObjectId(): number { return this._selectedObjectId; }

  get cursorIndex(): number { return this._cursorIndex; }

  get audioBuffer(): Float64Array | null { return this._audioBuffer; }

  get renderDuration(): number { return this._renderDuration; }

  set renderDuration(sec: number) {
    this._renderDuration = Math.max(0.5, Math.min(30, sec));
  }

  // -- Loading --

  loadSource(source: string, name = "untitled"): void {
    this._patch = parsePdPatch(source, name);
    this._selectedObjectId = -1;
    this._cursorIndex = 0;
    this._audioBuffer = null;
    this._transport = "stopped";
    this.emit({ type: "patch-loaded", name });
  }

  loadPreset(name: string): void {
    const src = PRESET_PATCHES[name];
    if (!src) return;
    this.loadSource(src, name);
  }

  // -- Serialization --

  serialize(): Record<string, unknown> {
    return {
      source: serializePdPatch(this._patch),
      name: this._patch.name,
      renderDuration: this._renderDuration,
      selectedObjectId: this._selectedObjectId,
      cursorIndex: this._cursorIndex,
    };
  }

  hydrate(data: Record<string, unknown>): void {
    if (typeof data.source === "string" && data.source.trim()) {
      const name = typeof data.name === "string" ? data.name : "restored";
      this._patch = parsePdPatch(data.source, name);
    }
    if (typeof data.renderDuration === "number") this._renderDuration = data.renderDuration;
    if (typeof data.selectedObjectId === "number") this._selectedObjectId = data.selectedObjectId;
    if (typeof data.cursorIndex === "number") this._cursorIndex = data.cursorIndex;
  }

  // -- Rendering / playback --

  render(): Float64Array {
    this._transport = "rendering";
    this.emit({ type: "transport", state: "rendering" });
    this._audioBuffer = renderPatch(this._patch, this._renderDuration);
    this._transport = "stopped";
    this.emit({ type: "render-complete", durationSec: this._renderDuration });
    this.emit({ type: "transport", state: "stopped" });
    return this._audioBuffer;
  }

  play(): void {
    if (!this._audioBuffer) this.render();
    this._transport = "playing";
    this.emit({ type: "transport", state: "playing" });
  }

  stop(): void {
    this._transport = "stopped";
    this.emit({ type: "transport", state: "stopped" });
  }

  toggle(): void {
    if (this._transport === "playing") this.stop();
    else this.play();
  }

  // -- Object selection / cursor --

  selectObject(id: number): void {
    this._selectedObjectId = id;
    this.emit({ type: "object-selected", objectId: id });
  }

  moveCursor(delta: number): void {
    const len = this._patch.objects.length;
    if (len === 0) return;
    this._cursorIndex = ((this._cursorIndex + delta) % len + len) % len;
    this._selectedObjectId = this._patch.objects[this._cursorIndex]!.id;
    this.emit({ type: "cursor-moved", objectId: this._selectedObjectId });
  }

  // -- Patch editing --

  addObject(type: string, args: (string | number)[] = [], x = 100, y = 100): number {
    const maxId = this._patch.objects.reduce((m, o) => Math.max(m, o.id), -1);
    const id = maxId + 1;
    // Auto-position below the last object
    const lastObj = this._patch.objects[this._patch.objects.length - 1];
    const autoY = lastObj ? lastObj.y + 50 : y;
    const autoX = lastObj ? lastObj.x : x;
    this._patch.objects.push({ id, type, args, x: autoX, y: autoY });
    this._cursorIndex = this._patch.objects.length - 1;
    this._selectedObjectId = id;
    this._audioBuffer = null;
    this.emit({ type: "patch-modified" });
    return id;
  }

  removeObject(id: number): void {
    this._patch.objects = this._patch.objects.filter(o => o.id !== id);
    this._patch.connections = this._patch.connections.filter(
      c => c.sourceId !== id && c.sinkId !== id
    );
    if (this._selectedObjectId === id) {
      this._selectedObjectId = -1;
      this._cursorIndex = Math.min(this._cursorIndex, this._patch.objects.length - 1);
    }
    this._audioBuffer = null;
    this.emit({ type: "patch-modified" });
  }

  addConnection(sourceId: number, sourceOutlet: number, sinkId: number, sinkInlet: number): void {
    // Prevent duplicate connections
    const exists = this._patch.connections.some(
      c => c.sourceId === sourceId && c.sourceOutlet === sourceOutlet &&
           c.sinkId === sinkId && c.sinkInlet === sinkInlet
    );
    if (exists) return;
    this._patch.connections.push({ sourceId, sourceOutlet, sinkId, sinkInlet });
    this._audioBuffer = null;
    this.emit({ type: "patch-modified" });
  }

  removeConnection(sourceId: number, sourceOutlet: number, sinkId: number, sinkInlet: number): void {
    this._patch.connections = this._patch.connections.filter(
      c => !(c.sourceId === sourceId && c.sourceOutlet === sourceOutlet &&
             c.sinkId === sinkId && c.sinkInlet === sinkInlet)
    );
    this._audioBuffer = null;
    this.emit({ type: "patch-modified" });
  }

  clearPatch(): void {
    this._patch = {
      name: "new-patch",
      canvasWidth: 450,
      canvasHeight: 300,
      objects: [],
      connections: [],
    };
    this._selectedObjectId = -1;
    this._cursorIndex = 0;
    this._audioBuffer = null;
    this.emit({ type: "patch-modified" });
  }

  getSource(): string {
    return serializePdPatch(this._patch);
  }

  // -- Query helpers --

  getObjectById(id: number): PdObject | undefined {
    return this._patch.objects.find(o => o.id === id);
  }

  getConnectionsFrom(id: number): PdConnection[] {
    return this._patch.connections.filter(c => c.sourceId === id);
  }

  getConnectionsTo(id: number): PdConnection[] {
    return this._patch.connections.filter(c => c.sinkId === id);
  }

  destroy(): void {
    this.listeners = [];
    this._audioBuffer = null;
  }
}
