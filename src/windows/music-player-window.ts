/**
 * Music Player Window — WinAMP-lite for WibWob-DOS.
 *
 * Uses macOS `afplay` for audio playback.
 * Controls: play, pause, stop, volume, scrub, track info.
 * Supports mp3 and wav files.
 */

import blessed from "blessed";
import { spawn, type ChildProcess } from "child_process";
import { basename } from "path";
import { stat } from "fs/promises";

import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import type { WindowManager } from "../core/window-manager.js";

export interface MusicPlayerDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  onStateChanged?: () => void;
}

export interface MusicPlayerRestore {
  filePath?: string;
  volume?: number;
}

type PlayState = "stopped" | "playing" | "paused";

export function openMusicPlayerWindow(
  deps: MusicPlayerDeps,
  restore?: MusicPlayerRestore
): void {
  const frame = deps.windowManager.createFrame("♫ Music Player", "microapp");
  frame.frame.width = 52;
  frame.frame.height = 12;

  let filePath = restore?.filePath ?? "";
  let fileName = filePath ? basename(filePath) : "(no file)";
  let volume = restore?.volume ?? 80; // 0-100
  let state: PlayState = "stopped";
  let proc: ChildProcess | null = null;
  let elapsed = 0;
  let duration = 0;
  let scrubTimer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let pauseOffset = 0;

  const display = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    style: theme().body,
    tags: true,
  });

  // ── Duration detection ──
  async function detectDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
      const p = spawn("afinfo", [path]);
      let out = "";
      p.stdout.on("data", (d: Buffer) => (out += d.toString()));
      p.on("close", () => {
        const m = out.match(/estimated duration:\s*([\d.]+)/i);
        resolve(m ? parseFloat(m[1]) : 0);
      });
      p.on("error", () => resolve(0));
    });
  }

  // ── Format helpers ──
  function fmtTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function progressBar(ratio: number, width: number): string {
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  function volumeBar(vol: number): string {
    const bars = Math.round(vol / 10);
    return "▮".repeat(bars) + "▯".repeat(10 - bars);
  }

  // ── Render ──
  function render() {
    const w = Math.max(30, Number(display.width) - 2);
    const ratio = duration > 0 ? Math.min(elapsed / duration, 1) : 0;

    const stateIcon =
      state === "playing" ? "▶" : state === "paused" ? "⏸" : "■";
    const stateLabel =
      state === "playing" ? "PLAYING" : state === "paused" ? "PAUSED" : "STOPPED";

    const lines = [
      "",
      ` ♫  ${fileName}`,
      "",
      ` ${stateIcon}  ${stateLabel}    ${fmtTime(elapsed)} / ${fmtTime(duration)}`,
      "",
      ` ${progressBar(ratio, w - 2)}`,
      "",
      ` Vol: ${volumeBar(volume)}  ${volume}%`,
      "",
      ` [space] play/pause  [s] stop  [+/-] vol  [o] open`,
      ` [←/→] scrub ±5s    [q] close`,
    ];
    display.setContent(lines.join("\n"));
    deps.onStateChanged?.();
    deps.screen.render();
  }

  // ── Playback ──
  function killProc() {
    if (proc) {
      proc.kill("SIGTERM");
      proc = null;
    }
    if (scrubTimer) {
      clearInterval(scrubTimer);
      scrubTimer = null;
    }
  }

  function startPlayback(fromOffset = 0) {
    killProc();
    if (!filePath) return;

    const volFloat = (volume / 100).toFixed(2);
    const args = ["-v", volFloat];
    if (fromOffset > 0) {
      args.push("-t", String(Math.max(0, duration - fromOffset)));
    }
    args.push(filePath);

    proc = spawn("afplay", args);
    state = "playing";
    startTime = Date.now();
    pauseOffset = fromOffset;
    elapsed = fromOffset;

    proc.on("close", () => {
      if (state === "playing") {
        state = "stopped";
        elapsed = 0;
        pauseOffset = 0;
        render();
      }
    });
    proc.on("error", () => {
      state = "stopped";
      render();
    });

    scrubTimer = setInterval(() => {
      if (state === "playing") {
        elapsed = pauseOffset + (Date.now() - startTime) / 1000;
        if (elapsed > duration && duration > 0) elapsed = duration;
        render();
      }
    }, 250);

    render();
  }

  function togglePause() {
    if (state === "playing" && proc) {
      proc.kill("SIGSTOP");
      state = "paused";
      pauseOffset = elapsed;
      render();
    } else if (state === "paused" && proc) {
      proc.kill("SIGCONT");
      state = "playing";
      startTime = Date.now();
      render();
    } else if (state === "stopped" && filePath) {
      startPlayback(0);
    }
  }

  function stopPlayback() {
    killProc();
    state = "stopped";
    elapsed = 0;
    pauseOffset = 0;
    render();
  }

  function scrub(deltaSecs: number) {
    const target = Math.max(0, Math.min(duration, elapsed + deltaSecs));
    if (state === "playing" || state === "paused") {
      const wasPlaying = state === "playing";
      killProc();
      elapsed = target;
      pauseOffset = target;
      if (wasPlaying) {
        startPlayback(target);
      } else {
        state = "paused";
        render();
      }
    }
  }

  function setVolume(delta: number) {
    volume = Math.max(0, Math.min(100, volume + delta));
    // afplay does not support live volume change — restarts needed
    if (state === "playing") {
      startPlayback(elapsed);
    }
    render();
  }

  async function loadFile(path: string) {
    stopPlayback();
    filePath = path;
    fileName = basename(path);
    duration = await detectDuration(path);
    render();
  }

  // ── Key bindings ──
  display.key(["space"], () => togglePause());
  display.key(["s"], () => stopPlayback());
  display.key(["q"], () => deps.windowManager.closeWindow(frame.id));
  display.key(["+", "="], () => setVolume(10));
  display.key(["-"], () => setVolume(-10));
  display.key(["right"], () => scrub(5));
  display.key(["left"], () => scrub(-5));
  display.key(["o"], () => {
    // Simple file prompt
    const input = blessed.textbox({
      parent: deps.screen,
      top: "center",
      left: "center",
      width: 60,
      height: 3,
      border: { type: "line" },
      style: {
        ...theme().body,
        border: theme().header,
      },
      inputOnFocus: true,
    });
    input.focus();
    deps.screen.render();
    input.readInput((_err: Error | null, value?: string) => {
      input.destroy();
      if (value?.trim()) {
        loadFile(value.trim());
      }
      deps.screen.render();
    });
  });

  // ── Window registration ──
  frame.kind = "microapp";
  frame.describeState = () => ({
    appType: "music-player" as const,
    summary: `Music player: ${fileName} [${state}]`,
    filePath,
    fileName,
    state,
    elapsed: Math.round(elapsed),
    duration: Math.round(duration),
    volume,
  });
  frame.cleanup = () => killProc();
  frame.setFocusTarget(display);
  frame.onRestyle = () => {
    safeSetStyle(display, theme().body);
  };

  // Public controller for API/commands
  (frame as any).musicPlayer = {
    play: () => { if (state === "stopped") startPlayback(0); else togglePause(); },
    pause: () => { if (state === "playing") togglePause(); },
    stop: () => stopPlayback(),
    loadFile,
    scrub,
    setVolume: (v: number) => { volume = Math.max(0, Math.min(100, v)); if (state === "playing") startPlayback(elapsed); render(); },
    getState: () => ({ state, filePath, elapsed, duration, volume }),
  };

  deps.windowManager.registerWindow(frame);
  frame.focus();

  // Auto-load if restored with a file
  if (filePath) {
    loadFile(filePath);
  } else {
    render();
  }
}
