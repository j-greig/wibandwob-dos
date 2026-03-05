/**
 * Timeline Service — parse, validate, resolve, and execute timelines.
 *
 * This is the core scheduler. It:
 *   1. Parses a timeline YAML/JSON file
 *   2. Resolves beat/bar/section references to absolute times
 *   3. Pre-computes the full cue schedule
 *   4. On run: starts audio, then fires cues at exact timestamps
 *
 * Dispatch is in-process through CommandRegistry + WindowFacade.
 * No HTTP round-trips per cue.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import type {
  TimelineFile,
  BeatMap,
  Cue,
  CueTiming,
  ResolvedCue,
  ResolvedTimeline,
  SceneDefinition,
  CuePatch,
} from "./timeline-types.js";
import { planSceneTransition, type SceneOp } from "./scene-planner.js";
import { resolveLayout, type DesktopBounds } from "./scene-layout.js";

// ---------------------------------------------------------------------------
// Parse & validate
// ---------------------------------------------------------------------------

export interface ParseResult {
  ok: boolean;
  timeline?: ResolvedTimeline;
  errors: string[];
}

/**
 * Parse a timeline file from disk. Supports JSON and YAML (YAML needs
 * a js-yaml import — deferred until needed, JSON works now).
 */
export function parseTimeline(filePath: string): ParseResult {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    return { ok: false, errors: [`File not found: ${filePath}`] };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  let file: TimelineFile;

  try {
    if (filePath.endsWith(".json")) {
      file = JSON.parse(raw);
    } else {
      // YAML support — try dynamic import
      try {
        const yaml = require("js-yaml");
        file = yaml.load(raw) as TimelineFile;
      } catch {
        return { ok: false, errors: ["YAML parsing requires js-yaml. Install it or use JSON format."] };
      }
    }
  } catch (e) {
    return { ok: false, errors: [`Parse error: ${e}`] };
  }

  // Validate version
  if (file.version !== 1) {
    errors.push(`Unsupported version: ${file.version}. Expected 1.`);
  }

  // Validate track (optional when running with --no-audio)
  if (!file.track && !file.noAudio) {
    // Allow missing track — capture/run scripts accept --no-audio flag
  }

  // Validate duration
  if (!file.duration || file.duration <= 0) {
    errors.push("Missing or invalid duration");
  }

  // Validate scenes exist
  if (!file.scenes || Object.keys(file.scenes).length === 0) {
    errors.push("No scenes defined");
  }

  // Validate cues
  if (!file.cues || file.cues.length === 0) {
    errors.push("No cues defined");
  }

  // Resolve beat map
  let beatMap: BeatMap | undefined;
  if (typeof file.beatMap === "string") {
    const bmPath = path.resolve(path.dirname(filePath), file.beatMap);
    if (fs.existsSync(bmPath)) {
      beatMap = JSON.parse(fs.readFileSync(bmPath, "utf8"));
    } else {
      errors.push(`Beat map file not found: ${file.beatMap}`);
    }
  } else if (file.beatMap) {
    beatMap = file.beatMap;
  }

  // Validate cue references
  for (let i = 0; i < (file.cues?.length ?? 0); i++) {
    const cue = file.cues[i];
    if ("scene" in cue && !file.scenes[cue.scene]) {
      errors.push(`Cue ${i}: references unknown scene "${cue.scene}"`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Resolve cue timings
  const resolved = resolveCueTimes(file.cues, beatMap);
  if (resolved.errors.length > 0) {
    return { ok: false, errors: resolved.errors };
  }

  // Check monotonic ordering
  for (let i = 1; i < resolved.cues.length; i++) {
    if (resolved.cues[i].t < resolved.cues[i - 1].t) {
      errors.push(`Cue ${i} (t=${resolved.cues[i].t}s) is before cue ${i - 1} (t=${resolved.cues[i - 1].t}s). Cues must be monotonically ordered.`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    timeline: {
      file,
      beatMap,
      cues: resolved.cues,
      durationMs: file.duration * 1000,
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Timing resolution
// ---------------------------------------------------------------------------

function resolveCueTimes(
  cues: Cue[],
  beatMap?: BeatMap,
): { cues: ResolvedCue[]; errors: string[] } {
  const errors: string[] = [];
  const resolved: ResolvedCue[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const at = cue.at;
    const t = resolveOneTiming(at, beatMap, i, errors);
    if (t !== undefined) {
      resolved.push({ t, cue });
    }
  }

  return { cues: resolved, errors };
}

function resolveOneTiming(
  at: CueTiming,
  beatMap: BeatMap | undefined,
  index: number,
  errors: string[],
): number | undefined {
  if (at.t !== undefined) return at.t;

  if (!beatMap) {
    errors.push(`Cue ${index}: uses beat/bar/section timing but no beat map provided`);
    return undefined;
  }

  if (at.beat !== undefined) {
    const entry = beatMap.beats.find((b) => b.beat === at.beat);
    if (!entry) {
      errors.push(`Cue ${index}: beat ${at.beat} not found in beat map`);
      return undefined;
    }
    return entry.t;
  }

  if (at.bar !== undefined) {
    // Assume 4 beats per bar (standard 4/4)
    const beatNum = (at.bar - 1) * 4 + 1;
    const entry = beatMap.beats.find((b) => b.beat === beatNum);
    if (!entry) {
      errors.push(`Cue ${index}: bar ${at.bar} (beat ${beatNum}) not found in beat map`);
      return undefined;
    }
    return entry.t;
  }

  if (at.section !== undefined) {
    const section = beatMap.sections.find((s) => s.name === at.section);
    if (!section) {
      errors.push(`Cue ${index}: section "${at.section}" not found in beat map`);
      return undefined;
    }
    return section.startT;
  }

  errors.push(`Cue ${index}: no timing specified (need t, beat, bar, or section)`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Playback engine
// ---------------------------------------------------------------------------

export interface PlaybackCallbacks {
  /** Get current desktop state for scene planning. */
  getState: () => import("../core/types.js").DesktopState;
  /** Get desktop bounds for layout resolution. */
  getBounds: () => DesktopBounds;
  /** Execute a planned scene operation. */
  executeOp: (op: SceneOp) => Promise<void>;
  /** Called when playback starts. */
  onStart?: () => void;
  /** Called when a cue fires. */
  onCue?: (cue: ResolvedCue, index: number) => void;
  /** Called when playback ends. */
  onEnd?: () => void;
  /** Called on error. */
  onError?: (error: string) => void;
}

export interface PlaybackHandle {
  /** Stop playback and kill audio. */
  stop: () => void;
  /** Whether playback is currently running. */
  readonly running: boolean;
  /** Elapsed time in ms since playback started. */
  readonly elapsedMs: () => number;
}

/**
 * Run a resolved timeline.
 * Starts audio playback and fires cues at their scheduled times.
 * Returns a handle to stop playback.
 */
export function runTimeline(
  timeline: ResolvedTimeline,
  callbacks: PlaybackCallbacks,
): PlaybackHandle {
  let running = true;
  let audioProc: ChildProcess | null = null;
  let nextCueIndex = 0;
  let startTime = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const handle: PlaybackHandle = {
    stop() {
      if (!running) return;
      running = false;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      if (audioProc) {
        try { audioProc.kill(); } catch {}
        audioProc = null;
      }
      callbacks.onEnd?.();
    },
    get running() { return running; },
    elapsedMs: () => running ? Date.now() - startTime : 0,
  };

  // Resolve track path — skip audio if noAudio flag set or track absent
  const trackPath = timeline.file.track;
  if (!timeline.file.noAudio) {
    if (!trackPath || !fs.existsSync(trackPath)) {
      callbacks.onError?.(`Track not found: ${trackPath}`);
      running = false;
      return handle;
    }

    // Start audio
    try {
      audioProc = spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", trackPath], { stdio: "ignore" });
    } catch (e) {
      callbacks.onError?.(`Failed to start audio: ${e}`);
      running = false;
      return handle;
    }
  }

  startTime = Date.now();
  callbacks.onStart?.();

  // Schedule all cues as absolute timeouts from start
  for (let i = 0; i < timeline.cues.length; i++) {
    const rc = timeline.cues[i];
    const delayMs = rc.t * 1000;

    const timer = setTimeout(async () => {
      if (!running) return;
      callbacks.onCue?.(rc, i);
      await executeCue(rc, timeline, callbacks);
    }, delayMs);

    timers.push(timer);
  }

  // Schedule end
  const endTimer = setTimeout(() => {
    handle.stop();
  }, timeline.durationMs + 1000); // 1s grace
  timers.push(endTimer);

  return handle;
}

// ---------------------------------------------------------------------------
// Cue execution
// ---------------------------------------------------------------------------

async function executeCue(
  rc: ResolvedCue,
  timeline: ResolvedTimeline,
  callbacks: PlaybackCallbacks,
): Promise<void> {
  const cue = rc.cue;

  if ("scene" in cue) {
    const scene = timeline.file.scenes[cue.scene];
    if (!scene) return;
    const state = callbacks.getState();
    const bounds = callbacks.getBounds();
    const ops = planSceneTransition(state, scene, bounds, {
      protect: timeline.file.options?.protect ?? ["agent"],
    });
    for (const op of ops) {
      await callbacks.executeOp(op);
    }
  } else if ("patch" in cue) {
    await executePatch(cue.patch, callbacks);
  } else if ("command" in cue) {
    await callbacks.executeOp({
      type: "command",
      id: cue.command.id,
      args: cue.command.args,
    });
  }
}

async function executePatch(
  patch: CuePatch,
  callbacks: PlaybackCallbacks,
): Promise<void> {
  // Theme first
  if (patch.theme) {
    await callbacks.executeOp({ type: "theme", name: patch.theme });
  }

  // Close roles
  if (patch.close) {
    const state = callbacks.getState();
    for (const role of patch.close) {
      // Find window by role match — simplified: close by title/appType heuristic
      // In full implementation, maintain a role→windowId map during playback
      // For now, this is a placeholder
    }
  }

  // Set (open/reposition) windows
  if (patch.set) {
    const bounds = callbacks.getBounds();
    for (const sceneWin of patch.set) {
      const rect = resolveLayout(sceneWin.layout, bounds);
      await callbacks.executeOp({
        type: "open",
        role: sceneWin.role,
        window: sceneWin,
        rect,
      });
    }
  }
}
