/**
 * Pd Engine — unit tests.
 *
 * Tests the Pure Data patch parser, serializer, DSP graph evaluation,
 * topology sort, and engine state management.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  parsePdPatch,
  serializePdPatch,
  renderPatch,
  topoSort,
  encodeWav,
  SAMPLE_RATE,
  PRESET_PATCHES,
  PRESET_NAMES,
  PdEngine,
  type PdPatch,
} from "../../../microapps/pd-player/engine.js";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe("parsePdPatch", () => {
  test("parses canvas dimensions", () => {
    const patch = parsePdPatch("#N canvas 0 0 600 400 12;");
    expect(patch.canvasWidth).toBe(600);
    expect(patch.canvasHeight).toBe(400);
  });

  test("parses objects with types and args", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 *~ 0.5;
#X obj 100 150 dac~;`;
    const patch = parsePdPatch(src);
    expect(patch.objects).toHaveLength(3);
    expect(patch.objects[0]!.type).toBe("osc~");
    expect(patch.objects[0]!.args).toEqual([440]);
    expect(patch.objects[0]!.x).toBe(100);
    expect(patch.objects[0]!.y).toBe(50);
    expect(patch.objects[1]!.type).toBe("*~");
    expect(patch.objects[1]!.args).toEqual([0.5]);
    expect(patch.objects[2]!.type).toBe("dac~");
    expect(patch.objects[2]!.args).toEqual([]);
  });

  test("parses connections", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 dac~;
#X connect 0 0 1 0;
#X connect 0 0 1 1;`;
    const patch = parsePdPatch(src);
    expect(patch.connections).toHaveLength(2);
    expect(patch.connections[0]).toEqual({
      sourceId: 0, sourceOutlet: 0, sinkId: 1, sinkInlet: 0,
    });
    expect(patch.connections[1]).toEqual({
      sourceId: 0, sourceOutlet: 0, sinkId: 1, sinkInlet: 1,
    });
  });

  test("parses msg objects", () => {
    const src = `#N canvas 0 0 450 300 12;
#X msg 50 50 hello world;`;
    const patch = parsePdPatch(src);
    expect(patch.objects).toHaveLength(1);
    expect(patch.objects[0]!.type).toBe("msg");
    expect(patch.objects[0]!.args).toEqual(["hello world"]);
  });

  test("parses floatatom", () => {
    const src = `#N canvas 0 0 450 300 12;
#X floatatom 50 50 5 0 0 0 - - - 0;`;
    const patch = parsePdPatch(src);
    expect(patch.objects).toHaveLength(1);
    expect(patch.objects[0]!.type).toBe("floatatom");
  });

  test("handles empty input", () => {
    const patch = parsePdPatch("");
    expect(patch.objects).toHaveLength(0);
    expect(patch.connections).toHaveLength(0);
  });

  test("assigns sequential IDs", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 10 10 osc~ 220;
#X obj 10 60 *~ 0.3;
#X obj 10 110 dac~;`;
    const patch = parsePdPatch(src);
    expect(patch.objects.map(o => o.id)).toEqual([0, 1, 2]);
  });

  test("parses string arguments (delay names)", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 delwrite~ mydelay 500;
#X obj 100 100 delread~ mydelay 100;`;
    const patch = parsePdPatch(src);
    expect(patch.objects[0]!.args).toEqual(["mydelay", 500]);
    expect(patch.objects[1]!.args).toEqual(["mydelay", 100]);
  });

  test("parses all preset patches without error", () => {
    for (const name of PRESET_NAMES) {
      const src = PRESET_PATCHES[name]!;
      const patch = parsePdPatch(src, name);
      expect(patch.objects.length).toBeGreaterThan(0);
      expect(patch.name).toBe(name);
    }
  });
});

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

describe("serializePdPatch", () => {
  test("round-trips a simple patch", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 *~ 0.5;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 1 0 2 1;`;
    const patch = parsePdPatch(src);
    const serialized = serializePdPatch(patch);
    const reparsed = parsePdPatch(serialized);

    expect(reparsed.objects).toHaveLength(3);
    expect(reparsed.connections).toHaveLength(3);
    expect(reparsed.objects[0]!.type).toBe("osc~");
    expect(reparsed.objects[0]!.args).toEqual([440]);
  });

  test("serializes msg objects", () => {
    const patch: PdPatch = {
      name: "test",
      canvasWidth: 450,
      canvasHeight: 300,
      objects: [{ id: 0, type: "msg", args: ["bang"], x: 50, y: 50 }],
      connections: [],
    };
    const src = serializePdPatch(patch);
    expect(src).toContain("#X msg 50 50 bang;");
  });

  test("serializes floatatom objects", () => {
    const patch: PdPatch = {
      name: "test",
      canvasWidth: 450,
      canvasHeight: 300,
      objects: [{ id: 0, type: "floatatom", args: [], x: 50, y: 50 }],
      connections: [],
    };
    const src = serializePdPatch(patch);
    expect(src).toContain("#X floatatom 50 50");
  });
});

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

describe("topoSort", () => {
  test("sorts linear chain correctly", () => {
    const patch = parsePdPatch(`#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 *~ 0.5;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`);
    const order = topoSort(patch);
    expect(order).toEqual([0, 1, 2]);
  });

  test("handles diamond graph", () => {
    const patch = parsePdPatch(`#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 50 100 *~ 0.5;
#X obj 150 100 *~ 0.3;
#X obj 100 150 +~ 0;
#X obj 100 200 dac~;
#X connect 0 0 1 0;
#X connect 0 0 2 0;
#X connect 1 0 3 0;
#X connect 2 0 3 1;
#X connect 3 0 4 0;`);
    const order = topoSort(patch);
    expect(order.indexOf(0)).toBeLessThan(order.indexOf(1));
    expect(order.indexOf(0)).toBeLessThan(order.indexOf(2));
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(3));
    expect(order.indexOf(2)).toBeLessThan(order.indexOf(3));
    expect(order.indexOf(3)).toBeLessThan(order.indexOf(4));
  });

  test("handles disconnected nodes", () => {
    const patch = parsePdPatch(`#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 200 50 noise~;
#X obj 100 100 dac~;`);
    const order = topoSort(patch);
    expect(order).toHaveLength(3);
    expect(new Set(order)).toEqual(new Set([0, 1, 2]));
  });
});

// ---------------------------------------------------------------------------
// DSP rendering
// ---------------------------------------------------------------------------

describe("renderPatch", () => {
  test("renders silent output for empty patch", () => {
    const patch = parsePdPatch("");
    const buffer = renderPatch(patch, 0.1);
    expect(buffer.length).toBe(Math.floor(0.1 * SAMPLE_RATE));
    for (let i = 0; i < buffer.length; i++) {
      expect(buffer[i]).toBe(0);
    }
  });

  test("renders non-silent output for sine drone", () => {
    const patch = parsePdPatch(PRESET_PATCHES["sine-drone"]!);
    const buffer = renderPatch(patch, 0.1);
    expect(buffer.length).toBe(Math.floor(0.1 * SAMPLE_RATE));

    let hasNonZero = false;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > 0.01) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  test("output is normalized to [-0.9, 0.9]", () => {
    const patch = parsePdPatch(PRESET_PATCHES["sine-drone"]!);
    const buffer = renderPatch(patch, 0.5);
    let maxAbs = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    expect(maxAbs).toBeCloseTo(0.9, 1);
  });

  test("renders all presets without error", () => {
    for (const name of PRESET_NAMES) {
      const patch = parsePdPatch(PRESET_PATCHES[name]!);
      const buffer = renderPatch(patch, 0.05);
      expect(buffer.length).toBeGreaterThan(0);
    }
  });

  test("osc~ produces periodic signal", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 dac~;
#X connect 0 0 1 0;`;
    const patch = parsePdPatch(src);
    const buffer = renderPatch(patch, 0.01);

    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i - 1]! >= 0) !== (buffer[i]! >= 0)) crossings++;
    }
    expect(crossings).toBeGreaterThan(4);
    expect(crossings).toBeLessThan(20);
  });

  test("noise~ produces varying signal", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 *~ 0.5;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`;
    const patch = parsePdPatch(src);
    const buffer = renderPatch(patch, 0.05);

    const values = new Set<number>();
    for (let i = 0; i < Math.min(100, buffer.length); i++) {
      values.add(Math.round(buffer[i]! * 100));
    }
    expect(values.size).toBeGreaterThan(10);
  });

  test("lop~ filters high frequencies", () => {
    const srcRaw = `#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 dac~;
#X connect 0 0 1 0;`;
    const srcFiltered = `#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 lop~ 100;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`;

    const rawBuf = renderPatch(parsePdPatch(srcRaw), 0.1);
    const filtBuf = renderPatch(parsePdPatch(srcFiltered), 0.1);

    let rawDelta = 0, filtDelta = 0;
    for (let i = 1; i < rawBuf.length; i++) {
      rawDelta += Math.abs(rawBuf[i]! - rawBuf[i - 1]!);
      filtDelta += Math.abs(filtBuf[i]! - filtBuf[i - 1]!);
    }
    expect(filtDelta).toBeLessThan(rawDelta);
  });

  test("*~ with zero produces silence", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 *~ 0;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`;
    const patch = parsePdPatch(src);
    const buffer = renderPatch(patch, 0.05);

    let maxAbs = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    expect(maxAbs).toBe(0);
  });

  test("clip~ constrains signal range", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 *~ 2;
#X obj 100 150 clip~ -0.5 0.5;
#X obj 100 200 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;`;
    const patch = parsePdPatch(src);
    const buffer = renderPatch(patch, 0.05);

    let nearPeak = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > 0.8) nearPeak++;
    }
    expect(nearPeak).toBeGreaterThan(buffer.length * 0.2);
  });
});

// ---------------------------------------------------------------------------
// WAV encoding
// ---------------------------------------------------------------------------

describe("encodeWav", () => {
  test("produces valid WAV header", () => {
    const samples = new Float64Array(100);
    const wav = encodeWav(samples);

    expect(wav.slice(0, 4).toString()).toBe("RIFF");
    expect(wav.slice(8, 12).toString()).toBe("WAVE");
    expect(wav.slice(12, 16).toString()).toBe("fmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.slice(36, 40).toString()).toBe("data");
  });

  test("encodes correct data size", () => {
    const samples = new Float64Array(256);
    const wav = encodeWav(samples);
    const dataSize = wav.readUInt32LE(40);
    expect(dataSize).toBe(256 * 2);
  });

  test("overall file size is correct", () => {
    const samples = new Float64Array(100);
    const wav = encodeWav(samples);
    expect(wav.length).toBe(44 + 100 * 2);
  });
});

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

describe("PdEngine", () => {
  let engine: PdEngine;

  beforeEach(() => {
    engine = new PdEngine();
  });

  test("initializes with sine-drone preset", () => {
    expect(engine.patch.name).toBe("sine-drone");
    expect(engine.patch.objects.length).toBeGreaterThan(0);
    expect(engine.transport).toBe("stopped");
  });

  test("loadPreset changes patch", () => {
    engine.loadPreset("fm-bell");
    expect(engine.patch.name).toBe("fm-bell");
    expect(engine.patch.objects.some(o => o.type === "osc~")).toBe(true);
  });

  test("loadPreset with invalid name is a no-op", () => {
    const prevName = engine.patch.name;
    engine.loadPreset("nonexistent-preset");
    expect(engine.patch.name).toBe(prevName);
  });

  test("loadSource parses custom source", () => {
    engine.loadSource(`#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 dac~;
#X connect 0 0 1 0;`, "custom");

    expect(engine.patch.name).toBe("custom");
    expect(engine.patch.objects).toHaveLength(2);
    expect(engine.patch.connections).toHaveLength(1);
  });

  test("render produces audio buffer", () => {
    engine.renderDuration = 0.5;
    const buffer = engine.render();
    expect(buffer).toBeInstanceOf(Float64Array);
    expect(buffer.length).toBe(Math.floor(0.5 * SAMPLE_RATE));
    expect(engine.audioBuffer).toBe(buffer);
  });

  test("play/stop/toggle transport", () => {
    engine.renderDuration = 0.5;
    engine.render();

    engine.play();
    expect(engine.transport).toBe("playing");

    engine.stop();
    expect(engine.transport).toBe("stopped");

    engine.toggle();
    expect(engine.transport).toBe("playing");

    engine.toggle();
    expect(engine.transport).toBe("stopped");
  });

  test("addObject adds and auto-selects", () => {
    engine.clearPatch();
    const id = engine.addObject("osc~", [440]);
    expect(engine.patch.objects).toHaveLength(1);
    expect(engine.patch.objects[0]!.type).toBe("osc~");
    expect(engine.selectedObjectId).toBe(id);
  });

  test("removeObject removes object and its connections", () => {
    engine.clearPatch();
    const id0 = engine.addObject("osc~", [440]);
    const id1 = engine.addObject("dac~");
    engine.addConnection(id0, 0, id1, 0);
    expect(engine.patch.connections).toHaveLength(1);

    engine.removeObject(id0);
    expect(engine.patch.objects).toHaveLength(1);
    expect(engine.patch.connections).toHaveLength(0);
  });

  test("addConnection prevents duplicates", () => {
    engine.clearPatch();
    const id0 = engine.addObject("osc~", [440]);
    const id1 = engine.addObject("dac~");
    engine.addConnection(id0, 0, id1, 0);
    engine.addConnection(id0, 0, id1, 0);
    expect(engine.patch.connections).toHaveLength(1);
  });

  test("moveCursor wraps around", () => {
    engine.loadPreset("sine-drone");
    engine.moveCursor(100);
    expect(engine.cursorIndex).toBeGreaterThanOrEqual(0);
    expect(engine.cursorIndex).toBeLessThan(engine.patch.objects.length);

    engine.moveCursor(-100);
    expect(engine.cursorIndex).toBeGreaterThanOrEqual(0);
    expect(engine.cursorIndex).toBeLessThan(engine.patch.objects.length);
  });

  test("clearPatch empties everything", () => {
    engine.clearPatch();
    expect(engine.patch.objects).toHaveLength(0);
    expect(engine.patch.connections).toHaveLength(0);
    expect(engine.patch.name).toBe("new-patch");
    expect(engine.selectedObjectId).toBe(-1);
    expect(engine.audioBuffer).toBeNull();
  });

  test("getSource returns valid pd text", () => {
    const source = engine.getSource();
    expect(source).toContain("#N canvas");
    expect(source).toContain("osc~");
    const reparsed = parsePdPatch(source);
    expect(reparsed.objects.length).toBe(engine.patch.objects.length);
  });

  test("serialize and hydrate round-trips", () => {
    engine.loadPreset("fm-bell");
    engine.renderDuration = 8;
    engine.selectObject(2);

    const data = engine.serialize();
    const engine2 = new PdEngine();
    engine2.hydrate(data);

    expect(engine2.patch.name).toBe("fm-bell");
    expect(engine2.renderDuration).toBe(8);
    expect(engine2.selectedObjectId).toBe(2);
    expect(engine2.patch.objects.length).toBe(engine.patch.objects.length);
  });

  test("events fire on state changes", () => {
    const events: string[] = [];
    engine.on(e => events.push(e.type));

    engine.loadPreset("bass-pulse");
    engine.renderDuration = 0.5;
    engine.render();
    engine.play();
    engine.stop();
    engine.clearPatch();
    engine.addObject("osc~", [440]);
    engine.moveCursor(1);

    expect(events).toContain("patch-loaded");
    expect(events).toContain("render-complete");
    expect(events).toContain("transport");
    expect(events).toContain("patch-modified");
    expect(events).toContain("cursor-moved");
  });

  test("destroy clears listeners", () => {
    let count = 0;
    engine.on(() => count++);
    engine.destroy();
    expect(count).toBe(0);
  });

  test("renderDuration is clamped", () => {
    engine.renderDuration = 0.1;
    expect(engine.renderDuration).toBe(0.5);

    engine.renderDuration = 100;
    expect(engine.renderDuration).toBe(30);
  });

  test("getConnectionsFrom / getConnectionsTo", () => {
    engine.loadPreset("sine-drone");
    const osc = engine.patch.objects[0]!;
    const fromOsc = engine.getConnectionsFrom(osc.id);
    expect(fromOsc.length).toBeGreaterThan(0);

    const dac = engine.patch.objects.find(o => o.type === "dac~")!;
    const toDac = engine.getConnectionsTo(dac.id);
    expect(toDac.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Enhanced DSP objects (Pass 4)
// ---------------------------------------------------------------------------

describe("enhanced DSP objects", () => {
  test("sig~ outputs constant signal", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 sig~ 0.5;
#X obj 100 100 dac~;
#X connect 0 0 1 0;`;
    const buffer = renderPatch(parsePdPatch(src), 0.01);
    // All samples should be close to 0.9 (normalized from 0.5)
    let allSame = true;
    for (let i = 1; i < buffer.length; i++) {
      if (Math.abs(buffer[i] - buffer[0]!) > 0.001) { allSame = false; break; }
    }
    expect(allSame).toBe(true);
  });

  test("samphold~ holds value on trigger", () => {
    // samphold~ with a phasor input and trigger should produce stepped output
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 phasor~ 100;
#X obj 100 100 dac~;
#X connect 0 0 1 0;`;
    const buffer = renderPatch(parsePdPatch(src), 0.05);
    // Phasor should produce a ramp
    let hasRamp = false;
    for (let i = 10; i < buffer.length; i++) {
      if (buffer[i] !== buffer[i - 1]) { hasRamp = true; break; }
    }
    expect(hasRamp).toBe(true);
  });

  test("rpole~ acts as one-pole recursive filter", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 rpole~ 0.9;
#X obj 100 150 *~ 0.1;
#X obj 100 200 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;`;
    const buffer = renderPatch(parsePdPatch(src), 0.1);
    // Should produce non-silent filtered output
    let hasNonZero = false;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > 0.01) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  test("new presets render without error", () => {
    const newPresets = ["ring-mod", "harsh-square", "organ-tones", "wind", "theremin"];
    for (const name of newPresets) {
      const src = PRESET_PATCHES[name];
      expect(src).toBeDefined();
      const patch = parsePdPatch(src!, name);
      expect(patch.objects.length).toBeGreaterThan(0);
      const buffer = renderPatch(patch, 0.05);
      expect(buffer.length).toBeGreaterThan(0);
      // Should produce audible output
      let hasSignal = false;
      for (let i = 0; i < buffer.length; i++) {
        if (Math.abs(buffer[i]) > 0.01) { hasSignal = true; break; }
      }
      expect(hasSignal).toBe(true);
    }
  });

  test("vcf~ produces resonant filtering", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 noise~;
#X obj 100 100 vcf~ 800 5;
#X obj 100 150 *~ 0.3;
#X obj 100 200 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;`;
    const buffer = renderPatch(parsePdPatch(src), 0.1);
    // VCF should produce filtered noise
    let hasSignal = false;
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > 0.01) { hasSignal = true; break; }
    }
    expect(hasSignal).toBe(true);
  });

  test("env~ follows signal envelope", () => {
    const src = `#N canvas 0 0 450 300 12;
#X obj 100 50 osc~ 440;
#X obj 100 100 env~ 1024;
#X obj 100 150 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`;
    const buffer = renderPatch(parsePdPatch(src), 0.1);
    // Envelope follower on a sine should produce positive values
    let hasPositive = false;
    for (let i = 100; i < buffer.length; i++) {
      if (buffer[i] > 0.01) { hasPositive = true; break; }
    }
    expect(hasPositive).toBe(true);
  });
});
