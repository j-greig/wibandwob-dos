/**
 * Poetry Clock — a microapp that tells the time as a tiny poem every minute.
 * Inspired by Poem/1 by Matt Webb / Acts Not Facts.
 *
 * Two modes:
 *   clock    — plain time display, no inference
 *   sentient — AI-generated poem each minute via Anthropic Haiku (pi OAuth)
 *
 * Sentient mode has three voices:
 *   plain    — observational, quiet
 *   liminal  — backrooms temporal drift
 *   scramble — from Scramble the cat's perspective
 *
 * Falls back to clock mode if auth is unavailable.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
  type ContourMode,
} from "../../src/services/contour-engine.js";
import { createLazyMountedPlayer } from "../../src/services/animation-service.js";

type ClockMode = "clock" | "sentient";
type Voice = "plain" | "liminal" | "scramble" | "terrain";

type Rect = { top: number; left: number; width: number; height: number };
type UiNode = {
  on?(event: string, handler: () => void): void;
  hide(): void;
  show(): void;
  setContent(content: string): void;
};
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
type SnapshotWindow = {
  describeState?: () => Record<string, unknown>;
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
  describeState(fn: () => Record<string, unknown>): void;
  captureText(fn: () => string): void;
  close(): void;
};
type AnimatedPanelPlayer = {
  destroy(): void;
  attachTarget?(target: UiNode): void;
};
type MicroappHost = {
  createWindow(init: { title: string; width?: number; height?: number }): MicroappWindowHandle;
  registerCommand(def: {
    id: string;
    label: string;
    description?: string;
    action: (args?: Record<string, unknown>) => void;
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
    createColumns(parent: unknown, children: StackChild[]): UiPart<void>;
    createHeaderBar(parent: unknown, opts?: { leftInset?: number }): UiPart<{ left: string; right?: string }>;
    createStatusBar(parent: unknown): UiPart<{ left?: string; right?: string }>;
    createTextBlock(
      parent: unknown,
      opts?: { paddingLeft?: number; paddingTop?: number }
    ): UiPart<{ text: string }>;
    createRule(
      parent: unknown,
      opts: { axis: "horizontal" | "vertical"; inset?: number }
    ): UiPart<{ visible: boolean }>;
    createFigletDisplay(parent: unknown, opts: {
      renderText: (value: string) => string;
    }): UiPart<{ value: string }>;
    createAnimatedPanel(parent: unknown, opts: { player: AnimatedPanelPlayer }): UiPart<void>;
  };
};

const VOICE_CYCLE: Voice[] = ["plain", "liminal", "scramble", "terrain"];
const VOICE_LABELS: Record<Voice, string> = {
  plain: "poet",
  liminal: "backrooms",
  scramble: "scramble",
  terrain: "terrain",
};

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

const FIGLET_FONT = "chunky";

function renderFigletTime(time: string): string {
  const result = spawnSync("figlet", ["-f", FIGLET_FONT, time], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    return `  ${time}`;
  }
  return result.stdout.replace(/\s+$/u, "");
}

const SCRAMBLE_FRAMES: string[][] = [
  [
    "  /\\_/\\   ",
    " ( o.o )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( -.- )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( o.o )  ",
    "  > ~ <   ",
    "  |   |   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
  [
    "  /\\_/\\   ",
    " ( ^.^ )  ",
    "  > ^ <   ",
    " /|   |/  ",
    " (_|   |) ",
  ],
];

function createScramblePlayer(host: MicroappHost): AnimatedPanelPlayer & { setRunning(running: boolean): void } {
  let target: UiNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let running = false;

  const renderFrame = () => {
    if (!target) {
      return;
    }
    target.setContent(SCRAMBLE_FRAMES[frameIndex].join("\n"));
    host.screen.render();
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    if (timer || !target) {
      return;
    }
    timer = setInterval(() => {
      frameIndex = (frameIndex + 1) % SCRAMBLE_FRAMES.length;
      renderFrame();
    }, 2_000);
  };

  return {
    attachTarget(nextTarget) {
      target = nextTarget;
      frameIndex = 0;
      renderFrame();
      if (running) {
        start();
      }
    },
    setRunning(nextRunning) {
      running = nextRunning;
      if (!running) {
        stop();
        frameIndex = 0;
        renderFrame();
        return;
      }
      renderFrame();
      start();
    },
    destroy() {
      stop();
      target = null;
    },
  };
}

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";
const AUTH_FILE = join(homedir(), ".pi", "agent", "auth.json");

const VOICE_PROMPTS: Record<Voice, string> = {
  plain:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a pattern, a cultural echo, a feeling, the shape of the digits, bingo calls, " +
    "something numerical, anything. Let that secret be the spine of the poem. " +
    "Observational, quiet. No title, no explanation. Maximum 120 characters.",
  liminal:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a pattern, an echo, a wrongness specific to this exact time. " +
    "3am is not the same as 3pm. Let that particular strangeness haunt the poem. " +
    "Surreal, backrooms-flavoured. No title, no explanation. Maximum 120 characters.",
  scramble:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "is it feeding time, nap time, the witching hour, a suspicious number? " +
    "Scramble the cat has noticed something about this particular time. " +
    "Simple, funny, catlike. No title, no explanation. Maximum 120 characters.",
  terrain:
    "Write a two-line poem for the time {time}. " +
    "First: look at the digits and the hour. Find what's hiding in {time} — " +
    "a ridge, a valley, an erosion pattern, a geological age, a contour line. " +
    "The landscape shifts with the hour. What does this time look like as terrain? " +
    "Geological, atmospheric, vast. No title, no explanation. Maximum 120 characters.",
};

function readOAuthToken(): string | null {
  try {
    const auth = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    const token = auth?.anthropic?.access;
    if (!token || typeof token !== "string") {
      return null;
    }
    const expires = auth?.anthropic?.expires;
    if (expires && Date.now() > expires) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function timeContext(time: string): string {
  const [hStr] = time.split(":");
  const h = parseInt(hStr, 10);
  if (h >= 5 && h < 8)   return "early morning, the day barely started, cool and quiet";
  if (h >= 8 && h < 12)  return "morning, the working day underway";
  if (h >= 12 && h < 14) return "midday, the sun at its height, a pause";
  if (h >= 14 && h < 17) return "afternoon, the slow stretch after lunch";
  if (h >= 17 && h < 20) return "evening, the day winding down";
  if (h >= 20 && h < 23) return "night, the world going quiet";
  return "the small hours, deep night, most people asleep";
}

async function generatePoem(time: string, voice: Voice): Promise<string | null> {
  const token = readOAuthToken();
  if (!token) {
    return null;
  }

  const prompt = VOICE_PROMPTS[voice].replace(/\{time\}/g, time);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
        system: `You are a poet. The current time is ${time} — ${timeContext(time)}. Write only the poem, nothing else. No preamble, no title.`,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((item) => item.type === "text")?.text?.trim();
    if (!text) {
      return null;
    }

    if (text.startsWith("\"") && text.endsWith("\"")) {
      return text.slice(1, -1);
    }
    return text;
  } catch {
    return null;
  }
}

const CONTOUR_MODES: ContourMode[] = ["chaos", "order", "hybrid"];

function createTerrainPlayer(host: MicroappHost): AnimatedPanelPlayer & { setRunning(running: boolean): void; shuffle(): void } {
  function randomContourConfig() {
    return {
      mode: CONTOUR_MODES[Math.floor(Math.random() * CONTOUR_MODES.length)],
      seed: Math.floor(Math.random() * 100000),
      terrainIdx: Math.floor(Math.random() * terrainNames.length),
      nLevels: 3 + Math.floor(Math.random() * 6),
      fps: 8,
    };
  }

  const bridge = createLazyMountedPlayer({
    create(target) {
      return createContourPlayer({
        ...randomContourConfig(),
        getViewport: () => readNodeViewport(target, { minWidth: 12, minHeight: 6, fallbackWidth: 12, fallbackHeight: 6 }),
        onFrame: (content) => { target.setContent(content); host.screen.render(); },
      });
    },
    render: () => host.screen.render(),
    clearOnStop: true,
  });

  return {
    ...bridge,
    shuffle() {
      bridge.setRunning(false);
      bridge.setRunning(true);
    },
  };
}

export default function setup(host: MicroappHost) {
  // Active clock controller — set when a clock window is open, cleared on close
  let clockControl: { setMode: (mode: ClockMode, voice?: Voice) => void } | undefined;

  function openClock(args?: Record<string, unknown>) {
    const restoreMode = args?.mode as ClockMode | undefined;
    const restoreVoice = args?.voice as Voice | undefined;

    let mode: ClockMode = restoreMode ?? "clock";
    let voice: Voice = restoreVoice ?? "plain";
    let lastPoem = "";
    let lastTime = "";
    let lastDate = "";
    let generating = false;
    let lastGeneratedMinute = -1;

    clockControl = {
      setMode(targetMode: ClockMode, targetVoice?: Voice) {
        mode = targetMode;
        if (targetVoice) voice = targetVoice;
        lastPoem = "";
        if (mode === "sentient") {
          requestPoem();
        } else {
          voice = "plain";
          render();
        }
      },
    };

    const win = host.createWindow({
      title: "Poetry Clock",
      width: 64,
      height: 17,
    });

    const dateHeader = host.ui.createHeaderBar(win.body, { leftInset: 2 });
    const figletTime = host.ui.createFigletDisplay(win.body, { renderText: renderFigletTime, leftInset: 2 });
    const divider = host.ui.createRule(win.body, { axis: "horizontal", inset: 2 });
    const catPlayer = createScramblePlayer(host);
    const catPanel = host.ui.createAnimatedPanel(win.body, { player: catPlayer });
    const catRule = host.ui.createRule(win.body, { axis: "vertical" });
    const terrainPlayer = createTerrainPlayer(host);
    const terrainPanel = host.ui.createAnimatedPanel(win.body, { player: terrainPlayer });
    const terrainRule = host.ui.createRule(win.body, { axis: "vertical" });
    const poemBlock = host.ui.createTextBlock(win.body, { paddingLeft: 2, paddingTop: 1 });
    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 2 });

    const body = host.ui.createColumns(win.body, [
      {
        key: "cat",
        basis: 15,
        part: catPanel,
        visible: () => mode === "sentient" && voice === "scramble",
      },
      {
        key: "cat-rule",
        basis: 1,
        part: catRule,
        visible: () => mode === "sentient" && voice === "scramble",
      },
      {
        key: "poem",
        basis: "1fr",
        part: poemBlock,
      },
      {
        key: "terrain-rule",
        basis: 1,
        part: terrainRule,
        visible: () => mode === "sentient" && voice === "terrain",
      },
      {
        key: "terrain",
        basis: "3fr",
        part: terrainPanel,
        visible: () => mode === "sentient" && voice === "terrain",
      },
    ]);

    const root = host.ui.createStack(win.body, [
      { key: "date", basis: 1, part: dateHeader },
      { key: "figlet", basis: 5, part: figletTime },
      {
        key: "divider",
        basis: 1,
        part: divider,
        visible: () => mode !== "clock",
      },
      { key: "body", basis: "1fr", part: body },
      { key: "status", basis: 1, part: statusBar },
    ]);

    const cycleMode = () => {
      if (mode === "clock") {
        mode = "sentient";
        voice = "plain";
        lastPoem = "";
        requestPoem();
        return;
      }

      const voiceIndex = VOICE_CYCLE.indexOf(voice);
      if (voiceIndex >= VOICE_CYCLE.length - 1) {
        mode = "clock";
        voice = "plain";
        lastPoem = "";
        render();
        return;
      }

      voice = VOICE_CYCLE[voiceIndex + 1];
      lastPoem = "";
      requestPoem();
    };

    async function requestPoem() {
      if (generating) {
        return;
      }

      if (voice === "terrain") {
        terrainPlayer.shuffle();
      }

      generating = true;
      render();

      const now = new Date();
      const poem = await generatePoem(formatTime(now), voice);
      generating = false;

      if (poem) {
        lastPoem = poem;
        lastGeneratedMinute = now.getHours() * 60 + now.getMinutes();
      } else if (mode === "sentient" && !lastPoem) {
        mode = "clock";
        voice = "plain";
      }

      render();
    }

    function render() {
      const now = new Date();
      lastTime = formatTime(now);
      lastDate = formatDate(now);

      const innerW = Number(win.body.width) || 0;
      const innerH = Number(win.body.height) || 0;
      const scrambleVisible = mode === "sentient" && voice === "scramble";
      const terrainVisible = mode === "sentient" && voice === "terrain";

      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      dateHeader.update({ left: lastDate });
      figletTime.update({ value: lastTime });
      divider.update({ visible: mode !== "clock" });
      catRule.update({ visible: scrambleVisible });
      catPlayer.setRunning(scrambleVisible);
      terrainRule.update({ visible: terrainVisible });
      terrainPlayer.setRunning(terrainVisible);

      if (mode === "clock") {
        poemBlock.update({ text: "" });
        statusBar.update({ left: "", right: "[m]ode" });
      } else if (generating) {
        poemBlock.update({ text: "..." });
        statusBar.update({ left: VOICE_LABELS[voice], right: "[m]ode" });
      } else {
        poemBlock.update({ text: lastPoem });
        statusBar.update({ left: VOICE_LABELS[voice], right: "[m]ode" });
      }

      host.screen.render();
    }

    function tick() {
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      render();
      if (mode === "sentient" && currentMinute !== lastGeneratedMinute && !generating) {
        requestPoem();
      }
    }

    win.onResize(render);
    statusBar.node.on?.("click", cycleMode);
    win.body.key(["m"], cycleMode);
    win.body.key(["q", "escape"], () => win.close());

    render();
    if (mode === "sentient") {
      requestPoem();
    }

    const timer = setInterval(tick, 15_000);

    win.onCleanup(() => {
      clearInterval(timer);
      root.destroy();
      clockControl = undefined;
    });

    win.onRestyle(() => {
      root.restyle();
      host.screen.render();
    });

    win.describeState(() => ({
      summary: mode === "clock"
        ? "Poetry clock — clock mode"
        : `Poetry clock — ${voice} voice`,
      mode,
      voice,
      currentTime: lastTime,
      currentDate: lastDate,
      currentPoem: lastPoem || undefined,
      generating,
    }));

    win.captureText(() => {
      if (mode === "clock") {
        return `${lastDate}  ${lastTime}\n\n[CLOCK]`;
      }
      return `${lastDate}  ${lastTime}\n\n${lastPoem || "(generating...)"}\n\n[${VOICE_LABELS[voice]}]`;
    });
  }

  host.registerCommand({
    id: "open",
    label: "Open Poetry Clock",
    description: "A clock that tells the time — plain or as AI-generated poems",
    action: openClock,
    menu: [{ category: "applications", order: 30, label: "Poetry Clock" }],
    palette: { order: 50, label: "Poetry Clock" },
  });

  host.registerCommand({
    id: "set-mode",
    label: "Set Poetry Clock Mode",
    description: 'Set clock mode. args: { mode: "clock"|"sentient", voice?: "plain"|"liminal"|"scramble"|"terrain" }. Opens clock if not already open.',
    direct: true,
    action: (args) => {
      const targetMode = (args?.mode as ClockMode | undefined) ?? "sentient";
      const targetVoice = args?.voice as Voice | undefined;
      if (clockControl) {
        clockControl.setMode(targetMode, targetVoice);
      } else {
        openClock({ mode: targetMode, voice: targetVoice ?? "plain" });
      }
    },
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      return {
        mode: state.mode ?? "clock",
        voice: state.voice ?? "plain",
      };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", {
        mode: payload.mode,
        voice: payload.voice,
      });
    },
  });
}
