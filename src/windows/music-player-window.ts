/**
 * Music Player Window — WinAMP-style for WibWob-DOS.
 *
 * Audio engine:  ffplay for playback (pause via stdin "p", seek via -ss).
 * Audio analysis: parallel ffmpeg process pipes raw PCM (s16le mono 8kHz).
 *                 Node reads 256-sample chunks, bins into N frequency bands,
 *                 feeds real amplitudes + RMS to viz tick loop.
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
import { createScrollbar, scrollableStyle } from "../core/ui-primitives.js";
import { escapeBlessedTags } from "../core/blessed-escape.js";
import { createRestyleBundle, createLayoutButtonBar, clamp, type ButtonBarPart } from "../core/ui-parts.js";
import type { ThemeTokens } from "../core/theme/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";
import { VIZ_BANDS, VIZ_MODES, type VizColors, type VizMode } from "./music-player-viz.js";

const execFileAsync = promisify(execFile);

// ── Constants ────────────────────────────────────────────────────────────────

const AUDIO_RE           = /\.(mp3|wav|m4a|ogg|flac)$/i;
const SCRUB_SECS         = 5;
const VOL_STEP           = 10;
const DEFAULT_VOL        = 80;
const PLAYLIST_MIN_WIDTH = 70;
const PLAYLIST_WIDTH     = 30;
const VIZ_MIN_HEIGHT     = 12;
const VIZ_TICK_MS        = 80;

// PCM analysis constants
const PCM_SAMPLE_RATE  = 8000;          // 8kHz — enough for spectrum up to 4kHz
const PCM_CHUNK_FRAMES = 256;           // samples per analysis frame
const PCM_BYTES        = PCM_CHUNK_FRAMES * 2;  // s16le = 2 bytes/sample


function getMusicDir() { return path.join(process.cwd(), "assets/music"); }

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

// ── Audio Analyser ────────────────────────────────────────────────────────────
//
// Spawns a parallel ffmpeg process to pipe raw PCM from the same file at the
// same seek offset. Reads chunks, runs a 256-point radix-2 FFT, bins magnitude
// spectrum into VIZ_BANDS log-spaced bands, exposes bands + RMS for viz tick.

/** Cooley-Tukey radix-2 in-place FFT (n must be a power of 2). */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // bit-reverse permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!; re[i] = re[j]!; re[j] = t;
      t = im[i]!;     im[i] = im[j]!; im[j] = t;
    }
  }
  // butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1, cIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j]!,        uIm = im[i + j]!;
        const vRe = re[i + j + half]! * cRe - im[i + j + half]! * cIm;
        const vIm = re[i + j + half]! * cIm + im[i + j + half]! * cRe;
        re[i + j]        = uRe + vRe;  im[i + j]        = uIm + vIm;
        re[i + j + half] = uRe - vRe;  im[i + j + half] = uIm - vIm;
        const nr = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe; cRe = nr;
      }
    }
  }
}

class AudioAnalyser {
  private _proc:       ChildProcess | null = null;
  private _buf:        Buffer = Buffer.alloc(0);
  private _bands:      Float32Array = new Float32Array(VIZ_BANDS).fill(0);
  private _smooth:     Float32Array = new Float32Array(VIZ_BANDS).fill(0);
  private _rms:        number = 0;
  private _rollingPeak = 0.001;

  // Pre-allocated FFT scratch buffers
  private readonly _re = new Float32Array(PCM_CHUNK_FRAMES);
  private readonly _im = new Float32Array(PCM_CHUNK_FRAMES);

  // Log-spaced band edges (computed once)
  private readonly _bandEdges: Array<[number, number]>;

  private readonly DECAY = 0.12;

  constructor() {
    const minF = 40, maxF = PCM_SAMPLE_RATE / 2;
    const logMin = Math.log2(minF), logMax = Math.log2(maxF);
    const freqPerBin = PCM_SAMPLE_RATE / PCM_CHUNK_FRAMES;
    this._bandEdges = Array.from({ length: VIZ_BANDS }, (_, b) => {
      const fLo = Math.pow(2, logMin + (b       / VIZ_BANDS) * (logMax - logMin));
      const fHi = Math.pow(2, logMin + ((b + 1) / VIZ_BANDS) * (logMax - logMin));
      const iLo = Math.max(0, Math.floor(fLo / freqPerBin));
      const iHi = Math.min(PCM_CHUNK_FRAMES / 2 - 1, Math.ceil(fHi / freqPerBin));
      return [iLo, Math.max(iLo, iHi)] as [number, number];
    });
  }

  get bands(): Float32Array { return this._smooth; }
  get rms():   number       { return this._rms; }

  start(filePath: string, offsetSecs: number) {
    this.stop();
    const args = [
      "-v", "quiet",
      "-ss", String(Math.max(0, Math.floor(offsetSecs))),
      "-re",    // throttle to real-time — prevents decoding entire file instantly
      "-i", filePath,
      "-af", `aformat=sample_fmts=s16:channel_layouts=mono,aresample=${PCM_SAMPLE_RATE}`,
      "-f", "s16le",
      "pipe:1",
    ];
    try {
      this._proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] });
      this._proc.stdout?.on("data", (chunk: Buffer) => this._onData(chunk));
      this._proc.once("close", () => { this._proc = null; });
      this._proc.once("error", ()  => { this._proc = null; });
    } catch { this._proc = null; }
  }

  stop() {
    const p = this._proc; this._proc = null; this._buf = Buffer.alloc(0);
    if (p) { try { p.kill("SIGTERM"); } catch {} }
  }

  /** Smooth all bands toward zero — call each viz tick when paused/stopped. */
  decay() {
    for (let i = 0; i < VIZ_BANDS; i++) this._smooth[i] = Math.max(0, this._smooth[i]! - this.DECAY * 1.5);
    this._rms = Math.max(0, this._rms - 0.05);
  }

  private _onData(chunk: Buffer) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= PCM_BYTES) {
      this._processFrame(this._buf.subarray(0, PCM_BYTES));
      this._buf = this._buf.subarray(PCM_BYTES);
    }
  }

  private _processFrame(frame: Buffer) {
    const n = PCM_CHUNK_FRAMES;

    // s16le → float with Hann window + RMS accumulation
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const s = frame.readInt16LE(i * 2) / 32768;
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / n));  // Hann window
      this._re[i] = s * w;
      this._im[i] = 0;
      sumSq += s * s;
    }
    this._rms = Math.sqrt(sumSq / n);

    // FFT
    fftInPlace(this._re, this._im);

    // Magnitude spectrum (first n/2 bins)
    const mag = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      mag[k] = Math.sqrt(this._re[k]! * this._re[k]! + this._im[k]! * this._im[k]!) / n;
    }

    // Bin into VIZ_BANDS log-spaced bands
    for (let b = 0; b < VIZ_BANDS; b++) {
      const [iLo, iHi] = this._bandEdges[b]!;
      let sum = 0;
      for (let k = iLo; k <= iHi; k++) sum += mag[k]!;
      this._bands[b] = sum / (iHi - iLo + 1);
    }

    // Rolling peak normalisation — adapts to track loudness
    const frameMax = Math.max(...Array.from(this._bands));
    this._rollingPeak = Math.max(this._rollingPeak * 0.996, frameMax, 0.001);

    // Smooth: fast attack (0.7), slow decay (DECAY per frame)
    for (let b = 0; b < VIZ_BANDS; b++) {
      const raw = clamp(this._bands[b]! / this._rollingPeak, 0, 1);
      this._smooth[b] = raw > this._smooth[b]!
        ? this._smooth[b]! + (raw - this._smooth[b]!) * 0.7
        : Math.max(0, this._smooth[b]! - this.DECAY);
    }
  }
}

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
  readonly analyser          = new AudioAnalyser();

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
        this._state = "paused"; this._elapsed = cur; this._baseOffset = cur;
        this.analyser.stop();
        this._emit();
      } else if (this._state === "paused" && this._proc) {
        this._writeProc("p"); this._startTime = Date.now();
        this._state = "playing";
        this.analyser.start(this._filePath, this._baseOffset);
        this._startTicker(); this._emit();
      } else {
        await this._restart(this._baseOffset, "playing");
      }
    });
  }

  async stop() {
    return this._enqueue(async () => {
      const p = this._detach(); await this._kill(p); this._stopTicker();
      this.analyser.stop();
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

  destroy() {
    const p = this._detach(); void this._kill(p); this._stopTicker();
    this.analyser.stop();
  }

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
    this.analyser.stop();
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

    this._state = "playing";
    this.analyser.start(this._filePath, offset);
    this._startTicker(); this._emit();

    proc.on("error", () => { if (gen === this._activeGen) this._handleExit(); });
    proc.on("close", () => { if (gen === this._activeGen) this._handleExit(); });

    if (desiredState === "paused") {
      await new Promise(r => setTimeout(r, 60));
      this._writeProc("p"); this._stopTicker();
      this.analyser.stop();
      this._state = "paused"; this._elapsed = offset; this._baseOffset = offset; this._emit();
    }
  }

  private _handleExit() {
    this._proc = null; this._stopTicker();
    this.analyser.stop();
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

  private _writeProc(input: string) { try { this._proc?.stdin?.write(input); } catch {} }
  private _startTicker() { this._stopTicker(); this._ticker = setInterval(() => { if (this._state === "playing") this._emit(); }, 250); }
  private _stopTicker()  { if (this._ticker) { clearInterval(this._ticker); this._ticker = null; } }
}

// ── Window ────────────────────────────────────────────────────────────────────

export function openMusicPlayerWindow(
  deps: MusicPlayerDeps,
  restore?: MusicPlayerRestore,
): void {
  const frame = deps.windowManager.createFrame("♫ Music Player", "microapp");
  // Responsive sizing: 65% width, 65% height, centered
  const screenW = Number(deps.screen.width) || 211;
  const screenH = Number(deps.screen.height) || 56;
  frame.frame.width  = Math.max(82, Math.round(screenW * 0.65));
  frame.frame.height = Math.max(22, Math.round(screenH * 0.65));
  frame.frame.left   = Math.round((screenW - Number(frame.frame.width)) / 2);
  frame.frame.top    = Math.round((screenH - Number(frame.frame.height)) / 2);

  const ctrl = new AudioController(restore?.playlist);
  if (restore?.volume !== undefined) ctrl.setVolumeDirect(restore.volume);

  // ── Panes ─────────────────────────────────────────────────────────────────

  const playerPane = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    style: theme().body,
    tags: true,
    input: true,
    keys: true,
  });

  const playlistPane = blessed.list({
    parent: frame.body,
    top: 0, left: 0, width: 1, height: 1,
    hidden: true,
    mouse: true, keys: false, vi: false, scrollable: true,
    scrollbar: createScrollbar(),
    style: { ...scrollableStyle(theme().body), selected: { ...theme().body, inverse: true } },
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

  // Stable scratch arrays — avoid allocating on every tick
  const _emptyBands = new Float32Array(VIZ_BANDS).fill(0);

  function currentMode() { return VIZ_MODES[vizModeIdx]!; }
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
      const playing = ctrl.state === "playing";
      const bands   = playing ? ctrl.analyser.bands : _emptyBands;
      const rms     = playing ? ctrl.analyser.rms   : 0;
      if (!playing) ctrl.analyser.decay();
      currentMode().tick(bands, rms, playing);
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
  const toolbar: ButtonBarPart<BtnId> = createLayoutButtonBar<BtnId>(
    frame.body,
    [
      { id: "prev",      label: "\u23EE Prev" },
      { id: "playpause", label: "\u25B6 Play" },
      { id: "stop",      label: "\u25A0 Stop" },
      { id: "next",      label: "Next \u23ED" },
      { id: "voldown",   label: "[\u2212]" },
      { id: "volup",     label: "[+]" },
      { id: "viz",       label: `\u2248 ${currentMode().name}` },
      { id: "add",       label: "\u271A Add" },
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
    toolbar.updateLabel("viz", `\u2248 ${currentMode().name}`);
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

    const PLAYER_INFO_ROWS = 7;
    const vizH    = Math.max(4, paneH - PLAYER_INFO_ROWS - 1);
    const showViz = paneH >= VIZ_MIN_HEIGHT;  // show viz even without playlist

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
    const t = theme();
    const accentFg = t.accent?.fg || "cyan";

    // State-dependent colours
    const stateCol = ctrl.state === "playing" ? "green" : ctrl.state === "paused" ? "yellow" : "gray";
    const icon  = ctrl.state === "playing" ? "▶" : ctrl.state === "paused" ? "⏸" : "■";
    const lbl   = ctrl.state === "playing" ? "PLAYING" : ctrl.state === "paused" ? "PAUSED" : "STOPPED";

    // Coloured progress bar
    const progW = Math.max(4, w - 2);
    const filled = Math.round(clamp(ratio, 0, 1) * progW);
    const progBar = `{${accentFg}-fg}${"█".repeat(filled)}{/${accentFg}-fg}{gray-fg}${"░".repeat(Math.max(0, progW - filled))}{/gray-fg}`;

    // Coloured volume bar
    const volBars = Math.round(ctrl.volume / 10);
    const volBar = `{${accentFg}-fg}${"▮".repeat(volBars)}{/${accentFg}-fg}{gray-fg}${"▯".repeat(10 - volBars)}{/gray-fg}`;

    // Track name with colour + clean display name
    let trackName: string;
    if (ctrl.fileName === "(no file)") {
      trackName = `{gray-fg}No track loaded \u2014 press {white-fg}o{/white-fg} to browse{/gray-fg}`;
    } else {
      // Strip extension and clean up filename for display
      const display = escapeBlessedTags(ctrl.fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
      trackName = `{bold}{white-fg}${display}{/white-fg}{/bold}`;
    }

    // Now-playing display — compact with visual flair
    const sepW = Math.max(4, w - 2);
    const sep = `{${accentFg}-fg}${"\u2500".repeat(sepW)}{/${accentFg}-fg}`;
    
    // Time display with elapsed bar
    const timeDisplay = dur > 0 
      ? `{white-fg}${fmtTime(elaps)}{/white-fg} {gray-fg}/ ${fmtTime(dur)}{/gray-fg}`
      : `{gray-fg}${fmtTime(elaps)} / ${fmtTime(dur)}{/gray-fg}`;

    const lines: string[] = [
      "",
      ` {${accentFg}-fg}\u266B{/${accentFg}-fg}  ${trackName}`,
      ` {${stateCol}-fg}${icon}  ${lbl}{/${stateCol}-fg}    ${timeDisplay}`,
      ` ${progBar}`,
      "",
      ` {gray-fg}Vol:{/gray-fg} ${volBar} {white-fg}${ctrl.volume}%{/white-fg}  {gray-fg}\u2502{/gray-fg}  {gray-fg}\u2190\u2192:scrub \u2191\u2193:track v:viz o:add{/gray-fg}`,
      ` ${sep}`,
    ];
    playerPane.setContent(lines.join("\n"));
  }

  function renderPlaylist() {
    if (!playlistVisible) return;
    const accentFg = theme().accent?.fg || "cyan";
    const plW = Number(playlistPane.width) || PLAYLIST_WIDTH;
    // Header row
    const headerLine = `{bold} PLAYLIST{/bold} {gray-fg}(${ctrl.files.length} tracks){/gray-fg}`;
    const items = [headerLine, ...ctrl.files.map((fp, i) => {
      const name    = basename(fp);
      const playing = fp === ctrl.filePath && ctrl.state !== "stopped";
      const maxLen  = plW - 6;
      const label   = escapeBlessedTags(name.length > maxLen ? name.slice(0, maxLen - 1) + "\u2026" : name);
      const num     = String(i + 1).padStart(2, " ");
      if (playing) {
        return `{${accentFg}-fg}\u25B6 ${num}. ${label}{/${accentFg}-fg}`;
      }
      return `  {gray-fg}${num}.{/gray-fg} ${label}`;
    })];
    playlistPane.setItems(items);
    playlistPane.select(ctrl.selectedIndex + 1); // +1 for header
  }

  function render() {
    layout();
    renderPlayer();
    renderPlaylist();
    renderViz();
    // Dynamic title with now-playing info
    const titleTrack = ctrl.fileName !== "(no file)" ? escapeBlessedTags(ctrl.fileName) : "";
    const titleState = ctrl.state === "playing" ? " \u25B6" : ctrl.state === "paused" ? " \u23F8" : "";
    frame.frame.setLabel(` \u266B ${titleTrack ? titleTrack + titleState : "Music Player"} `);
    toolbar.update({ leftText: "", activeId: ctrl.state === "playing" ? "playpause" : "stop" });
    deps.onStateChanged?.();
    deps.screen.render();
  }

  // ── Events ────────────────────────────────────────────────────────────────

  const unsub = ctrl.subscribe(render);

  playlistPane.on("select", (_item: blessed.Widgets.BlessedElement, index: number) => {
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
    if (k === " " || k === "play" || k === "pause") {
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
      ...scrollableStyle(theme().body),
      selected: { ...theme().body, inverse: true },
    };
    toolbar.restyle();
    renderViz();
    deps.screen.render();
  };

  const publicAPI: MusicPlayerPublicAPI = {
    play:      () => {
      if (!ctrl.filePath && ctrl.files.length > 0) void ctrl.playSelected();
      else void ctrl.togglePause();
    },
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
  frame.musicPlayer = publicAPI;

  deps.windowManager.registerWindow(frame);
  frame.focus();
  render();

  if (restore?.filePath) void ctrl.playFile(restore.filePath);
}
