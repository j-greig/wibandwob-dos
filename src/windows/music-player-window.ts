/**
 * Music Player Window — WinAMP-style for WibWob-DOS.
 *
 * Uses ffplay for audio (pause via stdin "p", seek via -ss).
 * Responsive: compact when narrow, playlist panel at ≥70 cols,
 * spectrum analyser when wide+tall (≥20 body rows).
 *
 * Viz modes are modular — implement VizMode and push to VIZ_MODES to add one.
 */

import blessed from "blessed";
import { execFile, spawn, type ChildProcess } from "child_process";
import { basename } from "path";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { theme } from "../core/theme/resolver.js";
import { createRestyleBundle, createButtonBar, clamp } from "../core/ui-parts.js";
import type { ThemeTokens } from "../core/theme/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";

const execFileAsync = promisify(execFile);

// ── Constants ────────────────────────────────────────────────────────────────

const AUDIO_RE           = /\.(mp3|wav|m4a|ogg|flac)$/i;
const SCRUB_SECS         = 5;
const VOL_STEP           = 10;
const DEFAULT_VOL        = 80;
const PLAYLIST_MIN_WIDTH = 70;
const PLAYLIST_WIDTH     = 28;
const VIZ_MIN_HEIGHT     = 18;
const VIZ_TICK_MS        = 80;

function getMusicDir() { return path.join(process.cwd(), "content/music"); }

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

export interface MusicPlayerPublicAPI {
  play():                void;
  pause():               void;
  stop():                void;
  next():                void;
  prev():                void;
  loadFile(fp: string):  void;
  addFiles(fps: string[]): void;
  scrub(delta: number):  void;
  setVolume(v: number):  void;
  getState(): {
    state: PlayState; filePath: string; elapsed: number;
    duration: number; volume: number; playlist: string[];
  };
}

// ── Viz SDK ───────────────────────────────────────────────────────────────────
//
// To add a new viz mode:
//   1. Write a factory function returning VizMode
//   2. Push it to VIZ_MODES
//   That's it. The player picks it up automatically.

/** Theme-derived colors passed to every viz render call. */
export interface VizColors {
  accent:    string;   // main bar / line color
  muted:     string;   // baseline / silence
  highlight: string;   // peaks / bright accent
}

/**
 * A self-contained visualiser mode.
 *
 * tick()   — called every VIZ_TICK_MS; update internal animation state.
 * render() — produce the full setContent() string (blessed tags OK).
 * reset()  — called on mode switch or resize; re-initialise any size-dependent state.
 */
export interface VizMode {
  readonly name: string;
  tick(playing: boolean): void;
  render(nW: number, nH: number, colors: VizColors): string;
  reset(): void;
}

/** Convenience: wrap a char in a blessed fg color tag. */
function fg(color: string, char: string): string {
  return `{${color}-fg}${char}{/${color}-fg}`;
}

// ── Mode 0: BARS — Designers Republic spectrum ────────────────────────────────
//
// Vertical frequency bars. Shade chars encode amplitude gradient:
// ░ at the tip (light) → █ at the base (heavy). Peak dots float above.

export function createBarsViz(): VizMode {
  const MAX  = 128;
  const h    = new Float32Array(MAX).fill(0);
  const peak = new Float32Array(MAX).fill(0);
  const DECAY = 0.18, PDECAY = 0.04;

  return {
    name: "BARS",
    reset() { h.fill(0); peak.fill(0); },

    tick(playing) {
      for (let i = 0; i < MAX; i++) {
        if (playing) {
          const bias   = (i < 4 || i > MAX - 5) ? 0.75 : 0.55;
          const spike  = Math.random() < 0.18 ? Math.random() * 0.6 : 0;
          const target = bias * Math.random() + spike;
          h[i] = h[i] < target
            ? h[i] + (target - h[i]) * 0.55
            : h[i] - DECAY * (1 + Math.random() * 0.3);
        } else {
          h[i] = Math.max(0, h[i] - DECAY * 1.5);
        }
        h[i] = clamp(h[i], 0, 1);
        peak[i] = h[i] > peak[i] ? h[i] : Math.max(0, peak[i] - PDECAY);
      }
    },

    render(nW, nH, c) {
      const nBands = Math.max(4, nW - 1);
      const nRows  = Math.max(1, nH);

      // Shade char by row-from-bottom: light at tip, solid at base
      const shadeAt = (rFromBot: number): string => {
        const t = rFromBot / Math.max(1, nRows - 1);
        if (t >= 0.75) return "█";
        if (t >= 0.50) return "▓";
        if (t >= 0.25) return "▒";
        return "░";
      };

      const lines: string[] = [];
      for (let row = 0; row < nRows; row++) {
        const rFromBot  = nRows - 1 - row;
        const threshold = rFromBot / nRows;
        let line = " ";
        for (let b = 0; b < nBands; b++) {
          const bh = h[b % MAX];
          const bp = peak[b % MAX];
          const peakRow = nRows - 1 - Math.round(bp * (nRows - 1));
          if (bh > threshold && bh > 0) {
            line += fg(c.accent, shadeAt(rFromBot));
          } else if (row === peakRow && bp > 0.05) {
            line += fg(c.highlight, "▔");
          } else {
            line += " ";
          }
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
  };
}

// ── Mode 1: SCOPE — oscilloscope ──────────────────────────────────────────────
//
// Composite sine wave with smooth amp envelope. Single waveform dot per column,
// vertical fill between steps. Faint baseline when idle.

export function createScopeViz(): VizMode {
  let phase = 0;
  let amp   = 0;
  const FREQS = [1.0, 2.3, 0.7, 3.1]; // harmonic mix

  return {
    name: "WAVE",
    reset() { phase = 0; amp = 0; },

    tick(playing) {
      phase += playing ? 0.15 : 0.01;
      amp    = playing
        ? clamp(amp + 0.08, 0, 0.88)
        : clamp(amp - 0.05, 0, 0.88);
    },

    render(nW, nH, c) {
      const mid  = (nH - 1) / 2;
      const cols = Math.max(2, nW - 1);

      // Grid: array of strings per row, initially spaces
      const grid: string[][] = Array.from({ length: nH }, () => Array(cols + 1).fill(" "));

      // Faint baseline
      for (let x = 1; x <= cols; x++) {
        grid[Math.round(mid)][x] = fg(c.muted, "─");
      }

      if (amp > 0.02) {
        let prevRow = -1;
        for (let x = 0; x < cols; x++) {
          let val = 0;
          const t = x / (cols - 1);
          for (const f of FREQS) val += Math.sin(phase * f + t * Math.PI * 2 * f) / FREQS.length;
          const row = clamp(Math.round(mid + val * amp * mid), 0, nH - 1);

          // Vertical stem between this and previous column
          if (prevRow >= 0 && Math.abs(row - prevRow) > 1) {
            const lo = Math.min(row, prevRow) + 1;
            const hi = Math.max(row, prevRow) - 1;
            for (let fy = lo; fy <= hi; fy++) {
              grid[fy][x + 1] = fg(c.accent, "╎");
            }
          }

          // Waveform point — sub-row char based on fractional y
          const yFrac  = mid + val * amp * mid;
          const frac   = yFrac - Math.floor(yFrac);
          const ptChar = frac > 0.75 ? "▄" : frac > 0.25 ? "─" : "▀";
          grid[row][x + 1] = fg(c.accent, ptChar);
          prevRow = row;
        }
      }

      return grid.map(row => row.join("")).join("\n");
    },
  };
}

// ── Mode 2: GRID — pulse field ────────────────────────────────────────────────
//
// 2-D heat map. Glowing clusters spawn on beat, diffuse outward, decay away.
// Characters encode heat density: · ░ ▒ ▓ █. Very Milkdrop-era.

export function createGridViz(): VizMode {
  let grid: Float32Array | null = null;
  let gW = 0, gH = 0;
  let spawnTick = 0;

  const HEAT_CHARS = [" ", "·", "░", "▒", "▓", "█"] as const;

  function ensureGrid(w: number, h: number) {
    if (w === gW && h === gH && grid) return;
    gW = w; gH = h;
    grid = new Float32Array(gW * gH).fill(0);
  }

  function spawnCluster(cx: number, cy: number, radius: number) {
    if (!grid) return;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= gW || y < 0 || y >= gH) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        grid[y * gW + x] = Math.min(1, grid[y * gW + x] + Math.max(0, 1 - dist / radius));
      }
    }
  }

  return {
    name: "GRID",
    reset() { grid = null; gW = 0; gH = 0; spawnTick = 0; },

    tick(playing) {
      if (!grid || gW === 0) return;
      // Decay + light diffusion
      const next = new Float32Array(grid.length);
      for (let y = 0; y < gH; y++) {
        for (let x = 0; x < gW; x++) {
          const i    = y * gW + x;
          let   sum  = 0, n = 0;
          for (const [dy, dx] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < gW && ny >= 0 && ny < gH) { sum += grid[ny * gW + nx]; n++; }
          }
          next[i] = clamp(grid[i] * 0.84 + (n > 0 ? (sum / n) * 0.08 : 0), 0, 1);
        }
      }
      grid.set(next);

      // Spawn clusters when playing
      if (playing) {
        spawnTick++;
        const rate = Math.random() < 0.4 ? 3 : 6; // occasional dense bursts
        if (spawnTick >= rate) {
          spawnTick = 0;
          const cx = 1 + Math.floor(Math.random() * (gW - 2));
          const cy = 1 + Math.floor(Math.random() * (gH - 2));
          spawnCluster(cx, cy, 2 + Math.floor(Math.random() * 3));
        }
      }
    },

    render(nW, nH, c) {
      const w = Math.max(2, nW - 1);
      const h = Math.max(1, nH);
      ensureGrid(w, h);
      if (!grid) return "";

      const lines: string[] = [];
      for (let y = 0; y < h; y++) {
        let line = " ";
        for (let x = 0; x < w; x++) {
          const v  = grid[y * w + x];
          const ci = Math.min(HEAT_CHARS.length - 1, Math.floor(v * HEAT_CHARS.length));
          const ch = HEAT_CHARS[ci];
          if      (v < 0.05) line += " ";
          else if (v < 0.3)  line += fg(c.muted, ch);
          else               line += fg(c.accent, ch);
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
  };
}

// ── Viz mode registry ─────────────────────────────────────────────────────────
// Add new modes here — order determines cycle sequence.

const VIZ_MODES: VizMode[] = [
  createBarsViz(),
  createScopeViz(),
  createGridViz(),
];

function makeVizColors(tokens: ThemeTokens): VizColors {
  return {
    accent:    tokens.accent.fg,
    muted:     tokens.muted.fg,
    highlight: tokens.highlight.fg,
  };
}

// ── Audio controller ──────────────────────────────────────────────────────────

class AudioController {
  private _files: string[]   = [];
  private _selectedIndex     = 0;
  private _filePath          = "";
  private _fileName          = "(no file)";
  private _state: PlayState  = "stopped";
  private _volume            = DEFAULT_VOL;
  private _elapsed           = 0;
  private _duration          = 0;
  private _startTime         = 0;
  private _baseOffset        = 0;
  private _proc: ChildProcess | null = null;
  private _ticker: ReturnType<typeof setInterval> | null = null;
  private _opChain: Promise<void> = Promise.resolve();
  private _generation        = 0;
  private _activeGen         = 0;
  private _listeners         = new Set<() => void>();

  constructor(initialFiles?: string[]) {
    if (initialFiles?.length) this._files = [...initialFiles];
    else this._scanDir(getMusicDir());
  }

  get files()         { return this._files; }
  get selectedIndex() { return this._selectedIndex; }
  get filePath()      { return this._filePath; }
  get fileName()      { return this._fileName; }
  get state(): PlayState { return this._state; }
  get volume()        { return this._volume; }
  get duration()      { return this._duration; }
  get elapsed() {
    if (this._state !== "playing") return clamp(this._elapsed, 0, this._duration || Infinity);
    return clamp(this._baseOffset + (Date.now() - this._startTime) / 1000, 0, this._duration || Infinity);
  }

  subscribe(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  addFiles(paths: string[]) {
    let changed = false;
    for (const p of paths) { if (!this._files.includes(p)) { this._files.push(p); changed = true; } }
    if (changed) this._emit();
  }

  selectNext() { if (this._selectedIndex < this._files.length - 1) { this._selectedIndex++; this._emit(); } }
  selectPrev() { if (this._selectedIndex > 0) { this._selectedIndex--; this._emit(); } }

  async playSelected() { const f = this._files[this._selectedIndex]; if (f) await this.playFile(f); }

  async playFile(filePath: string) {
    return this._enqueue(async () => { await this._setFile(filePath); await this._restart(0, "playing"); });
  }

  async togglePause() {
    return this._enqueue(async () => {
      if (!this._filePath) return;
      if (this._state === "playing" && this._proc) {
        const cur = this.elapsed;
        this._writeProc("p"); this._stopTicker();
        this._state = "paused"; this._elapsed = cur; this._baseOffset = cur; this._emit();
      } else if (this._state === "paused" && this._proc) {
        this._writeProc("p"); this._startTime = Date.now();
        this._state = "playing"; this._startTicker(); this._emit();
      } else {
        await this._restart(this._baseOffset, "playing");
      }
    });
  }

  async stop() {
    return this._enqueue(async () => {
      const p = this._detach(); await this._kill(p); this._stopTicker();
      this._state = "stopped"; this._elapsed = 0; this._baseOffset = 0; this._emit();
    });
  }

  async scrub(delta: number) {
    return this._enqueue(async () => {
      if (!this._filePath) return;
      const target = clamp(this.elapsed + delta, 0, this._duration || Infinity);
      this._elapsed = target; this._baseOffset = target;
      if (this._state !== "stopped") await this._restart(target, this._state);
      else this._emit();
    });
  }

  async changeVolume(delta: number) {
    return this._enqueue(async () => {
      this._volume = clamp(this._volume + delta, 0, 100);
      if (this._filePath && this._state !== "stopped") await this._restart(this.elapsed, this._state);
      else this._emit();
    });
  }

  setVolumeDirect(v: number) { this._volume = clamp(v, 0, 100); this._emit(); }

  destroy() { const p = this._detach(); void this._kill(p); this._stopTicker(); }

  private _scanDir(dir: string) {
    try {
      const names = fs.readdirSync(dir).filter(n => AUDIO_RE.test(n)).sort();
      this._files = names.map(n => path.join(dir, n));
    } catch { /* dir may not exist yet */ }
  }

  private async _setFile(filePath: string) {
    this._filePath = filePath; this._fileName = basename(filePath);
    this._elapsed = 0; this._baseOffset = 0;
    this._duration = await this._getDuration(filePath);
    const idx = this._files.indexOf(filePath); if (idx >= 0) this._selectedIndex = idx;
    this._emit();
  }

  private async _getDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath,
      ], { timeout: 5000 });
      const d = parseFloat(stdout.trim());
      return isFinite(d) ? d : 0;
    } catch { return 0; }
  }

  private _emit() { for (const fn of this._listeners) fn(); }

  private _enqueue(op: () => Promise<void>): Promise<void> {
    const run = this._opChain.then(op, op);
    this._opChain = run.catch(() => undefined);
    return run;
  }

  private async _restart(offset: number, desiredState: PlayState) {
    const old = this._detach(); await this._kill(old);
    if (!this._filePath) return;
    await this._spawn(offset, desiredState);
  }

  private async _spawn(offset: number, desiredState: PlayState) {
    const args = ["-nodisp", "-autoexit", "-volume", String(this._volume)];
    if (offset > 0) args.push("-ss", String(Math.floor(offset)));
    args.push(this._filePath);

    const proc = spawn("ffplay", args, { stdio: ["pipe", "pipe", "pipe"] });
    const gen  = ++this._generation;
    this._proc = proc; this._activeGen = gen;
    this._elapsed = offset; this._baseOffset = offset; this._startTime = Date.now();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (err?: Error) => {
        if (settled) return; settled = true;
        clearTimeout(timer); proc.stderr?.off("data", onData); proc.off("error", onError); proc.off("close", onClose);
        err ? reject(err) : resolve();
      };
      let stderrBuf = "";
      const onData  = (d: Buffer) => { if (stderrBuf.length < 400) stderrBuf += d.toString(); };
      const onError = (e: Error) => settle(e);
      const onClose = (code: number | null) => settle(new Error(`ffplay exit at startup code=${code} ${stderrBuf.slice(0,120)}`));
      const timer   = setTimeout(() => settle(), 200);
      proc.stderr?.on("data", onData); proc.once("error", onError); proc.once("close", onClose);
    }).catch((e) => { if (gen === this._activeGen) this._handleExit(); throw e; });

    this._state = "playing"; this._startTicker(); this._emit();
    proc.on("error", () => { if (gen === this._activeGen) this._handleExit(); });
    proc.on("close", () => { if (gen === this._activeGen) this._handleExit(); });

    if (desiredState === "paused") {
      await new Promise(r => setTimeout(r, 60));
      this._writeProc("p"); this._stopTicker();
      this._state = "paused"; this._elapsed = offset; this._baseOffset = offset; this._emit();
    }
  }

  private _handleExit() {
    this._proc = null; this._stopTicker();
    this._state = "stopped"; this._elapsed = 0; this._baseOffset = 0; this._emit();
  }

  private _detach(): ChildProcess | null {
    const p = this._proc; this._proc = null; this._stopTicker(); this._activeGen = ++this._generation; return p;
  }

  private async _kill(proc: ChildProcess | null) {
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
    await new Promise<void>(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const hard  = setTimeout(finish, 2000);
      const kill2 = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 500);
      proc.once("close", () => { clearTimeout(hard); clearTimeout(kill2); finish(); });
      proc.once("error", finish);
      try { proc.kill("SIGTERM"); } catch { finish(); }
    });
  }

  private _writeProc(input: string) { try { (this._proc as any)?.stdin?.write(input); } catch {} }
  private _startTicker() { this._stopTicker(); this._ticker = setInterval(() => { if (this._state === "playing") this._emit(); }, 250); }
  private _stopTicker()  { if (this._ticker) { clearInterval(this._ticker); this._ticker = null; } }
}

// ── Window ────────────────────────────────────────────────────────────────────

export function openMusicPlayerWindow(
  deps: MusicPlayerDeps,
  restore?: MusicPlayerRestore,
): void {
  const frame = deps.windowManager.createFrame("♫ Music Player", "microapp");
  frame.frame.width  = 82;
  frame.frame.height = 22;

  const ctrl = new AudioController(restore?.playlist);
  if (restore?.volume !== undefined) ctrl.setVolumeDirect(restore.volume);

  // ── Panes ─────────────────────────────────────────────────────────────────

  const playerPane = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    style: theme().body,
    tags: true,
  });

  const playlistPane = blessed.list({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    hidden: true,
    mouse: true, keys: false, vi: false, scrollable: true,
    style: { ...(theme().body as any), selected: { ...(theme().body as any), inverse: true } },
    tags: true,
  }) as blessed.Widgets.ListElement;

  // ── Viz engine ────────────────────────────────────────────────────────────

  const vizPane = blessed.box({
    parent: playerPane,
    top: 0, left: 0, width: 1, height: 1,
    hidden: true,
    style: theme().body,
    tags: true,
  });

  let vizModeIdx  = 0;
  let vizVisible  = false;
  let vizTimer:   ReturnType<typeof setInterval> | null = null;

  function currentMode()   { return VIZ_MODES[vizModeIdx]; }
  function vizColors(): VizColors { return makeVizColors(theme()); }

  function cycleVizMode() {
    currentMode().reset();
    vizModeIdx = (vizModeIdx + 1) % VIZ_MODES.length;
    currentMode().reset();
    updateVizBtn();
    renderViz();
    deps.screen.render();
  }

  function startViz() {
    if (vizTimer) return;
    vizTimer = setInterval(() => {
      currentMode().tick(ctrl.state === "playing");
      renderViz();
      deps.screen.render();
    }, VIZ_TICK_MS);
  }

  function stopViz() {
    if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
  }

  function renderViz() {
    if (!vizVisible) return;
    const nW = Math.max(4, Number(vizPane.width));
    const nH = Math.max(1, Number(vizPane.height));
    vizPane.setContent(currentMode().render(nW, nH, vizColors()));
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  type BtnId = "playpause" | "stop" | "prev" | "next" | "voldown" | "volup" | "viz" | "add";
  const toolbar = createButtonBar<BtnId>(
    frame.body,
    [
      { id: "prev",      label: "◀◀" },
      { id: "playpause", label: "▶/⏸" },
      { id: "stop",      label: "■" },
      { id: "next",      label: "▶▶" },
      { id: "voldown",   label: "vol-" },
      { id: "volup",     label: "vol+" },
      { id: "viz",       label: currentMode().name },
      { id: "add",       label: "+ add" },
    ],
    (id) => {
      if      (id === "playpause") void ctrl.togglePause();
      else if (id === "stop")      void ctrl.stop();
      else if (id === "prev")      { ctrl.selectPrev(); void ctrl.playSelected(); }
      else if (id === "next")      { ctrl.selectNext(); void ctrl.playSelected(); }
      else if (id === "voldown")   void ctrl.changeVolume(-VOL_STEP);
      else if (id === "volup")     void ctrl.changeVolume(VOL_STEP);
      else if (id === "viz")       cycleVizMode();
      else if (id === "add")       openFileBrowser();
    },
  );

  function updateVizBtn() {
    toolbar.updateLabel("viz", currentMode().name);
  }

  // ── File browser ──────────────────────────────────────────────────────────

  function openFileBrowser() {
    const startDir = fs.existsSync(getMusicDir()) ? getMusicDir() : process.cwd();
    deps.overlays.openFileBrowserPrompt(
      "Add audio file", startDir,
      (fp) => { ctrl.addFiles([fp]); void ctrl.playFile(fp); },
      { fileFilter: (fp, isDir) => isDir || AUDIO_RE.test(basename(fp)) },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmtTime(secs: number): string {
    const s = Math.max(0, isFinite(secs) ? secs : 0);
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }
  function progressBar(ratio: number, width: number): string {
    const filled = Math.round(clamp(ratio, 0, 1) * width);
    return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
  }
  function volumeBar(vol: number): string {
    const bars = Math.round(vol / 10);
    return "▮".repeat(bars) + "▯".repeat(10 - bars);
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  let playlistVisible = false;

  function layout() {
    const bodyW = Math.max(10, Number(frame.body.width)  || 82);
    const bodyH = Math.max(2,  Number(frame.body.height) || 22);
    const showPlaylist = bodyW >= PLAYLIST_MIN_WIDTH;
    const playerW      = showPlaylist ? bodyW - PLAYLIST_WIDTH - 1 : bodyW;
    const paneH        = Math.max(1, bodyH - 1);

    if (showPlaylist !== playlistVisible) {
      playlistVisible = showPlaylist;
      showPlaylist ? playlistPane.show() : playlistPane.hide();
    }

    playerPane.top = 0; playerPane.left = 0;
    playerPane.width = playerW; playerPane.height = paneH;

    if (showPlaylist) {
      playlistPane.top = 0; playlistPane.left = playerW;
      playlistPane.width = PLAYLIST_WIDTH; playlistPane.height = paneH;
    }

    // Viz: lower portion of player pane, only when playlist visible and tall enough
    const PLAYER_INFO_ROWS = 10; // rows consumed by track info block
    const vizH      = Math.max(4, paneH - PLAYER_INFO_ROWS - 1);
    const showViz   = showPlaylist && paneH >= VIZ_MIN_HEIGHT;

    if (showViz !== vizVisible) {
      vizVisible = showViz;
      if (showViz) { vizPane.show(); startViz(); }
      else         { vizPane.hide(); stopViz();  }
    }
    if (showViz) {
      vizPane.top    = PLAYER_INFO_ROWS;
      vizPane.left   = 0;
      vizPane.width  = playerW;
      vizPane.height = vizH;
    }

    toolbar.layout({ top: bodyH - 1, left: 0, width: bodyW, height: 1 });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderPlayer() {
    const w     = Math.max(20, Number(playerPane.width) - 2);
    const elaps = ctrl.elapsed;
    const dur   = ctrl.duration;
    const ratio = dur > 0 ? elaps / dur : 0;
    const icon  = ctrl.state === "playing" ? "▶" : ctrl.state === "paused" ? "⏸" : "■";
    const lbl   = ctrl.state === "playing" ? "PLAYING" : ctrl.state === "paused" ? "PAUSED" : "STOPPED";
    playerPane.setContent([
      "",
      ` ♫  ${ctrl.fileName}`,
      "",
      ` ${icon}  ${lbl}    ${fmtTime(elaps)} / ${fmtTime(dur)}`,
      "",
      ` ${progressBar(ratio, w - 2)}`,
      "",
      ` Vol: ${volumeBar(ctrl.volume)}  ${ctrl.volume}%`,
      "",
      ` [←/→] scrub  [↑/↓] prev/next  [v] cycle viz`,
    ].join("\n"));
  }

  function renderPlaylist() {
    if (!playlistVisible) return;
    const items = ctrl.files.map((fp) => {
      const name    = basename(fp);
      const playing = fp === ctrl.filePath && ctrl.state !== "stopped";
      const maxLen  = PLAYLIST_WIDTH - 3;
      const label   = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
      return `${playing ? "♫ " : "  "}${label}`;
    });
    (playlistPane as any).setItems(items);
    (playlistPane as any).select(ctrl.selectedIndex);
  }

  function render() {
    layout();
    renderPlayer();
    renderPlaylist();
    renderViz();
    toolbar.update({ leftText: "", activeId: ctrl.state === "playing" ? "playpause" : "stop" });
    deps.onStateChanged?.();
    deps.screen.render();
  }

  // ── Events ────────────────────────────────────────────────────────────────

  const unsub = ctrl.subscribe(render);

  playlistPane.on("select", (_item: any, index: number) => {
    const f = ctrl.files[index];
    if (f) void ctrl.playFile(f);
  });

  playerPane.key(["space"],    () => void ctrl.togglePause());
  playerPane.key(["s"],        () => void ctrl.stop());
  playerPane.key(["v"],        () => cycleVizMode());
  playerPane.key(["q"],        () => deps.windowManager.closeWindow(frame.id));
  playerPane.key(["+", "="],   () => void ctrl.changeVolume(VOL_STEP));
  playerPane.key(["-"],        () => void ctrl.changeVolume(-VOL_STEP));
  playerPane.key(["right"],    () => void ctrl.scrub(SCRUB_SECS));
  playerPane.key(["left"],     () => void ctrl.scrub(-SCRUB_SECS));
  playerPane.key(["up"],       () => { ctrl.selectPrev(); void ctrl.playSelected(); });
  playerPane.key(["down"],     () => { ctrl.selectNext(); void ctrl.playSelected(); });
  playerPane.key(["o", "a"],   () => openFileBrowser());

  // ── Window registration ───────────────────────────────────────────────────

  frame.kind    = "microapp";
  frame.refresh = render;

  frame.writeInput = (input: string) => {
    const k = input.trim().toLowerCase();
    if      (k === " " || k === "play" || k === "pause") {
      // If nothing loaded yet, play the selected/first track
      if (!ctrl.filePath && ctrl.files.length > 0) void ctrl.playSelected();
      else void ctrl.togglePause();
    }
    else if (k === "stop")  void ctrl.stop();
    else if (k === "next")  { ctrl.selectNext(); void ctrl.playSelected(); }
    else if (k === "prev")  { ctrl.selectPrev(); void ctrl.playSelected(); }
    else if (k === "vol+")  void ctrl.changeVolume(VOL_STEP);
    else if (k === "vol-")  void ctrl.changeVolume(-VOL_STEP);
    else if (k === "v")     cycleVizMode();
  };

  frame.describeState = () => ({
    appType:  "music-player" as const,
    summary:  `Music player: ${ctrl.fileName} [${ctrl.state}]`,
    filePath: ctrl.filePath,
    fileName: ctrl.fileName,
    state:    ctrl.state,
    elapsed:  Math.round(ctrl.elapsed),
    duration: Math.round(ctrl.duration),
    volume:   ctrl.volume,
    playlist: ctrl.files,
    vizMode:  currentMode().name,
  });

  frame.cleanup = () => {
    unsub();
    stopViz();
    ctrl.destroy();
    toolbar.destroy();
  };

  frame.setFocusTarget(playerPane);

  frame.onRestyle = () => {
    createRestyleBundle([
      [playerPane, () => theme().body],
      [vizPane,    () => theme().body],
    ]).restyle();
    playlistPane.style = {
      ...(theme().body as any),
      selected: { ...(theme().body as any), inverse: true },
    };
    toolbar.restyle();
    renderViz();
    deps.screen.render();
  };

  const publicAPI: MusicPlayerPublicAPI = {
    play:      () => void ctrl.togglePause(),
    pause:     () => { if (ctrl.state === "playing") void ctrl.togglePause(); },
    stop:      () => void ctrl.stop(),
    next:      () => { ctrl.selectNext(); void ctrl.playSelected(); },
    prev:      () => { ctrl.selectPrev(); void ctrl.playSelected(); },
    loadFile:  (fp) => void ctrl.playFile(fp),
    addFiles:  (fps) => ctrl.addFiles(fps),
    scrub:     (d) => void ctrl.scrub(d),
    setVolume: (v) => void ctrl.changeVolume(v - ctrl.volume),
    getState:  () => ({
      state: ctrl.state, filePath: ctrl.filePath,
      elapsed: ctrl.elapsed, duration: ctrl.duration,
      volume: ctrl.volume, playlist: ctrl.files,
    }),
  };
  (frame as any).musicPlayer = publicAPI;

  deps.windowManager.registerWindow(frame);
  frame.focus();
  render();

  if (restore?.filePath) void ctrl.playFile(restore.filePath);
}
