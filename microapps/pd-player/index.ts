/**
 * Pd Player — WibWob-DOS microapp.
 *
 * Pure Data patch player and editor. Parses .pd files, renders DSP
 * graphs to audio, and provides an ASCII patch editor UI.
 */

import {
  PdEngine,
  PRESET_NAMES,
  encodeWav,
  serializePdPatch,
} from "./engine.js";
import { renderPdPlayer, summarizeState } from "./renderer.js";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// DSP object types the user can add via the editor
const ADDABLE_OBJECTS = [
  "osc~", "phasor~", "noise~",
  "*~", "+~", "-~",
  "lop~", "hip~", "clip~",
  "line~", "vline~",
  "delwrite~", "delread~",
  "wrap~", "abs~", "sqrt~",
  "dac~",
] as const;

export default function setup(host: MicroappHost) {
  let engine: PdEngine | undefined;
  let audioProc: ChildProcess | undefined;
  let wavPath: string | undefined;
  let addMenuIndex = 0;
  let presetIndex = 0;

  function openPdPlayer(args?: Record<string, unknown>) {
    engine = new PdEngine();

    // Restore from snapshot if provided
    if (args && typeof args === "object") {
      if (args._restore && typeof args._restore === "object") {
        engine.hydrate(args._restore as Record<string, unknown>);
      }
      if (typeof args.preset === "string") {
        engine.loadPreset(args.preset);
      }
      if (typeof args.source === "string") {
        engine.loadSource(args.source, typeof args.name === "string" ? args.name : "loaded");
      }
    }

    const screenW = Number(host.screen.width) || 211;
    const screenH = Number(host.screen.height) || 56;
    const win = host.createWindow({
      title: "Pd Player",
      width: Math.max(80, Math.round(screenW * 0.85)),
      height: Math.max(24, Math.round(screenH * 0.85)),
    });

    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const display = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });
    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });
    const root = host.ui.createStack(win.body, [
      { key: "header", basis: 1, part: headerBar },
      { key: "display", basis: "1fr", part: display },
      { key: "status", basis: 1, part: statusBar },
    ]);

    function render() {
      if (!engine) return;
      const innerW = Math.max(0, Number(win.body.width) || 0);
      const innerH = Math.max(0, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      const w = Math.max(60, innerW);
      const h = Math.max(1, innerH - 2);
      const content = renderPdPlayer(engine, w, h);

      headerBar.update({
        left: `Pd Player — ${engine.patch.name}`,
        right: `${engine.transport === "playing" ? "\u25B6" : "\u25A0"} ${engine.patch.objects.length} obj`,
      });
      (display.node as any).setContent(content);
      statusBar.update({
        left: "[SPC] play [r] render [p] preset [\u2191\u2193] select [a] add [d] del [c] conn",
        right: "[q] close",
      });
      host.screen.render();
    }

    // Engine events → re-render
    const unsub = engine.on(() => render());

    // ── Keyboard bindings ──────────────────────────────────

    // Transport
    win.body.key(["space"], () => {
      if (!engine) return;
      engine.toggle();
      if (engine.transport === "playing" && engine.audioBuffer) {
        playAudio(engine);
      } else {
        stopAudio();
      }
      render();
    });

    // Render audio
    win.body.key(["r"], () => {
      if (!engine) return;
      engine.render();
      render();
    });

    // Object selection
    win.body.key(["up", "k"], () => { engine?.moveCursor(-1); render(); });
    win.body.key(["down", "j"], () => { engine?.moveCursor(1); render(); });

    // Add object — cycle through types with 'a', confirm with 'enter'
    win.body.key(["a"], () => {
      if (!engine) return;
      const type = ADDABLE_OBJECTS[addMenuIndex % ADDABLE_OBJECTS.length]!;
      // Add with sensible defaults
      const defaultArgs: (string | number)[] = [];
      if (type === "osc~") defaultArgs.push(440);
      else if (type === "phasor~") defaultArgs.push(110);
      else if (type === "*~") defaultArgs.push(0.5);
      else if (type === "+~") defaultArgs.push(0);
      else if (type === "-~") defaultArgs.push(0);
      else if (type === "lop~") defaultArgs.push(1000);
      else if (type === "hip~") defaultArgs.push(100);
      else if (type === "clip~") defaultArgs.push(-1, 1);
      else if (type === "delwrite~") defaultArgs.push("del1", 500);
      else if (type === "delread~") defaultArgs.push("del1", 100);

      engine.addObject(type, defaultArgs);
      addMenuIndex++;
      render();
    });

    // Delete selected object
    win.body.key(["d"], () => {
      if (!engine || engine.selectedObjectId < 0) return;
      engine.removeObject(engine.selectedObjectId);
      render();
    });

    // Auto-connect: connect selected to next object below
    win.body.key(["c"], () => {
      if (!engine) return;
      const idx = engine.cursorIndex;
      const objs = engine.patch.objects;
      if (idx >= 0 && idx < objs.length - 1) {
        engine.addConnection(objs[idx]!.id, 0, objs[idx + 1]!.id, 0);
      }
      render();
    });

    // Disconnect: remove connections from selected
    win.body.key(["C-d"], () => {
      if (!engine || engine.selectedObjectId < 0) return;
      const conns = engine.getConnectionsFrom(engine.selectedObjectId);
      for (const conn of conns) {
        engine.removeConnection(conn.sourceId, conn.sourceOutlet, conn.sinkId, conn.sinkInlet);
      }
      render();
    });

    // Clear patch
    win.body.key(["x"], () => {
      engine?.clearPatch();
      render();
    });

    // Cycle presets
    win.body.key(["p"], () => {
      if (!engine) return;
      engine.loadPreset(PRESET_NAMES[presetIndex % PRESET_NAMES.length]!);
      presetIndex++;
      render();
    });

    // Render duration
    win.body.key(["S-r"], () => {
      if (!engine) return;
      engine.renderDuration = engine.renderDuration >= 16 ? 2 : engine.renderDuration * 2;
      render();
    });

    // Close
    win.body.key(["q", "escape"], () => win.close());

    // ── Input handler (for API writeInput) ────────────────
    win.onInput((input: string) => {
      handleApiInput(input);
      render();
    });

    // ── Resize ────────────────────────────────────────────
    win.onResize(render);

    // ── State reporting ───────────────────────────────────
    win.describeState(() => ({
      summary: summarizeState(engine!),
      transport: engine!.transport,
      patchName: engine!.patch.name,
      objectCount: engine!.patch.objects.length,
      connectionCount: engine!.patch.connections.length,
      renderDuration: engine!.renderDuration,
      selectedObjectId: engine!.selectedObjectId,
      hasAudio: engine!.audioBuffer !== null,
      objects: engine!.patch.objects.map(o => ({
        id: o.id,
        type: o.type,
        args: o.args,
      })),
      connections: engine!.patch.connections.map(c => ({
        from: `${c.sourceId}:${c.sourceOutlet}`,
        to: `${c.sinkId}:${c.sinkInlet}`,
      })),
    }));

    win.captureText(() => {
      const w = Math.max(60, Number(win.body.width) || 80);
      const h = Math.max(1, (Number(win.body.height) || 24) - 2);
      return renderPdPlayer(engine!, w, h);
    });

    // ── Cleanup ───────────────────────────────────────────
    win.onCleanup(() => {
      unsub();
      stopAudio();
      root.destroy();
      engine?.destroy();
      engine = undefined;
    });

    win.onRestyle(() => {
      root.restyle();
      host.screen.render();
    });

    // Auto-render + play if requested
    if (args?._autoplay === true) {
      engine.render();
      engine.play();
      playAudio(engine);
    }

    setTimeout(render, 0);
  }

  // ── Audio playback ──────────────────────────────────────────
  function playAudio(eng: PdEngine) {
    stopAudio();
    const buffer = eng.audioBuffer;
    if (!buffer) return;

    const dir = join(tmpdir(), "wibwob-pd-player");
    mkdirSync(dir, { recursive: true });
    wavPath = join(dir, `pd-${Date.now()}.wav`);
    const wav = encodeWav(buffer);
    writeFileSync(wavPath, wav);

    // Try aplay (Linux) first, fall back to afplay (macOS)
    const player = existsSync("/usr/bin/aplay") ? "aplay" : "afplay";
    try {
      audioProc = spawn(player, [wavPath], { stdio: "ignore", detached: true });
      audioProc.unref();
      audioProc.on("exit", () => {
        audioProc = undefined;
        if (eng.transport === "playing") {
          eng.stop();
        }
      });
    } catch {
      // Audio playback not available — silent mode
      audioProc = undefined;
    }
  }

  function stopAudio() {
    if (audioProc) {
      try { audioProc.kill(); } catch {}
      audioProc = undefined;
    }
    if (wavPath && existsSync(wavPath)) {
      try { unlinkSync(wavPath); } catch {}
      wavPath = undefined;
    }
  }

  // ── API input handler ─────────────────────────────────────
  function handleApiInput(input: string) {
    if (!engine) return;
    const cmd = input.trim();
    const lower = cmd.toLowerCase();

    if (lower === "play" || lower === "start") {
      engine.render();
      engine.play();
      playAudio(engine);
      return;
    }
    if (lower === "stop") { engine.stop(); stopAudio(); return; }
    if (lower === "toggle") {
      engine.toggle();
      if (engine.transport === "playing") { engine.render(); playAudio(engine); }
      else stopAudio();
      return;
    }
    if (lower === "render") { engine.render(); return; }
    if (lower === "clear") { engine.clearPatch(); return; }

    // Load preset
    const presetMatch = lower.match(/^preset\s+(.+)$/);
    if (presetMatch) { engine.loadPreset(presetMatch[1]!.trim()); return; }

    // Load source
    if (cmd.startsWith("#N") || cmd.startsWith("#X")) {
      engine.loadSource(cmd);
      return;
    }

    // Add object: "add osc~ 440"
    const addMatch = cmd.match(/^add\s+(\S+)(.*)?$/);
    if (addMatch) {
      const type = addMatch[1]!;
      const argStr = (addMatch[2] ?? "").trim();
      const args = argStr ? argStr.split(/\s+/).map(a => {
        const n = Number(a);
        return Number.isFinite(n) ? n : a;
      }) : [];
      engine.addObject(type, args);
      return;
    }

    // Connect: "connect 0 0 1 0"
    const connMatch = cmd.match(/^connect\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (connMatch) {
      engine.addConnection(
        parseInt(connMatch[1]!), parseInt(connMatch[2]!),
        parseInt(connMatch[3]!), parseInt(connMatch[4]!),
      );
      return;
    }

    // Delete: "delete 3"
    const delMatch = cmd.match(/^delete\s+(\d+)$/);
    if (delMatch) { engine.removeObject(parseInt(delMatch[1]!)); return; }

    // Duration: "duration 8"
    const durMatch = cmd.match(/^duration\s+([\d.]+)$/);
    if (durMatch) { engine.renderDuration = parseFloat(durMatch[1]!); return; }

    // Select: "select 2"
    const selMatch = cmd.match(/^select\s+(\d+)$/);
    if (selMatch) { engine.selectObject(parseInt(selMatch[1]!)); return; }

    // Source: "source" — return patch source
    if (lower === "source") return; // captureText handles this
  }

  // ── Register commands ───────────────────────────────────────

  host.registerCommand({
    id: "open",
    label: "Open Pd Player",
    description: "Open the Pure Data patch player and editor",
    action: openPdPlayer,
    menu: [{ category: "applications", order: 36, label: "Pd Player" }],
    palette: { order: 56, label: "Pure Data Player" },
  });

  host.registerCommand({
    id: "play",
    label: "Pd: Play",
    description: "Render and play the current patch",
    direct: true,
    action: () => {
      if (engine) { engine.render(); engine.play(); playAudio(engine); }
      else openPdPlayer({ _autoplay: true });
    },
  });

  host.registerCommand({
    id: "stop",
    label: "Pd: Stop",
    description: "Stop playback",
    direct: true,
    action: () => { engine?.stop(); stopAudio(); },
  });

  host.registerCommand({
    id: "render",
    label: "Pd: Render",
    description: "Render patch to audio buffer",
    direct: true,
    action: () => engine?.render(),
  });

  host.registerCommand({
    id: "load-preset",
    label: "Pd: Load Preset",
    description: `Load a preset patch. Args: { preset: "${PRESET_NAMES.join('"|"')}" }`,
    direct: true,
    action: (args) => {
      if (engine && typeof args?.preset === "string") {
        engine.loadPreset(args.preset);
      } else if (!engine) {
        openPdPlayer({ preset: typeof args?.preset === "string" ? args.preset : "sine-drone" });
      }
    },
  });

  host.registerCommand({
    id: "load-source",
    label: "Pd: Load Source",
    description: 'Load a .pd patch from source text. Args: { source: string, name?: string }',
    direct: true,
    action: (args) => {
      if (typeof args?.source !== "string") return;
      if (engine) {
        engine.loadSource(args.source, typeof args.name === "string" ? args.name : "loaded");
      } else {
        openPdPlayer({ source: args.source, name: args.name });
      }
    },
  });

  host.registerCommand({
    id: "add-object",
    label: "Pd: Add Object",
    description: 'Add a DSP object. Args: { type: "osc~"|"phasor~"|..., args?: (string|number)[] }',
    direct: true,
    action: (args) => {
      if (!engine || typeof args?.type !== "string") return;
      const objArgs = Array.isArray(args.args) ? args.args : [];
      engine.addObject(args.type, objArgs);
    },
  });

  host.registerCommand({
    id: "connect",
    label: "Pd: Connect",
    description: 'Connect two objects. Args: { sourceId: number, sourceOutlet: number, sinkId: number, sinkInlet: number }',
    direct: true,
    action: (args) => {
      if (!engine) return;
      if (typeof args?.sourceId === "number" && typeof args?.sinkId === "number") {
        engine.addConnection(
          args.sourceId, typeof args.sourceOutlet === "number" ? args.sourceOutlet : 0,
          args.sinkId, typeof args.sinkInlet === "number" ? args.sinkInlet : 0,
        );
      }
    },
  });

  host.registerCommand({
    id: "remove-object",
    label: "Pd: Remove Object",
    description: 'Remove an object by ID. Args: { id: number }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.id === "number") engine.removeObject(args.id);
    },
  });

  host.registerCommand({
    id: "clear",
    label: "Pd: Clear Patch",
    description: "Clear the current patch",
    direct: true,
    action: () => engine?.clearPatch(),
  });

  host.registerCommand({
    id: "get-source",
    label: "Pd: Get Source",
    description: "Return the current patch as .pd source text",
    direct: true,
    action: () => engine?.getSource(),
  });

  host.registerCommand({
    id: "set-duration",
    label: "Pd: Set Render Duration",
    description: 'Set render duration in seconds. Args: { seconds: number }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.seconds === "number") {
        engine.renderDuration = args.seconds;
      }
    },
  });

  host.registerCommand({
    id: "bounce",
    label: "Pd: Bounce to WAV",
    description: 'Render and save to WAV. Args: { path?: string, duration?: number }',
    direct: true,
    action: (args) => {
      if (!engine) return;
      if (typeof args?.duration === "number") engine.renderDuration = args.duration;
      const buffer = engine.render();
      const outPath = typeof args?.path === "string"
        ? args.path
        : `/tmp/pd-bounce-${Date.now()}.wav`;
      const wav = encodeWav(buffer);
      writeFileSync(outPath, wav);
      return outPath;
    },
  });

  // ── Snapshot ──────────────────────────────────────────────

  host.registerSnapshot({
    serialize: () => {
      if (!engine) return undefined;
      return { engineState: engine.serialize() };
    },
    restore: (_snapshot, payload) => {
      const restoreData = payload.engineState as Record<string, unknown> | undefined;
      openPdPlayer(restoreData ? { _restore: restoreData } : undefined);
    },
  });
}
