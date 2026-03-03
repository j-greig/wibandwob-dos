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

import blessed from "blessed";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { createPreRenderedPlayer } from "../../src/services/animation-service.js";
import type { FramePlayer } from "../../src/services/animation-service.js";
import type { MicroappHost } from "../../src/services/module-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClockMode = "clock" | "sentient";
type Voice = "plain" | "liminal" | "scramble";

const VOICE_CYCLE: Voice[] = ["plain", "liminal", "scramble"];
const VOICE_LABELS: Record<Voice, string> = {
  plain: "poet",
  liminal: "backrooms",
  scramble: "scramble",
};

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

// ---------------------------------------------------------------------------
// FIGlet rendering
// ---------------------------------------------------------------------------

const FIGLET_FONT = "chunky";

function renderFigletTime(time: string): string {
  const result = spawnSync("figlet", ["-f", FIGLET_FONT, time], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) return `  ${time}`;
  return result.stdout.replace(/\s+$/u, "");
}

// ---------------------------------------------------------------------------
// Scramble — animated cat frames (string[][] = array of frames, each frame = lines)
// ---------------------------------------------------------------------------

// Note: blessed interprets tags in content by default — use {/} to be safe,
// but simpler: just keep frames as plain ASCII with no special chars.
// Backslash at line end can confuse some renderers; pad all lines to equal width.
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

// ---------------------------------------------------------------------------
// Anthropic API — direct fetch using pi's OAuth token
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";
const AUTH_FILE = join(homedir(), ".pi", "agent", "auth.json");

const VOICE_PROMPTS: Record<Voice, string> = {
  plain:
    "Write a two-line poem containing the time {time}. " +
    "Observational, quiet, about desktop life or the passage of time. " +
    "No title, no explanation, just the poem. Maximum 120 characters.",
  liminal:
    "Write a two-line poem containing the time {time}. " +
    "Surreal, backrooms-flavoured. Fluorescent corridors, wet carpet, temporal drift. " +
    "No title, no explanation, just the poem. Maximum 120 characters.",
  scramble:
    "Write a two-line poem containing the time {time}. " +
    "From a cat's perspective. The cat is named Scramble. Simple, funny, catlike. " +
    "No title, no explanation, just the poem. Maximum 120 characters.",
};

function readOAuthToken(): string | null {
  try {
    const auth = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    const token = auth?.anthropic?.access;
    if (!token || typeof token !== "string") return null;
    // Check expiry if present
    const expires = auth?.anthropic?.expires;
    if (expires && Date.now() > expires) return null;
    return token;
  } catch {
    return null;
  }
}

async function generatePoem(time: string, voice: Voice): Promise<string | null> {
  const token = readOAuthToken();
  if (!token) return null;

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
        system: "You are a poet. Write only the poem, nothing else. No preamble, no title.",
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find(c => c.type === "text")?.text?.trim();
    if (!text) return null;

    // Strip surrounding quotes if present
    if (text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export default function setup(host: MicroappHost) {

  function openClock(args?: Record<string, unknown>) {
    const restoreMode = args?.mode as ClockMode | undefined;
    const restoreVoice = args?.voice as Voice | undefined;

    let mode: ClockMode = restoreMode ?? "clock";
    let voice: Voice = restoreVoice ?? "plain";
    let lastPoem = "";
    let lastTime = "";
    let lastDate = "";
    let generating = false;
    let catPlayer: FramePlayer | null = null;

    // Window is wider to accommodate scramble cat panel
    const win = host.createWindow({
      title: "Poetry Clock",
      width: 64,
      height: 17,
    });

    // ── Date line ──
    const dateBox = blessed.box({
      parent: win.body,
      top: 0,
      left: 2,
      right: 2,
      height: 1,
      style: host.theme().muted,
    });

    // ── FIGlet time ──
    const figletBox = blessed.box({
      parent: win.body,
      top: 1,
      left: 1,
      right: 1,
      height: 5,
      style: host.theme().body,
    });

    // ── Divider ──
    const divider = blessed.box({
      parent: win.body,
      top: 6,
      left: 2,
      right: 2,
      height: 1,
      style: host.theme().muted,
    });

    // ── Cat panel (scramble mode only, left side) ──
    const catBox = blessed.box({
      parent: win.body,
      top: 7,
      left: 0,
      width: 15,
      bottom: 2,
      style: host.theme().body,
      hidden: true,
    });

    // ── Vertical divider between cat and poem (scramble mode) ──
    const catDivider = blessed.box({
      parent: win.body,
      top: 7,
      left: 15,
      width: 1,
      bottom: 2,
      content: "│\n│\n│\n│\n│\n│",
      style: host.theme().muted,
      hidden: true,
    });

    // ── Poem area ──
    const poemBox = blessed.box({
      parent: win.body,
      top: 7,
      left: 2,
      right: 2,
      bottom: 2,
      style: host.theme().body,
    });

    // ── Bottom bar ──
    const modeBar = blessed.box({
      parent: win.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      style: host.theme().header,
    });

    const statusLabel = blessed.box({
      parent: modeBar,
      left: 1,
      top: 0,
      width: 46,
      height: 1,
      style: host.theme().header,
    });

    const modeBtn = blessed.box({
      parent: modeBar,
      right: 1,
      top: 0,
      width: 11,
      height: 1,
      content: " [m]ode  ",
      mouse: true,
      clickable: true,
      style: { ...host.theme().header, hover: host.theme().selected },
    });

    // ── Cat animation ──
    function startCat() {
      if (catPlayer) return;
      catBox.show();
      catDivider.show();
      poemBox.left = 16;
      catPlayer = createPreRenderedPlayer({
        frames: SCRAMBLE_FRAMES,
        fps: 0.5,
        onFrame: (content) => {
          catBox.setContent(content);
          host.screen.render();
        },
      });
      catPlayer.play();
    }

    function stopCat() {
      if (!catPlayer) return;
      catPlayer.destroy();
      catPlayer = null;
      catBox.hide();
      catDivider.hide();
      poemBox.left = 2;
    }

    // ── Poem generation ──
    async function requestPoem() {
      if (generating) return;
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
      }
      render();
    }

    // ── Mode cycling ──
    function cycleMode() {
      if (mode === "clock") {
        mode = "sentient";
        voice = "plain";
        lastPoem = "";
        stopCat();
        requestPoem();
        return;
      }
      const idx = VOICE_CYCLE.indexOf(voice);
      if (idx >= VOICE_CYCLE.length - 1) {
        mode = "clock";
        voice = "plain";
        lastPoem = "";
        stopCat();
      } else {
        voice = VOICE_CYCLE[idx + 1];
        lastPoem = "";
        if (voice === "scramble") {
          startCat();
        } else {
          stopCat();
        }
        requestPoem();
        return;
      }
      render();
    }

    modeBtn.on("click", cycleMode);
    win.body.key(["m"], cycleMode);
    win.body.key(["q", "escape"], () => win.close());

    // ── Rendering ──
    function render() {
      const now = new Date();
      lastTime = formatTime(now);
      lastDate = formatDate(now);

      dateBox.setContent(lastDate);
      figletBox.setContent(renderFigletTime(lastTime));

      if (mode === "clock") {
        divider.setContent("");
        poemBox.setContent("");
        statusLabel.setContent("");
      } else {
        divider.setContent("─".repeat(58));
        if (generating) {
          poemBox.setContent("\n ...");
          statusLabel.setContent(` ${VOICE_LABELS[voice]} ...`);
        } else if (lastPoem) {
          // Pre-wrap to box width so all lines (including wrapped) get indent.
          // poemBox.width is the inner width at render time; fall back to 44.
          const boxW = Math.max(20, (Number(poemBox.width) || 46) - 2);
          const lines: string[] = [];
          for (const raw of lastPoem.split("\n")) {
            const words = raw.split(" ");
            let line = "";
            for (const word of words) {
              if (!line) { line = word; continue; }
              if (line.length + 1 + word.length <= boxW) {
                line += " " + word;
              } else {
                lines.push(" " + line);
                line = word;
              }
            }
            lines.push(" " + line);
          }
          poemBox.setContent("\n" + lines.join("\n"));
          statusLabel.setContent(` ${VOICE_LABELS[voice]}`);
        } else {
          poemBox.setContent("");
          statusLabel.setContent(` ${VOICE_LABELS[voice]}`);
        }
      }

      host.screen.render();
    }

    // ── Timer tick ──
    let lastGeneratedMinute = -1;

    function tick() {
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      render();
      if (mode === "sentient" && currentMinute !== lastGeneratedMinute && !generating) {
        requestPoem();
      }
    }

    // Initial render
    render();
    if (mode === "sentient") {
      if (voice === "scramble") startCat();
      requestPoem();
    }

    const timer = setInterval(tick, 15_000);

    win.onCleanup(() => {
      clearInterval(timer);
      stopCat();
    });

    win.onRestyle(() => {
      dateBox.style = host.theme().muted;
      figletBox.style = host.theme().body;
      divider.style = host.theme().muted;
      catBox.style = host.theme().body;
      catDivider.style = host.theme().muted;
      poemBox.style = host.theme().body;
      modeBar.style = host.theme().header;
      statusLabel.style = host.theme().header;
      modeBtn.style = { ...host.theme().header, hover: host.theme().selected };
      render();
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

  // ── Register command ──
  host.registerCommand({
    id: "open",
    label: "Open Poetry Clock",
    description: "A clock that tells the time — plain or as AI-generated poems",
    action: openClock,
    menu: [{ category: "applications", order: 30, label: "Poetry Clock" }],
    palette: { order: 50, label: "Poetry Clock" },
  });

  // ── Register snapshot ──
  host.registerSnapshot({
    serialize: (window) => {
      const d = window.describeState?.() ?? {};
      return {
        mode: d.mode ?? "clock",
        voice: d.voice ?? "plain",
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
