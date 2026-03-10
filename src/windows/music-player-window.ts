/**
 * Music Player Window — WinAMP-style for WibWob-DOS.
 *
 * Uses ffplay for audio playback (pause via stdin "p", seek via -ss).
 * Responsive: compact at small sizes, playlist panel appears when wide/tall.
 * Default playlist: content/music/*.mp3
 */

import blessed from "blessed";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { basename } from "path";
import * as fs from "fs";
import * as path from "path";

import { theme } from "../core/theme/resolver.js";
import { createRestyleBundle, createButtonBar, clamp } from "../core/ui-parts.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";

// ── Constants ───────────────────────────────────────────────────────────────

const AUDIO_RE = /\.(mp3|wav|m4a|ogg|flac)$/i;
function getMusicDir() {
  return path.join(process.cwd(), "content/music");
}
const SCRUB_SECS = 5;
const VOL_STEP = 10;
const DEFAULT_VOL = 80;

// Playlist panel appears when window is at least this wide
const PLAYLIST_MIN_WIDTH = 70;
// Playlist panel width (chars)
const PLAYLIST_WIDTH = 28;
// Spectrum viz appears when body is at least this tall (and playlist visible)
const VIZ_MIN_HEIGHT = 20;
// Number of spectrum bands
const VIZ_BANDS = 24;
// Rows of viz to draw
const VIZ_ROWS = 6;
// Sub-row block chars: space → ▁▂▃▄▅▆▇█
const BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// ── Types ────────────────────────────────────────────────────────────────────

type PlayState = "stopped" | "playing" | "paused";

export interface MusicPlayerDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  onStateChanged?: () => void;
}

export interface MusicPlayerRestore {
  filePath?: string;
  volume?: number;
  playlist?: string[];
}

// ── Audio controller (ported from pi music-player extension) ─────────────────

class AudioController {
  private _files: string[] = [];
  private _selectedIndex = 0;
  private _filePath = "";
  private _fileName = "(no file)";
  private _state: PlayState = "stopped";
  private _volume = DEFAULT_VOL;
  private _elapsed = 0;
  private _duration = 0;
  private _startTime = 0;
  private _baseOffset = 0;
  private _proc: ChildProcess | null = null;
  private _ticker: ReturnType<typeof setInterval> | null = null;
  private _opChain: Promise<void> = Promise.resolve();
  private _generation = 0;
  private _activeGen = 0;
  private _listeners = new Set<() => void>();

  constructor(initialFiles?: string[]) {
    if (initialFiles?.length) {
      this._files = initialFiles;
    } else {
      this._scanDir(getMusicDir());
    }
  }

  // ── Public state ──────────────────────────────────────────────────────────

  get files() { return this._files; }
  get selectedIndex() { return this._selectedIndex; }
  get filePath() { return this._filePath; }
  get fileName() { return this._fileName; }
  get state(): PlayState { return this._state; }
  get volume() { return this._volume; }
  get duration() { return this._duration; }
  get elapsed() {
    if (this._state !== "playing") return clamp(this._elapsed, 0, this._duration || Infinity);
    const live = this._baseOffset + (Date.now() - this._startTime) / 1000;
    return clamp(live, 0, this._duration || Infinity);
  }

  subscribe(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  addFiles(paths: string[]) {
    for (const p of paths) {
      if (!this._files.includes(p)) this._files.push(p);
    }
    this._emit();
  }

  selectNext() {
    if (this._selectedIndex < this._files.length - 1) {
      this._selectedIndex++;
      this._emit();
    }
  }

  selectPrev() {
    if (this._selectedIndex > 0) {
      this._selectedIndex--;
      this._emit();
    }
  }

  async playSelected() {
    const f = this._files[this._selectedIndex];
    if (f) await this.playFile(f);
  }

  async playFile(filePath: string) {
    return this._enqueue(async () => {
      this._setFile(filePath);
      await this._restart(this._baseOffset, "playing");
    });
  }

  async togglePause() {
    return this._enqueue(async () => {
      if (!this._filePath) return;
      if (this._state === "playing" && this._proc) {
        const cur = this.elapsed;
        this._writeProc("p");
        this._stopTicker();
        this._state = "paused";
        this._elapsed = cur;
        this._baseOffset = cur;
        this._emit();
      } else if (this._state === "paused" && this._proc) {
        this._writeProc("p");
        this._startTime = Date.now();
        this._state = "playing";
        this._startTicker();
        this._emit();
      } else {
        await this._restart(this._baseOffset, "playing");
      }
    });
  }

  async stop() {
    return this._enqueue(async () => {
      const p = this._detach();
      await this._kill(p);
      this._stopTicker();
      this._state = "stopped";
      this._elapsed = 0;
      this._baseOffset = 0;
      this._emit();
    });
  }

  async scrub(delta: number) {
    return this._enqueue(async () => {
      if (!this._filePath) return;
      const target = clamp(this.elapsed + delta, 0, this._duration || Infinity);
      this._elapsed = target;
      this._baseOffset = target;
      if (this._state !== "stopped") await this._restart(target, this._state);
      else this._emit();
    });
  }

  async changeVolume(delta: number) {
    return this._enqueue(async () => {
      this._volume = clamp(this._volume + delta, 0, 100);
      if (this._filePath && this._state !== "stopped") {
        await this._restart(this.elapsed, this._state);
      } else {
        this._emit();
      }
    });
  }

  destroy() {
    const p = this._detach();
    void this._kill(p);
    this._stopTicker();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _scanDir(dir: string) {
    try {
      const names = fs.readdirSync(dir).filter(n => AUDIO_RE.test(n)).sort();
      this._files = names.map(n => path.join(dir, n));
    } catch { /* dir may not exist */ }
  }

  private _setFile(filePath: string) {
    this._filePath = filePath;
    this._fileName = basename(filePath);
    this._duration = this._getDuration(filePath);
    this._elapsed = 0;
    this._baseOffset = 0;
    const idx = this._files.indexOf(filePath);
    if (idx >= 0) this._selectedIndex = idx;
    this._emit();
  }

  private _getDuration(filePath: string): number {
    try {
      const out = execFileSync("ffprobe", [
        "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", filePath,
      ], { encoding: "utf-8", timeout: 5000 });
      const d = parseFloat(out.trim());
      return isFinite(d) ? d : 0;
    } catch { return 0; }
  }

  private _emit() {
    for (const fn of this._listeners) fn();
  }

  private _enqueue(op: () => Promise<void>): Promise<void> {
    const run = this._opChain.then(op, op);
    this._opChain = run.catch(() => undefined);
    return run;
  }

  private async _restart(offset: number, desiredState: PlayState) {
    const old = this._detach();
    await this._kill(old);
    if (!this._filePath) return;
    await this._spawn(offset, desiredState);
  }

  private async _spawn(offset: number, desiredState: PlayState) {
    const args = ["-nodisp", "-autoexit", "-volume", String(this._volume)];
    if (offset > 0) args.push("-ss", String(Math.floor(offset)));
    args.push(this._filePath);

    const proc = spawn("ffplay", args, { stdio: ["pipe", "pipe", "pipe"] });
    const gen = ++this._generation;
    this._proc = proc;
    this._activeGen = gen;
    this._elapsed = offset;
    this._baseOffset = offset;
    this._startTime = Date.now();

    // Wait 200ms for startup errors before declaring playing
    await new Promise<void>((resolve, reject) => {
      let done = false;
      let stderrBuf = "";
      const timer = setTimeout(() => { cleanup(); resolve(); }, 200);
      const cleanup = () => {
        clearTimeout(timer);
        proc.off("error", onErr);
        proc.off("close", onClose);
      };
      const onErr = (e: Error) => { if (!done) { done = true; cleanup(); reject(e); } };
      const onClose = (code: number | null) => {
        if (!done) {
          done = true; cleanup();
          reject(new Error(`ffplay exited at startup (code=${code}) ${stderrBuf.slice(0,200)}`));
        }
      };
      proc.stderr?.on("data", (d: Buffer) => { if (stderrBuf.length < 400) stderrBuf += d.toString(); });
      proc.once("error", onErr);
      proc.once("close", onClose);
    }).catch((e) => {
      if (gen === this._activeGen) this._handleExit();
      throw e;
    });

    this._state = "playing";
    this._startTicker();
    this._emit();

    proc.on("error", () => { if (gen === this._activeGen) this._handleExit(); });
    proc.on("close", () => { if (gen === this._activeGen) this._handleExit(); });

    if (desiredState === "paused") {
      await new Promise(r => setTimeout(r, 60));
      this._writeProc("p");
      this._stopTicker();
      this._state = "paused";
      this._elapsed = offset;
      this._baseOffset = offset;
      this._emit();
    }
  }

  private _handleExit() {
    this._proc = null;
    this._stopTicker();
    this._state = "stopped";
    this._elapsed = 0;
    this._baseOffset = 0;
    this._emit();
  }

  private _detach(): ChildProcess | null {
    const p = this._proc;
    this._proc = null;
    this._stopTicker();
    this._activeGen = ++this._generation;
    return p;
  }

  private async _kill(proc: ChildProcess | null) {
    if (!proc) return;
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    await new Promise<void>(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const hard = setTimeout(finish, 2000);
      const kill2 = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 500);
      proc.once("close", () => { clearTimeout(hard); clearTimeout(kill2); finish(); });
      proc.once("error", finish);
      try { proc.kill("SIGTERM"); } catch { finish(); }
    });
  }

  private _writeProc(input: string) {
    try { (this._proc as any)?.stdin?.write(input); } catch {}
  }

  private _startTicker() {
    this._stopTicker();
    this._ticker = setInterval(() => {
      if (this._state === "playing") this._emit();
    }, 250);
  }

  private _stopTicker() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
  }
}

// ── Window ───────────────────────────────────────────────────────────────────

export function openMusicPlayerWindow(
  deps: MusicPlayerDeps,
  restore?: MusicPlayerRestore
): void {
  const frame = deps.windowManager.createFrame("♫ Music Player", "microapp");
  frame.frame.width = 82;
  frame.frame.height = 22;

  const ctrl = new AudioController(restore?.playlist);
  if (restore?.volume !== undefined) {
    void ctrl.changeVolume(restore.volume - DEFAULT_VOL);
  }

  // ── Layout containers ────────────────────────────────────────────────────

  // Player pane (left / full) — dimensions set by layout(), not blessed CSS
  const playerPane = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    style: theme().body,
    tags: true,
  });

  // Playlist pane (right — hidden until window is wide enough)
  const playlistPane = blessed.list({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    hidden: true,
    mouse: true,
    keys: false,
    vi: false,
    scrollable: true,
    style: {
      ...(theme().body as any),
      selected: { ...(theme().body as any), inverse: true },
    },
    tags: true,
  }) as blessed.Widgets.ListElement;

  let playlistVisible = false;

  // ── Spectrum visualiser ──────────────────────────────────────────────────

  const vizPane = blessed.box({
    parent: playerPane,
    top: 0, left: 0, width: 1, height: 1,
    hidden: true,
    style: theme().body,
    tags: false,
  });

  // Band state: current height (0–1) and peak hold
  const bandH    = new Float32Array(VIZ_BANDS).fill(0);
  const bandPeak = new Float32Array(VIZ_BANDS).fill(0);
  const DECAY  = 0.18;   // per-tick fall speed
  const PEAK_DECAY = 0.04;

  let vizTimer: ReturnType<typeof setInterval> | null = null;

  function startViz() {
    if (vizTimer) return;
    vizTimer = setInterval(() => {
      const playing = ctrl.state === "playing";
      for (let i = 0; i < VIZ_BANDS; i++) {
        if (playing) {
          // Randomised target with some frequency-shape bias
          // (low + high bands slightly louder — typical of music)
          const bias = i < 4 || i > VIZ_BANDS - 5 ? 0.75 : 0.55;
          const spike = Math.random() < 0.18 ? Math.random() * 0.6 : 0;
          const target = bias * Math.random() + spike;
          // Smooth rise, gravity fall
          bandH[i] = bandH[i] < target
            ? bandH[i] + (target - bandH[i]) * 0.55
            : bandH[i] - DECAY * (1 + Math.random() * 0.3);
        } else {
          bandH[i] = Math.max(0, bandH[i] - DECAY * 1.5);
        }
        bandH[i] = clamp(bandH[i], 0, 1);
        if (bandH[i] > bandPeak[i]) {
          bandPeak[i] = bandH[i];
        } else {
          bandPeak[i] = Math.max(0, bandPeak[i] - PEAK_DECAY);
        }
      }
      renderViz();
      deps.screen.render();
    }, 80);
  }

  function stopViz() {
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
  }

  function renderViz() {
    if (vizPane.hidden) return;
    const totalLevels = VIZ_ROWS * 8; // 8 sub-rows per char row
    const lines: string[] = [];

    for (let row = VIZ_ROWS - 1; row >= 0; row--) {
      let line = " ";
      for (let b = 0; b < VIZ_BANDS; b++) {
        const level = Math.round(bandH[b] * totalLevels);
        const peakLevel = Math.round(bandPeak[b] * totalLevels);
        const rowBase = row * 8;
        const fill = clamp(level - rowBase, 0, 8);
        const isPeak = peakLevel >= rowBase + 7 && peakLevel < rowBase + 8 + 8;

        if (fill === 8) {
          line += "█";
        } else if (fill > 0) {
          line += BLOCKS[fill] ?? " ";
        } else if (isPeak && row > 0) {
          line += "▔"; // peak hold dot
        } else {
          line += " ";
        }
        line += " "; // gap between bands
      }
      lines.push(line);
    }
    lines.push(" ─ SPECTRUM ─".padEnd(VIZ_BANDS * 2, "─").slice(0, VIZ_BANDS * 2 + 1));
    vizPane.setContent(lines.join("\n"));
  }

  let vizVisible = false;

  // ── Toolbar ──────────────────────────────────────────────────────────────

  type ToolbarAction = "playpause" | "stop" | "prev" | "next" | "voldown" | "volup" | "add";
  const toolbar = createButtonBar<ToolbarAction>(
    frame.body,
    [
      { id: "prev",      label: "◀◀" },
      { id: "playpause", label: "▶/⏸" },
      { id: "stop",      label: "■" },
      { id: "next",      label: "▶▶" },
      { id: "voldown",   label: "vol-" },
      { id: "volup",     label: "vol+" },
      { id: "add",       label: "+ add" },
    ],
    (id) => {
      if (id === "playpause") void ctrl.togglePause();
      else if (id === "stop")  void ctrl.stop();
      else if (id === "prev")  { ctrl.selectPrev(); void ctrl.playSelected(); }
      else if (id === "next")  { ctrl.selectNext(); void ctrl.playSelected(); }
      else if (id === "voldown") void ctrl.changeVolume(-VOL_STEP);
      else if (id === "volup")   void ctrl.changeVolume(VOL_STEP);
      else if (id === "add") openFileBrowser();
    },
  );

  // ── File browser ─────────────────────────────────────────────────────────

  function openFileBrowser() {
    const startDir = fs.existsSync(getMusicDir()) ? getMusicDir() : process.cwd();
    deps.overlays.openFileBrowserPrompt(
      "Add audio file",
      startDir,
      (filePath) => {
        ctrl.addFiles([filePath]);
        void ctrl.playFile(filePath);
      },
      { fileFilter: (fp, isDir) => isDir || AUDIO_RE.test(basename(fp)) },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmtTime(secs: number): string {
    const s = Math.max(0, isFinite(secs) ? secs : 0);
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  function progressBar(ratio: number, width: number): string {
    const filled = Math.round(clamp(ratio, 0, 1) * width);
    return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
  }

  function volumeBar(vol: number): string {
    const bars = Math.round(vol / 10);
    return "▮".repeat(bars) + "▯".repeat(10 - bars);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function layout() {
    const bodyW = Math.max(10, Number(frame.body.width) || 52);
    const bodyH = Math.max(2, Number(frame.body.height) || 12);
    const showPlaylist = bodyW >= PLAYLIST_MIN_WIDTH;

    if (showPlaylist !== playlistVisible) {
      playlistVisible = showPlaylist;
      if (showPlaylist) {
        playlistPane.show();
      } else {
        playlistPane.hide();
      }
    }

    const playerW = showPlaylist ? bodyW - PLAYLIST_WIDTH - 1 : bodyW;
    const paneH = Math.max(1, bodyH - 1);

    // Player pane — explicit width+height, no right/bottom
    playerPane.top = 0;
    playerPane.left = 0;
    playerPane.width = playerW;
    playerPane.height = paneH;

    if (showPlaylist) {
      playlistPane.top = 0;
      playlistPane.left = playerW;
      playlistPane.width = PLAYLIST_WIDTH;
      playlistPane.height = paneH;
    }

    // Toolbar anchored to bottom
    toolbar.layout({ top: bodyH - 1, left: 0, width: bodyW, height: 1 });
  }

  function renderPlayer() {
    const w = Math.max(20, Number(playerPane.width) - 2);
    const elapsed = ctrl.elapsed;
    const duration = ctrl.duration;
    const ratio = duration > 0 ? elapsed / duration : 0;

    const stateIcon  = ctrl.state === "playing" ? "▶" : ctrl.state === "paused" ? "⏸" : "■";
    const stateLabel = ctrl.state === "playing" ? "PLAYING" : ctrl.state === "paused" ? "PAUSED" : "STOPPED";

    const lines = [
      "",
      ` ♫  ${ctrl.fileName}`,
      "",
      ` ${stateIcon}  ${stateLabel}    ${fmtTime(elapsed)} / ${fmtTime(duration)}`,
      "",
      ` ${progressBar(ratio, w - 2)}`,
      "",
      ` Vol: ${volumeBar(ctrl.volume)}  ${ctrl.volume}%`,
      "",
      ` [←/→] scrub  [↑/↓] prev/next track`,
    ];
    playerPane.setContent(lines.join("\n"));
  }

  function renderPlaylist() {
    if (!playlistVisible) return;

    const files = ctrl.files;
    const items = files.map((fp, i) => {
      const name = basename(fp);
      const isPlaying = fp === ctrl.filePath && ctrl.state !== "stopped";
      const prefix = isPlaying ? "♫ " : "  ";
      const maxLen = PLAYLIST_WIDTH - 3;
      const label = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
      return `${prefix}${label}`;
    });
    (playlistPane as any).setItems(items);
    (playlistPane as any).select(ctrl.selectedIndex);
  }

  function render() {
    layout();
    renderPlayer();
    renderPlaylist();
    toolbar.update({
      leftText: "",
      activeId: ctrl.state === "playing" ? "playpause" : "stop",
    });
    deps.onStateChanged?.();
    deps.screen.render();
  }

  // Subscribe to controller changes
  const unsub = ctrl.subscribe(render);

  // Playlist click → play
  playlistPane.on("select", (_item: any, index: number) => {
    const f = ctrl.files[index];
    if (f) {
      ctrl.addFiles([]); // no-op, just ensuring index sync
      void ctrl.playFile(f);
    }
  });

  // ── Key bindings ─────────────────────────────────────────────────────────

  playerPane.key(["space"],      () => void ctrl.togglePause());
  playerPane.key(["s"],          () => void ctrl.stop());
  playerPane.key(["q"],          () => deps.windowManager.closeWindow(frame.id));
  playerPane.key(["+", "="],     () => void ctrl.changeVolume(VOL_STEP));
  playerPane.key(["-"],          () => void ctrl.changeVolume(-VOL_STEP));
  playerPane.key(["right"],      () => void ctrl.scrub(SCRUB_SECS));
  playerPane.key(["left"],       () => void ctrl.scrub(-SCRUB_SECS));
  playerPane.key(["up"],         () => { ctrl.selectPrev(); void ctrl.playSelected(); });
  playerPane.key(["down"],       () => { ctrl.selectNext(); void ctrl.playSelected(); });
  playerPane.key(["o", "a"],     () => openFileBrowser());

  // ── Window registration ──────────────────────────────────────────────────

  frame.kind = "microapp";
  frame.refresh = render;
  frame.describeState = () => ({
    appType: "music-player" as const,
    summary: `Music player: ${ctrl.fileName} [${ctrl.state}]`,
    filePath: ctrl.filePath,
    fileName: ctrl.fileName,
    state: ctrl.state,
    elapsed: Math.round(ctrl.elapsed),
    duration: Math.round(ctrl.duration),
    volume: ctrl.volume,
    playlist: ctrl.files,
  });
  frame.cleanup = () => {
    unsub();
    ctrl.destroy();
    toolbar.destroy();
  };
  frame.setFocusTarget(playerPane);
  frame.onRestyle = () => {
    createRestyleBundle([
      [playerPane, () => theme().body],
    ]).restyle();
    playlistPane.style = {
      ...(theme().body as any),
      selected: { ...(theme().body as any), inverse: true },
    };
    toolbar.restyle();
    deps.screen.render();
  };

  // Public controller for API/commands
  (frame as any).musicPlayer = {
    play:      () => void ctrl.togglePause(),
    pause:     () => { if (ctrl.state === "playing") void ctrl.togglePause(); },
    stop:      () => void ctrl.stop(),
    next:      () => { ctrl.selectNext(); void ctrl.playSelected(); },
    prev:      () => { ctrl.selectPrev(); void ctrl.playSelected(); },
    loadFile:  (fp: string) => void ctrl.playFile(fp),
    addFiles:  (fps: string[]) => ctrl.addFiles(fps),
    scrub:     (d: number) => void ctrl.scrub(d),
    setVolume: (v: number) => void ctrl.changeVolume(v - ctrl.volume),
    getState:  () => ({
      state: ctrl.state, filePath: ctrl.filePath,
      elapsed: ctrl.elapsed, duration: ctrl.duration,
      volume: ctrl.volume, playlist: ctrl.files,
    }),
  };

  deps.windowManager.registerWindow(frame);
  frame.focus();
  render();

  // Auto-restore or auto-play first track
  if (restore?.filePath) {
    void ctrl.playFile(restore.filePath);
  }
}
