/**
 * TR-808 Drum Machine — WibWob-DOS microapp.
 *
 * Wires the engine (pure state) and renderer (pure text) to the
 * microapp host, blessed keyboard events, and the command registry.
 */

import {
  TR808Engine,
  INSTRUMENTS,
  INSTRUMENT_IDS,
  STEPS,
  PRESET_NAMES,
  type InstrumentId,
  type PatternBank,
  type PatternVariation,
  type PreScale,
} from "./engine.js";
import { renderTR808, summarizeState } from "./renderer.js";
import { TR808Audio } from "./audio.js";

// Key map: keyboard key → instrument selector index
// 1=BD, 2=SD, 3=LT, 4=MT, 5=HT, 6=RS, 7=CB, 8=CP, 9=MA, 0=CL, -=CY, ==OH
// backspace/delete=CH, `=accent
const KEY_TO_INSTRUMENT: Record<string, InstrumentId | "accent"> = {
  "1": "bd", "2": "sd", "3": "lt", "4": "mt", "5": "ht",
  "6": "rs", "7": "cb", "8": "cp", "9": "ma", "0": "cl",
  "-": "cy", "=": "oh",
  "backspace": "ch",
  "`": "accent",
};

type MicroappStateDetails = { summary?: string; [key: string]: unknown };
type Rect = { top: number; left: number; width: number; height: number };
type UiNode = { on?(event: string, handler: () => void): void };
type UiPart<Props = void> = {
  node: UiNode;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};
type StackChild = {
  key: string;
  basis: number | string;
  part: UiPart<unknown>;
  visible?: () => boolean;
};
type MicroappWindowHandle = {
  readonly id: number;
  readonly body: {
    width?: number | string;
    height?: number | string;
    key(keys: string[], fn: () => void): void;
  };
  onCleanup(fn: () => void): void;
  onRestyle(fn: () => void): void;
  onResize(fn: () => void): void;
  onInput(fn: (input: string) => void): void;
  describeState(fn: () => MicroappStateDetails): void;
  captureText(fn: () => string): void;
  close(): void;
};
type SnapshotWindow = { describeState?: () => Record<string, unknown> };
type MicroappHost = {
  createWindow(init: { title: string; width?: number; height?: number }): MicroappWindowHandle;
  registerCommand(def: {
    id: string; label: string; description?: string;
    action: (args?: Record<string, unknown>) => void;
    direct?: boolean;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
  }): void;
  registerSnapshot(handlers: {
    serialize: (window: SnapshotWindow) => Record<string, unknown> | undefined;
    restore: (_snapshot: unknown, payload: Record<string, unknown>) => void;
  }): void;
  runCommand(localId: string, args?: Record<string, unknown>): void;
  screen: { render(): void };
  ui: {
    createStack(parent: unknown, children: StackChild[]): UiPart<void>;
    createHeaderBar(parent: unknown, opts?: { leftInset?: number }): UiPart<{ left: string; right?: string }>;
    createStatusBar(parent: unknown, opts?: { leftInset?: number }): UiPart<{ left?: string; right?: string }>;
    createTextBlock(
      parent: unknown,
      opts?: { paddingLeft?: number; paddingTop?: number }
    ): UiPart<{ text: string }>;
  };
};

export default function setup(host: MicroappHost) {
  let engine: TR808Engine | undefined;
  let audio: TR808Audio | undefined;
  let stepCursor = 0; // keyboard step cursor for manual step editing

  function openDrumMachine(args?: Record<string, unknown>) {
    engine = new TR808Engine();

    // Initialize audio
    audio = new TR808Audio();
    const allParams: Record<string, Record<string, number>> = {};
    for (const inst of INSTRUMENTS) {
      allParams[inst.id] = Object.fromEntries(
        inst.params.map(p => [p.id, engine!.getParam(inst.id, p.id)])
      );
    }
    audio.renderSamples(allParams as any);

    // Restore from snapshot if provided
    if (args && typeof args === "object") {
      if (args._restore && typeof args._restore === "object") {
        engine.hydrate(args._restore as Record<string, unknown>);
      }
      if (typeof args.preset === "string") {
        engine.loadPreset(args.preset);
      }
    }

    const win = host.createWindow({
      title: "TR-808 Rhythm Composer",
      width: 120,
      height: 28,
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
      if (!engine) {
        return;
      }
      const innerW = Math.max(0, Number(win.body.width) || 0);
      const innerH = Math.max(0, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      const w = Math.max(80, innerW);
      const h = Math.max(1, innerH - 2);
      const content = renderTR808(engine, w, h, audio?.isEnabled ?? false);
      headerBar.update({
        left: "TR-808 Rhythm Composer",
        right: `${engine.state === "playing" ? "PLAY" : "STOP"} ${engine.tempo} BPM`,
      });
      display.update({ text: content });
      statusBar.update({
        left: "[SPACE] play [ENTER] step [1-0,-,=,`,BKSP] select",
        right: "[q] close",
      });
      host.screen.render();
    }

    // Engine events → re-render + audio
    const unsub = engine.on((event) => {
      if (event.type === "step" && audio) {
        audio.playStep(event.instruments, event.accent);
      }
      if (event.type === "param-changed" && audio) {
        // Re-render the changed instrument's sample
        const params: Record<string, number> = {};
        const inst = INSTRUMENTS.find(i => i.id === event.instrument);
        if (inst) {
          for (const p of inst.params) {
            params[p.id] = engine!.getParam(inst.id, p.id);
          }
          audio.renderSingle(event.instrument, params);
        }
      }
      render();
    });

    // ── Keyboard bindings ──────────────────────────────────

    // Transport
    win.body.key(["space"], () => { engine!.toggle(); });

    // Instrument selection
    for (const [key, instId] of Object.entries(KEY_TO_INSTRUMENT)) {
      win.body.key([key], () => { engine!.selectInstrument(instId); render(); });
    }

    // Step cursor movement
    win.body.key(["left"], () => {
      stepCursor = (stepCursor - 1 + STEPS) % STEPS;
      render();
    });
    win.body.key(["right"], () => {
      stepCursor = (stepCursor + 1) % STEPS;
      render();
    });

    // Toggle step at cursor
    win.body.key(["enter", "return"], () => {
      engine!.toggleStep(stepCursor);
      render();
    });

    // Tempo
    win.body.key(["a"], () => { engine!.tempo += 5; });
    win.body.key(["z"], () => { engine!.tempo -= 5; });
    win.body.key(["S-a"], () => { engine!.tempo += 1; });
    win.body.key(["S-z"], () => { engine!.tempo -= 1; });

    // Variation toggle
    win.body.key(["v"], () => {
      const slot = engine!.slot;
      engine!.setSlot({ variation: slot.variation === "A" ? "B" : "A" });
      render();
    });

    // Bank toggle
    win.body.key(["b"], () => {
      const slot = engine!.slot;
      engine!.setSlot({ bank: slot.bank === "A" ? "B" : "A" });
      render();
    });

    // Pattern number (F1-F8)
    for (let i = 1; i <= 8; i++) {
      win.body.key([`f${i}`], () => {
        engine!.setSlot({ number: i });
        render();
      });
    }

    // Clear
    win.body.key(["c"], () => { engine!.clearInstrument(); render(); });
    win.body.key(["S-c"], () => { engine!.clearPattern(); render(); });

    // Scale
    win.body.key(["s"], () => {
      const scales: PreScale[] = ["16th", "32nd", "8th-triplet"];
      const idx = scales.indexOf(engine!.scale);
      engine!.scale = scales[(idx + 1) % scales.length];
      render();
    });

    // Preset cycle
    let presetIdx = 0;
    win.body.key(["p"], () => {
      engine!.loadPreset(PRESET_NAMES[presetIdx % PRESET_NAMES.length]);
      presetIdx++;
      render();
    });

    // Audio mute toggle
    win.body.key(["m"], () => {
      if (audio) audio.setEnabled(!audio.isEnabled);
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
      transport: engine!.state,
      tempo: engine!.tempo,
      bank: engine!.slot.bank,
      pattern: engine!.slot.number,
      variation: engine!.slot.variation,
      scale: engine!.scale,
      selectedInstrument: engine!.selected,
      accentLevel: engine!.accent,
      masterLevel: engine!.master,
      instruments: INSTRUMENTS.map(inst => ({
        id: inst.id,
        label: inst.shortLabel,
        steps: engine!.getSteps(inst.id),
        params: Object.fromEntries(inst.params.map(p => [p.id, engine!.getParam(inst.id, p.id)])),
      })),
      accentSteps: engine!.getSteps("accent"),
      audioEnabled: audio?.isEnabled ?? false,
    }));

    win.captureText(() => {
      const w = Math.max(80, Number(win.body.width) || 80);
      const h = Math.max(1, (Number(win.body.height) || 24) - 2);
      return renderTR808(engine!, w, h, audio?.isEnabled ?? false);
    });

    // ── Cleanup ───────────────────────────────────────────
    win.onCleanup(() => {
      unsub();
      root.destroy();
      audio?.destroy();
      audio = undefined;
      engine!.destroy();
      engine = undefined;
    });

    win.onRestyle(() => {
      root.restyle();
      host.screen.render();
    });

    if (args?._autoplay === true) {
      engine.start();
    }

    // Initial render after handlers and layout parts are wired.
    setTimeout(render, 0);
  }

  // ── API input handler ─────────────────────────────────────
  function handleApiInput(input: string) {
    if (!engine) return;
    const cmd = input.trim().toLowerCase();

    // Transport
    if (cmd === "play" || cmd === "start") { engine.start(); return; }
    if (cmd === "stop") { engine.stop(); return; }
    if (cmd === "toggle") { engine.toggle(); return; }

    // Tempo
    const tempoMatch = cmd.match(/^tempo\s+(\d+)$/);
    if (tempoMatch) { engine.tempo = parseInt(tempoMatch[1]); return; }

    // Select instrument
    const selMatch = cmd.match(/^select\s+(\w+)$/);
    if (selMatch) {
      const id = selMatch[1] as InstrumentId | "accent";
      if (INSTRUMENT_IDS.includes(id as InstrumentId) || id === "accent") {
        engine.selectInstrument(id);
      }
      return;
    }

    // Toggle step: "toggle 0" or "toggle bd 4"
    const toggleMatch = cmd.match(/^toggle\s+(?:(\w+)\s+)?(\d+)$/);
    if (toggleMatch) {
      const inst = toggleMatch[1] as InstrumentId | "accent" | undefined;
      const step = parseInt(toggleMatch[2]);
      if (step >= 0 && step < STEPS) {
        engine.toggleStep(step, inst);
      }
      return;
    }

    // Set step: "set bd 0 on" or "set bd 0 off"
    const setMatch = cmd.match(/^set\s+(\w+)\s+(\d+)\s+(on|off)$/);
    if (setMatch) {
      const inst = setMatch[1] as InstrumentId | "accent";
      const step = parseInt(setMatch[2]);
      const active = setMatch[3] === "on";
      if (step >= 0 && step < STEPS) {
        engine.setStep(step, active, inst);
      }
      return;
    }

    // Param: "param bd tune 75"
    const paramMatch = cmd.match(/^param\s+(\w+)\s+(\w+)\s+(\d+)$/);
    if (paramMatch) {
      const inst = paramMatch[1] as InstrumentId;
      const param = paramMatch[2];
      const value = parseInt(paramMatch[3]);
      engine.setParam(inst, param, value);
      return;
    }

    // Bank/variation/pattern
    const bankMatch = cmd.match(/^bank\s+([ab])$/i);
    if (bankMatch) { engine.setSlot({ bank: bankMatch[1].toUpperCase() as PatternBank }); return; }

    const varMatch = cmd.match(/^variation\s+([ab])$/i);
    if (varMatch) { engine.setSlot({ variation: varMatch[1].toUpperCase() as PatternVariation }); return; }

    const patMatch = cmd.match(/^pattern\s+(\d)$/);
    if (patMatch) { engine.setSlot({ number: parseInt(patMatch[1]) }); return; }

    // Preset
    const presetMatch = cmd.match(/^preset\s+(.+)$/);
    if (presetMatch) { engine.loadPreset(presetMatch[1].trim()); return; }

    // Clear
    if (cmd === "clear") { engine.clearInstrument(); return; }
    if (cmd === "clear all") { engine.clearPattern(); return; }

    // Scale
    const scaleMatch = cmd.match(/^scale\s+(.+)$/);
    if (scaleMatch) { engine.scale = scaleMatch[1].trim() as PreScale; return; }

    // Accent level
    const accentMatch = cmd.match(/^accent\s+(\d+)$/);
    if (accentMatch) { engine.accent = parseInt(accentMatch[1]); return; }

    // Master level
    const masterMatch = cmd.match(/^master\s+(\d+)$/);
    if (masterMatch) { engine.master = parseInt(masterMatch[1]); return; }

    // Last step
    const lastMatch = cmd.match(/^laststep\s+(\d+)$/);
    if (lastMatch) { engine.setLastStep(parseInt(lastMatch[1])); return; }

    // Audio
    if (cmd === "mute") { audio?.setEnabled(false); return; }
    if (cmd === "unmute") { audio?.setEnabled(true); return; }
    if (cmd === "audio toggle") { if (audio) audio.setEnabled(!audio.isEnabled); return; }

    // Bounce
    const bounceMatch = cmd.match(/^bounce(?:\s+(.+))?$/);
    if (bounceMatch && audio) {
      const path = bounceMatch[1]?.trim() || `/tmp/tr808-bounce-${Date.now()}.wav`;
      const instruments = INSTRUMENTS.map(inst => ({
        id: inst.id,
        steps: engine.getSteps(inst.id),
        params: Object.fromEntries(inst.params.map(p => [p.id, engine.getParam(inst.id, p.id)])),
      }));
      audio.bouncePattern(instruments, engine.getSteps("accent"), engine.tempo, engine.pattern.lastStep, path);
      return;
    }
  }

  // ── Register commands ───────────────────────────────────

  host.registerCommand({
    id: "open",
    label: "Open TR-808",
    description: "Open the TR-808 drum machine",
    action: openDrumMachine,
    menu: [{ category: "applications", order: 35, label: "TR-808 Drum Machine" }],
    palette: { order: 55, label: "TR-808 Drum Machine" },
  });

  host.registerCommand({
    id: "play",
    label: "TR-808: Start",
    description: "Start the TR-808 sequencer",
    direct: true,
    action: () => {
      if (engine) engine.start();
      else openDrumMachine({ _autoplay: true });
    },
  });

  host.registerCommand({
    id: "stop",
    label: "TR-808: Stop",
    description: "Stop the TR-808 sequencer",
    direct: true,
    action: () => engine?.stop(),
  });

  host.registerCommand({
    id: "tempo",
    label: "TR-808: Set Tempo",
    description: 'Set TR-808 tempo. Args: { bpm: number }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.bpm === "number") engine.tempo = args.bpm;
    },
  });

  host.registerCommand({
    id: "select",
    label: "TR-808: Select Instrument",
    description: 'Select instrument. Args: { instrument: "bd"|"sd"|"lt"|"mt"|"ht"|"rs"|"cb"|"cp"|"ma"|"cl"|"cy"|"oh"|"ch"|"accent" }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.instrument === "string") {
        engine.selectInstrument(args.instrument as InstrumentId | "accent");
      }
    },
  });

  host.registerCommand({
    id: "toggle-step",
    label: "TR-808: Toggle Step",
    description: 'Toggle a step. Args: { step: 0-15, instrument?: "bd"|... }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.step === "number") {
        const inst = typeof args?.instrument === "string" ? args.instrument as InstrumentId | "accent" : undefined;
        engine.toggleStep(args.step, inst);
      }
    },
  });

  host.registerCommand({
    id: "set-step",
    label: "TR-808: Set Step",
    description: 'Set a step on or off. Args: { instrument: "bd"|..., step: 0-15, active: boolean }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.step === "number" && typeof args?.active === "boolean") {
        const inst = typeof args?.instrument === "string" ? args.instrument as InstrumentId | "accent" : undefined;
        engine.setStep(args.step, args.active, inst);
      }
    },
  });

  host.registerCommand({
    id: "set-param",
    label: "TR-808: Set Parameter",
    description: 'Set instrument parameter. Args: { instrument: "bd"|..., param: "tune"|"attack"|"decay"|"level"|"tone"|"snappy", value: 0-100 }',
    direct: true,
    action: (args) => {
      if (engine && typeof args?.instrument === "string" && typeof args?.param === "string" && typeof args?.value === "number") {
        engine.setParam(args.instrument as InstrumentId, args.param, args.value);
      }
    },
  });

  host.registerCommand({
    id: "load-preset",
    label: "TR-808: Load Preset",
    description: `Load a preset pattern. Args: { preset: "${PRESET_NAMES.join('"|"')}" }`,
    direct: true,
    action: (args) => {
      if (engine && typeof args?.preset === "string") {
        engine.loadPreset(args.preset);
      } else if (!engine) {
        openDrumMachine({ preset: typeof args?.preset === "string" ? args.preset : "classic-house" });
      }
    },
  });

  host.registerCommand({
    id: "clear",
    label: "TR-808: Clear",
    description: 'Clear current instrument or all. Args: { all?: boolean, instrument?: "bd"|... }',
    direct: true,
    action: (args) => {
      if (!engine) return;
      if (args?.all === true) engine.clearPattern();
      else if (typeof args?.instrument === "string") engine.clearInstrument(args.instrument as InstrumentId | "accent");
      else engine.clearInstrument();
    },
  });

  host.registerCommand({
    id: "set-pattern",
    label: "TR-808: Set Pattern",
    description: 'Switch pattern. Args: { bank?: "A"|"B", number?: 1-8, variation?: "A"|"B" }',
    direct: true,
    action: (args) => {
      if (!engine || !args) return;
      const slot: Record<string, unknown> = {};
      if (typeof args.bank === "string") slot.bank = args.bank.toUpperCase();
      if (typeof args.number === "number") slot.number = args.number;
      if (typeof args.variation === "string") slot.variation = args.variation.toUpperCase();
      engine.setSlot(slot as any);
    },
  });

  host.registerCommand({
    id: "bounce",
    label: "TR-808: Bounce to WAV",
    description: 'Bounce current pattern to WAV file. Args: { path?: string, loops?: number }. Returns the output path.',
    direct: true,
    action: (args) => {
      if (!engine || !audio) return;
      const loops = typeof args?.loops === "number" ? args.loops : 2;
      const defaultPath = `/tmp/tr808-bounce-${Date.now()}.wav`;
      const outPath = typeof args?.path === "string" ? args.path : defaultPath;

      const instruments = INSTRUMENTS.map(inst => ({
        id: inst.id,
        steps: engine!.getSteps(inst.id),
        params: Object.fromEntries(inst.params.map(p => [p.id, engine!.getParam(inst.id, p.id)])),
      }));

      audio.bouncePattern(
        instruments,
        engine.getSteps("accent"),
        engine.tempo,
        engine.pattern.lastStep,
        outPath,
        loops,
      );

      return outPath;
    },
  });

  // ── Snapshot ──────────────────────────────────────────────

  host.registerSnapshot({
    serialize: (window) => {
      if (!engine) return undefined;
      return { engineState: engine.serialize() };
    },
    restore: (_snapshot, payload) => {
      const restoreData = payload.engineState as Record<string, unknown> | undefined;
      openDrumMachine(restoreData ? { _restore: restoreData } : undefined);
    },
  });
}
