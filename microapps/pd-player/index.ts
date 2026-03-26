/**
 * Pd Player — WibWob-DOS microapp.
 *
 * Drives a real Pure Data subprocess via pd -nogui + pdsend.
 * Patch editor for .pd files, melody sequencer, live play.
 */

import {
  PdEngine,
  PRESET_NAMES,
  PRESET_MELODIES,
  PRESET_MELODY_NAMES,
  pdAvailable,
  serializePdPatch,
  type MelodyNote,
  type MelodyWave,
} from "./engine.js";
import { renderPdPlayer, summarizeState } from "./renderer.js";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { readFileSync } from "fs";

// DSP object types addable via the editor
const ADDABLE_OBJECTS = [
  "osc~", "phasor~", "noise~",
  "*~", "+~", "-~",
  "lop~", "hip~", "clip~",
  "line~", "vline~",
  "delwrite~", "delread~",
  "netreceive",
  "dac~",
] as const;

export default function setup(host: MicroappHost) {
  let engine: PdEngine | undefined;
  let addMenuIndex = 0;
  let presetIndex  = 0;
  let melodyIndex  = 0;
  const melodyWaveCycle: MelodyWave[] = ["sine", "square", "saw", "triangle"];
  let melodyWaveIndex = 0;

  function openPdPlayer(args?: Record<string, unknown>) {
    engine = new PdEngine();

    if (args && typeof args === "object") {
      if (args._restore && typeof args._restore === "object") {
        engine.hydrate(args._restore as Record<string, unknown>);
      }
      if (typeof args.preset === "string") engine.loadPreset(args.preset);
      if (typeof args.source === "string") {
        engine.loadSource(args.source, typeof args.name === "string" ? args.name : "loaded");
      }
      if (Array.isArray(args._melody)) {
        engine.loadMelody(
          args._melody as MelodyNote[],
          typeof args._melodyWave === "string" ? args._melodyWave as MelodyWave : "sine",
          typeof args._melodyName === "string" ? args._melodyName : "melody",
        );
      }
    }

    const screenW = Number(host.screen.width)  || 211;
    const screenH = Number(host.screen.height) || 56;
    const win = host.createWindow({
      title:  "Pd Player",
      width:  Math.max(80,  Math.round(screenW * 0.85)),
      height: Math.max(24,  Math.round(screenH * 0.85)),
    });

    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const display   = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });
    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });
    const root = host.ui.createStack(win.body, [
      { key: "header",  basis: 1,    part: headerBar },
      { key: "display", basis: "1fr", part: display  },
      { key: "status",  basis: 1,    part: statusBar },
    ]);

    function render() {
      if (!engine) return;
      const innerW = Math.max(0, Number(win.body.width)  || 0);
      const innerH = Math.max(0, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      const w = Math.max(60, innerW);
      const h = Math.max(1,  innerH - 2);
      const content = renderPdPlayer(engine, w, h);

      const pdState = engine.pdRunning ? "▶ PD" : "■";
      headerBar.update({
        left:  `Pd Player — ${engine.melody ? engine.melodyName : engine.patch.name}`,
        right: `${pdState} ${engine.patch.objects.length} obj`,
      });
      (display.node as any).setContent(content);

      const playing = engine.transport === "playing";
      const statusLeft = engine.melody
        ? playing
          ? `▶ ${engine.melodyName} [${engine.melodyWave}] — SPC to stop`
          : `${engine.melodyName} [${engine.melodyWave}] — SPC to play`
        : playing
          ? `▶ ${engine.patch.name} — SPC to stop`
          : `[SPC] play  [p] preset  [↑↓] select  [a] add  [m] melody`;

      statusBar.update({
        left:  statusLeft,
        right: `${pdAvailable() ? "pd✓" : "pd✗"}  [q] close`,
      });
      host.screen.render();
    }

    const unsub = engine.on(() => render());

    // ── Keyboard ──────────────────────────────────────────

    win.body.key(["space"], () => {
      engine?.toggle();
      render();
    });

    win.body.key(["up", "k"], () => { engine?.moveCursor(-1); render(); });
    win.body.key(["down", "j"], () => { engine?.moveCursor(1); render(); });

    win.body.key(["a"], () => {
      if (!engine) return;
      const type = ADDABLE_OBJECTS[addMenuIndex % ADDABLE_OBJECTS.length]!;
      const defaultArgs: (string | number)[] = [];
      if (type === "osc~")       defaultArgs.push(440);
      else if (type === "phasor~") defaultArgs.push(110);
      else if (type === "*~")    defaultArgs.push(0.5);
      else if (type === "lop~")  defaultArgs.push(1000);
      else if (type === "hip~")  defaultArgs.push(100);
      else if (type === "clip~") defaultArgs.push(-1, 1);
      else if (type === "netreceive") defaultArgs.push(9001);
      engine.addObject(type, defaultArgs);
      addMenuIndex++;
      render();
    });

    win.body.key(["d"], () => {
      if (!engine || engine.selectedObjectId < 0) return;
      engine.removeObject(engine.selectedObjectId);
      render();
    });

    win.body.key(["c"], () => {
      if (!engine) return;
      const idx  = engine.cursorIndex;
      const objs = engine.patch.objects;
      if (idx >= 0 && idx < objs.length - 1) {
        engine.addConnection(objs[idx]!.id, 0, objs[idx + 1]!.id, 0);
      }
      render();
    });

    win.body.key(["C-d"], () => {
      if (!engine || engine.selectedObjectId < 0) return;
      for (const conn of engine.getConnectionsFrom(engine.selectedObjectId)) {
        engine.removeConnection(conn.sourceId, conn.sourceOutlet, conn.sinkId, conn.sinkInlet);
      }
      render();
    });

    win.body.key(["x"], () => {
      if (!engine) return;
      if (engine.melody) engine.clearMelody();
      else engine.clearPatch();
      render();
    });

    win.body.key(["p"], () => {
      if (!engine) return;
      engine.loadPreset(PRESET_NAMES[presetIndex % PRESET_NAMES.length]!);
      presetIndex++;
      render();
    });

    // Melody cycling
    win.body.key(["m"], () => {
      if (!engine) return;
      const name = PRESET_MELODY_NAMES[melodyIndex % PRESET_MELODY_NAMES.length]!;
      const wave = engine.melody
        ? engine.melodyWave
        : melodyWaveCycle[melodyWaveIndex % melodyWaveCycle.length]!;
      engine.loadMelody(PRESET_MELODIES[name]!, wave, name);
      melodyIndex++;
      render();
    });

    // Cycle waveform
    win.body.key(["w"], () => {
      if (!engine || !engine.melody) return;
      melodyWaveIndex++;
      const wave = melodyWaveCycle[melodyWaveIndex % melodyWaveCycle.length]!;
      engine.loadMelody(engine.melody, wave, engine.melodyName);
      render();
    });

    win.body.key(["q", "escape"], () => win.close());

    win.onInput((input: string) => { handleApiInput(input); render(); });
    win.onResize(render);

    win.describeState(() => ({
      summary:         summarizeState(engine!),
      transport:       engine!.transport,
      patchName:       engine!.patch.name,
      pdRunning:       engine!.pdRunning,
      pdAvailable:     pdAvailable(),
      objectCount:     engine!.patch.objects.length,
      connectionCount: engine!.patch.connections.length,
      melody:          engine!.melody ? { name: engine!.melodyName, wave: engine!.melodyWave, notes: engine!.melody.length } : null,
      objects: engine!.patch.objects.map(o => ({ id: o.id, type: o.type, args: o.args })),
    }));

    win.captureText(() => {
      const w = Math.max(60, Number(win.body.width) || 80);
      const h = Math.max(1,  (Number(win.body.height) || 24) - 2);
      return renderPdPlayer(engine!, w, h);
    });

    win.onCleanup(() => {
      unsub();
      root.destroy();
      engine?.destroy();
      engine = undefined;
    });

    win.onRestyle(() => { root.restyle(); host.screen.render(); });

    if (args?._autoplay === true) engine.play();

    setTimeout(render, 0);
  }

  // ── API input handler ─────────────────────────────────────

  function handleApiInput(input: string) {
    if (!engine) return;
    const cmd   = input.trim();
    const lower = cmd.toLowerCase();

    if (lower === "play" || lower === "start") { engine.play(); return; }
    if (lower === "stop")   { engine.stop();   return; }
    if (lower === "toggle") { engine.toggle(); return; }
    if (lower === "clear")  { engine.melody ? engine.clearMelody() : engine.clearPatch(); return; }

    const presetMatch = lower.match(/^preset\s+(.+)$/);
    if (presetMatch) { engine.loadPreset(presetMatch[1]!.trim()); return; }

    if (cmd.startsWith("#N") || cmd.startsWith("#X")) { engine.loadSource(cmd); return; }

    const addMatch = cmd.match(/^add\s+(\S+)(.*)?$/);
    if (addMatch) {
      const type    = addMatch[1]!;
      const argStr  = (addMatch[2] ?? "").trim();
      const args    = argStr ? argStr.split(/\s+/).map(a => { const n = Number(a); return Number.isFinite(n) ? n : a; }) : [];
      engine.addObject(type, args);
      return;
    }

    const connMatch = cmd.match(/^connect\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (connMatch) {
      engine.addConnection(parseInt(connMatch[1]!), parseInt(connMatch[2]!), parseInt(connMatch[3]!), parseInt(connMatch[4]!));
      return;
    }

    const delMatch = cmd.match(/^delete\s+(\d+)$/);
    if (delMatch) { engine.removeObject(parseInt(delMatch[1]!)); return; }

    const selMatch = cmd.match(/^select\s+(\d+)$/);
    if (selMatch) { engine.selectObject(parseInt(selMatch[1]!)); return; }
  }

  // ── Commands ──────────────────────────────────────────────

  host.registerCommand({
    id: "open",
    label: "Open Pd Player",
    description: "Open the Pure Data patch player (drives real pd -nogui)",
    action: openPdPlayer,
    menu:    [{ category: "applications", order: 36, label: "Pd Player" }],
    palette: { order: 56, label: "Pure Data Player" },
  });

  host.registerCommand({
    id: "play",
    label: "Pd: Play",
    description: "Start the current patch or melody via pd -nogui",
    direct: true,
    action: () => {
      if (engine) engine.play();
      else openPdPlayer({ _autoplay: true });
    },
  });

  host.registerCommand({
    id: "stop",
    label: "Pd: Stop",
    description: "Stop Pd subprocess",
    direct: true,
    action: () => engine?.stop(),
  });

  host.registerCommand({
    id: "load-preset",
    label: "Pd: Load Preset",
    description: `Load a preset patch. Args: { preset: "${PRESET_NAMES.join('"|"')}" }`,
    direct: true,
    action: (args) => {
      if (engine && typeof args?.preset === "string") engine.loadPreset(args.preset);
      else if (!engine) openPdPlayer({ preset: typeof args?.preset === "string" ? args.preset : "sine-drone" });
    },
  });

  host.registerCommand({
    id: "load-source",
    label: "Pd: Load Source",
    description: "Load a .pd patch from source text. Args: { source: string, name?: string }",
    direct: true,
    action: (args) => {
      if (typeof args?.source !== "string") return;
      if (engine) engine.loadSource(args.source, typeof args.name === "string" ? args.name : "loaded");
      else openPdPlayer({ source: args.source, name: args.name });
    },
  });

  host.registerCommand({
    id: "melody",
    label: "Pd: Play Melody",
    description: `Sequence a melody through real Pd. Args: { preset?: "${PRESET_MELODY_NAMES.join('"|"')}", notes?: MelodyNote[], wave?: "sine|saw|square|triangle" }`,
    direct: true,
    action: (args) => {
      const wave  = (typeof args?.wave === "string" ? args.wave : "sine") as MelodyWave;
      let notes: MelodyNote[] | null = null;
      let name = "melody";

      if (typeof args?.preset === "string") {
        notes = PRESET_MELODIES[args.preset] ?? null;
        name  = args.preset;
      } else if (Array.isArray(args?.notes)) {
        notes = args.notes as MelodyNote[];
      }

      if (!notes) return;

      if (engine) {
        engine.loadMelody(notes, wave, name);
        engine.play();
      } else {
        openPdPlayer({ _melody: notes, _melodyWave: wave, _melodyName: name, _autoplay: true });
      }
    },
  });

  host.registerCommand({
    id: "add-object",
    label: "Pd: Add Object",
    description: 'Add a DSP object. Args: { type: string, args?: (string|number)[] }',
    direct: true,
    action: (args) => {
      if (!engine || typeof args?.type !== "string") return;
      engine.addObject(args.type, Array.isArray(args.args) ? args.args : []);
    },
  });

  host.registerCommand({
    id: "connect",
    label: "Pd: Connect",
    description: "Connect two objects. Args: { sourceId, sourceOutlet, sinkId, sinkInlet }",
    direct: true,
    action: (args) => {
      if (!engine || typeof args?.sourceId !== "number" || typeof args?.sinkId !== "number") return;
      engine.addConnection(args.sourceId, args.sourceOutlet ?? 0, args.sinkId, args.sinkInlet ?? 0);
    },
  });

  host.registerCommand({
    id: "remove-object",
    label: "Pd: Remove Object",
    description: "Remove object by ID. Args: { id: number }",
    direct: true,
    action: (args) => { if (engine && typeof args?.id === "number") engine.removeObject(args.id); },
  });

  host.registerCommand({
    id: "clear",
    label: "Pd: Clear",
    description: "Clear current patch or melody",
    direct: true,
    action: () => { if (engine) engine.melody ? engine.clearMelody() : engine.clearPatch(); },
  });

  host.registerCommand({
    id: "get-source",
    label: "Pd: Get Source",
    description: "Return current patch as .pd source",
    direct: true,
    action: () => engine?.getSource(),
  });

  host.registerCommand({
    id: "set-duration",
    label: "Pd: Set Duration",
    description: "Set play duration in seconds. Args: { seconds: number }",
    direct: true,
    action: (args) => { if (engine && typeof args?.seconds === "number") engine.renderDuration = args.seconds; },
  });

  // ── Snapshot ──────────────────────────────────────────────

  host.registerSnapshot({
    serialize: () => engine ? { engineState: engine.serialize() } : undefined,
    restore: (_snapshot, payload) => {
      const restoreData = payload.engineState as Record<string, unknown> | undefined;
      openPdPlayer(restoreData ? { _restore: restoreData } : undefined);
    },
  });
}
