/**
 * AudioPlayerController — shared audio playback service.
 *
 * Extracted from .pi/extensions/music-player.ts so it can be used
 * by both the pi extension and the WibWob Agent session tool.
 *
 * Uses ffplay for playback (cross-platform, no macOS dependency).
 */

import {
  execFileSync,
  spawn,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { REPO_ROOT } from "../core/config.js";

export const COMPOSITIONS_DIR = path.join(REPO_ROOT, "scratch", "compositions");
export const BUNDLED_MUSIC_DIR = path.join(REPO_ROOT, "assets", "music");
const AUDIO_FILE_PATTERN = /\.(mp3|wav|m4a|ogg|flac)$/i;
const SCRUB_SECONDS = 5;
const VOLUME_STEP = 10;
export const DEFAULT_VOLUME = 80;

export type PlayState = "stopped" | "playing" | "paused";

export interface PlayerSnapshot {
  files: string[];
  selectedIndex: number;
  filePath: string;
  fileName: string;
  state: PlayState;
  volume: number;
  elapsed: number;
  duration: number;
}

export function fmtTime(secs: number): string {
  const safe = Number.isFinite(secs) ? Math.max(0, secs) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getDuration(filePath: string): number {
  try {
    const output = execFileSync(
      "ffprobe",
      ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
      { encoding: "utf-8", timeout: 5000 },
    );
    const duration = parseFloat(output.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

export function findAudioFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((name) => AUDIO_FILE_PATTERN.test(name)).sort();
  } catch {
    return [];
  }
}

export function resolveAudioPath(rawPath: string): string | null {
  const trimmed = rawPath.trim().replace(/^@/, "");
  if (!trimmed) return null;

  const candidates = [
    path.isAbsolute(trimmed) ? trimmed : "",
    path.resolve(process.cwd(), trimmed),
    path.resolve(COMPOSITIONS_DIR, trimmed),
    path.resolve(BUNDLED_MUSIC_DIR, trimmed),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isFile() && stat.size > 0 && AUDIO_FILE_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

export class AudioPlayerController {
  private files: string[] = [];
  private selectedIndex = 0;
  private filePath = "";
  private fileName = "(no file)";
  private state: PlayState = "stopped";
  private volume = DEFAULT_VOLUME;
  private elapsed = 0;
  private duration = 0;
  private startTime = 0;
  private baseOffset = 0;
  private proc: ChildProcessWithoutNullStreams | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private lastTickerSecond = -1;
  private listeners = new Set<() => void>();
  private opChain: Promise<void> = Promise.resolve();
  private generationCounter = 0;
  private activeGeneration = 0;

  constructor() {
    this.refreshFiles();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): PlayerSnapshot {
    return {
      files: [...this.files],
      selectedIndex: this.selectedIndex,
      filePath: this.filePath,
      fileName: this.fileName,
      state: this.state,
      volume: this.volume,
      elapsed: this.getCurrentElapsed(),
      duration: this.duration,
    };
  }

  async startWithFile(startFile?: string): Promise<void> {
    if (!startFile) return;
    const resolved = resolveAudioPath(startFile);
    if (!resolved) return;
    await this.playFile(resolved);
  }

  selectNext(): void {
    this.refreshFiles();
    if (this.files.length === 0) return;
    if (this.selectedIndex >= this.files.length - 1) return;
    this.selectedIndex += 1;
    this.emitChange();
  }

  selectPrevious(): void {
    this.refreshFiles();
    if (this.files.length === 0) return;
    if (this.selectedIndex <= 0) return;
    this.selectedIndex -= 1;
    this.emitChange();
  }

  async playSelected(): Promise<void> {
    this.refreshFiles();
    const selected = this.files[this.selectedIndex];
    if (!selected) return;
    await this.playFile(path.join(COMPOSITIONS_DIR, selected));
  }

  async playFile(rawPath: string): Promise<PlayerSnapshot> {
    const resolved = resolveAudioPath(rawPath);
    if (!resolved) {
      throw new Error(`Audio file not found: ${rawPath}`);
    }

    await this.enqueue(async () => {
      this.refreshFiles();
      this.setCurrentFile(resolved);
      await this.restartPlayback(this.baseOffset, "playing");
    });

    return this.getSnapshot();
  }

  async stop(): Promise<PlayerSnapshot> {
    await this.enqueue(async () => {
      const proc = this.detachActiveProcess();
      await this.killAndWait(proc);
      this.stopTicker();
      this.state = "stopped";
      this.elapsed = 0;
      this.baseOffset = 0;
      this.emitChange();
    });
    return this.getSnapshot();
  }

  async togglePause(): Promise<PlayerSnapshot> {
    await this.enqueue(async () => {
      if (!this.filePath) return;

      if (this.state === "playing" && this.proc) {
        const current = this.getCurrentElapsed();
        this.writeToProc("p");
        this.stopTicker();
        this.state = "paused";
        this.elapsed = current;
        this.baseOffset = current;
        this.emitChange();
        return;
      }

      if (this.state === "paused" && this.proc) {
        this.writeToProc("p");
        this.startTime = Date.now();
        this.state = "playing";
        this.startTicker();
        this.emitChange();
        return;
      }

      await this.restartPlayback(this.baseOffset, "playing");
    });
    return this.getSnapshot();
  }

  async scrub(deltaSeconds: number): Promise<PlayerSnapshot> {
    await this.enqueue(async () => {
      if (!this.filePath) return;
      const target = this.clampElapsed(this.getCurrentElapsed() + deltaSeconds);
      this.elapsed = target;
      this.baseOffset = target;
      if (this.state === "stopped") {
        this.emitChange();
        return;
      }
      await this.restartPlayback(target, this.state);
    });
    return this.getSnapshot();
  }

  async changeVolume(delta: number): Promise<PlayerSnapshot> {
    await this.enqueue(async () => {
      this.volume = Math.max(0, Math.min(100, this.volume + delta));
      if (!this.filePath) {
        this.emitChange();
        return;
      }
      if (this.state === "stopped") {
        this.emitChange();
        return;
      }
      await this.restartPlayback(this.getCurrentElapsed(), this.state);
    });
    return this.getSnapshot();
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener();
  }

  private refreshFiles(): void {
    // Merge bundled tracks (assets/music/) with scratch compositions.
    // Bundled tracks come first; scratch tracks with the same filename win (override).
    const bundled = fs.existsSync(BUNDLED_MUSIC_DIR) ? findAudioFiles(BUNDLED_MUSIC_DIR) : [];
    const local = fs.existsSync(COMPOSITIONS_DIR) ? findAudioFiles(COMPOSITIONS_DIR) : [];
    const localSet = new Set(local);
    const merged = [...bundled.filter((f) => !localSet.has(f)), ...local];
    this.files = merged;
    if (this.files.length === 0) {
      this.selectedIndex = 0;
      return;
    }

    const currentIndex = this.fileName ? this.files.indexOf(this.fileName) : -1;
    if (currentIndex >= 0) {
      this.selectedIndex = currentIndex;
      return;
    }

    if (this.selectedIndex >= this.files.length) {
      this.selectedIndex = this.files.length - 1;
    }
  }

  private setCurrentFile(filePath: string): void {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.duration = getDuration(filePath);
    this.elapsed = 0;
    this.baseOffset = 0;
    const fileIndex = this.files.indexOf(this.fileName);
    if (fileIndex >= 0) this.selectedIndex = fileIndex;
    this.emitChange();
  }

  getCurrentElapsed(): number {
    if (this.state !== "playing") {
      return this.clampElapsed(this.elapsed);
    }
    const current = this.baseOffset + (Date.now() - this.startTime) / 1000;
    return this.clampElapsed(current);
  }

  private clampElapsed(value: number): number {
    if (this.duration <= 0) return Math.max(0, value);
    return Math.max(0, Math.min(this.duration, value));
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.opChain.then(op, op);
    this.opChain = run.catch(() => undefined);
    return run;
  }

  private async restartPlayback(offset: number, desiredState: PlayState): Promise<void> {
    const proc = this.detachActiveProcess();
    await this.killAndWait(proc);
    if (!this.filePath) return;
    await this.spawnPlayback(offset, desiredState);
  }

  private async spawnPlayback(offset: number, desiredState: PlayState): Promise<void> {
    const args = ["-nodisp", "-autoexit", "-volume", String(this.volume)];
    if (offset > 0) {
      args.push("-ss", String(Math.floor(offset)));
    }
    args.push(this.filePath);

    const proc = spawn("ffplay", args, { stdio: ["pipe", "pipe", "pipe"] });
    const generation = ++this.generationCounter;
    this.proc = proc;
    this.activeGeneration = generation;
    this.elapsed = offset;
    this.baseOffset = offset;
    this.startTime = Date.now();

    let startupStderr = "";
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let startupTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          startupTimer = null;
          cleanup();
          resolve();
        }, 200);
        const cleanup = () => {
          proc.off("error", onStartupError);
          proc.off("close", onStartupClose);
          proc.stderr?.off("data", onStderr);
          if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = null;
          }
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };
        const onStderr = (chunk: string | Buffer) => {
          if (startupStderr.length >= 400) return;
          startupStderr += String(chunk);
          if (startupStderr.length > 400) {
            startupStderr = startupStderr.slice(0, 400);
          }
        };
        const onStartupError = (error: Error) => {
          fail(new Error(this.formatPlaybackStartupError(error.message, startupStderr)));
        };
        const onStartupClose = (code: number | null, signal: NodeJS.Signals | null) => {
          fail(
            new Error(
              this.formatPlaybackStartupError(
                `ffplay exited during startup (code=${code ?? "null"}, signal=${signal ?? "null"})`,
                startupStderr,
              ),
            ),
          );
        };
        proc.stderr?.on("data", onStderr);
        proc.once("error", onStartupError);
        proc.once("close", onStartupClose);
      });
    } catch (error) {
      if (generation === this.activeGeneration) {
        this.handleProcessExit();
      }
      throw error;
    }

    this.state = "playing";
    this.startTicker();
    this.emitChange();

    proc.on("error", () => {
      if (generation !== this.activeGeneration) return;
      this.handleProcessExit();
    });

    proc.on("close", () => {
      if (generation !== this.activeGeneration) return;
      this.handleProcessExit();
    });

    if (desiredState === "paused") {
      await this.sendPauseToggle(proc);
      if (generation !== this.activeGeneration) return;
      this.stopTicker();
      this.state = "paused";
      this.elapsed = offset;
      this.baseOffset = offset;
      this.emitChange();
    }
  }

  private handleProcessExit(): void {
    this.proc = null;
    this.stopTicker();
    this.state = "stopped";
    this.elapsed = 0;
    this.baseOffset = 0;
    this.emitChange();
  }

  private detachActiveProcess(): ChildProcess | null {
    if (!this.proc) return null;
    const active = this.proc;
    this.proc = null;
    this.stopTicker();
    this.activeGeneration = ++this.generationCounter;
    return active;
  }

  private async killAndWait(proc: ChildProcess | null): Promise<void> {
    if (!proc) return;
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      let killTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimeout: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        proc.off("close", finish);
        proc.off("error", finish);
        if (killTimer) clearTimeout(killTimer);
        if (hardTimeout) clearTimeout(hardTimeout);
        resolve();
      };
      proc.once("close", finish);
      proc.once("error", finish);
      hardTimeout = setTimeout(finish, 2000);
      try {
        proc.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (proc.exitCode !== null || proc.signalCode !== null) {
            finish();
            return;
          }
          try {
            proc.kill("SIGKILL");
          } catch {
            finish();
          }
        }, 500);
      } catch {
        finish();
      }
    });
  }

  private formatPlaybackStartupError(reason: string, startupStderr: string): string {
    const stderr = startupStderr.trim();
    return stderr ? `${reason}: ${stderr}` : reason;
  }

  private writeToProc(input: string): void {
    try {
      this.proc?.stdin.write(input);
    } catch {}
  }

  private async sendPauseToggle(proc: ChildProcessWithoutNullStreams): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    try {
      proc.stdin.write("p");
    } catch {}
  }

  private startTicker(): void {
    this.stopTicker();
    this.lastTickerSecond = Math.floor(this.getCurrentElapsed());
    this.ticker = setInterval(() => {
      if (this.state !== "playing") return;
      this.elapsed = this.getCurrentElapsed();
      const currentSecond = Math.floor(this.elapsed);
      if (currentSecond === this.lastTickerSecond) return;
      this.lastTickerSecond = currentSecond;
      this.emitChange();
    }, 250);
  }

  private stopTicker(): void {
    if (!this.ticker) return;
    clearInterval(this.ticker);
    this.ticker = null;
    this.lastTickerSecond = -1;
  }
}

/** Singleton shared across the whole app process. */
export const sharedPlayer = new AudioPlayerController();
