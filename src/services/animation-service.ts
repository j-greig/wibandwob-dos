/**
 * Animation Service — reusable frame playback engine.
 *
 * Supports two sources:
 *   1. Pre-rendered frames (string[][] from content-measurement.ts)
 *   2. Live generators (function that produces a frame each tick)
 *
 * Owns timing, play/pause/stop, current frame index, and cleanup.
 * Windows wire this to their render callback — the service never
 * touches blessed directly.
 */

/** A live generator produces a frame string given tick count and viewport size. */
export type LiveFrameGenerator = (tick: number, width: number, height: number) => string;

export interface FramePlayerOptions {
  fps: number;
  loop?: boolean;          // default true
  onFrame: (content: string, index: number, total: number) => void;
}

export interface PreRenderedPlayerOptions extends FramePlayerOptions {
  frames: string[][];
}

export interface LivePlayerOptions extends FramePlayerOptions {
  generator: LiveFrameGenerator;
  getViewport: () => { width: number; height: number };
}

export interface FramePlayer {
  /** Start or resume playback. */
  play(): void;
  /** Pause playback (keeps position). */
  pause(): void;
  /** Toggle play/pause. Returns new paused state. */
  togglePause(): boolean;
  /** Stop and reset to frame 0. */
  stop(): void;
  /** Clean up timer. MUST be called on window close. */
  destroy(): void;
  /** Current state. */
  readonly paused: boolean;
  readonly currentFrame: number;
  readonly totalFrames: number;
  readonly fps: number;
}

/**
 * Create a player for pre-rendered frames (e.g. animated primers).
 * Frames are cycled at the given FPS. onFrame is called with the
 * joined frame text, current index, and total count.
 */
export function createPreRenderedPlayer(options: PreRenderedPlayerOptions): FramePlayer {
  const { frames, fps, onFrame } = options;
  const loop = options.loop !== false;
  let index = 0;
  let paused = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (paused) return;
    index = loop ? (index + 1) % frames.length : Math.min(index + 1, frames.length - 1);
    onFrame(frames[index].join("\n"), index, frames.length);
  };

  const play = () => {
    paused = false;
    if (!timer) {
      timer = setInterval(tick, 1000 / fps);
    }
  };

  const pause = () => { paused = true; };

  const stop = () => {
    paused = false;
    index = 0;
    if (timer) { clearInterval(timer); timer = null; }
    onFrame(frames[0].join("\n"), 0, frames.length);
  };

  const destroy = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };

  // Emit initial frame
  onFrame(frames[0].join("\n"), 0, frames.length);

  return {
    play, pause, stop, destroy,
    togglePause() { paused = !paused; return paused; },
    get paused() { return paused; },
    get currentFrame() { return index; },
    get totalFrames() { return frames.length; },
    get fps() { return fps; },
  };
}

/**
 * Create a player for live-generated frames (e.g. pattern field, generative art).
 * The generator is called every tick with the current tick count and viewport size.
 */
export function createLivePlayer(options: LivePlayerOptions): FramePlayer {
  const { generator, getViewport, fps, onFrame } = options;
  let tick = 0;
  let paused = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const advance = () => {
    if (paused) return;
    const { width, height } = getViewport();
    const content = generator(tick, width, height);
    onFrame(content, tick, -1); // -1 total = infinite/live
    tick += 1;
  };

  const play = () => {
    paused = false;
    if (!timer) {
      timer = setInterval(advance, 1000 / fps);
    }
  };

  const pause = () => { paused = true; };

  const stop = () => {
    paused = false;
    tick = 0;
    if (timer) { clearInterval(timer); timer = null; }
  };

  const destroy = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };

  // Emit initial frame
  const { width, height } = getViewport();
  onFrame(generator(tick, width, height), 0, -1);
  tick += 1;

  return {
    play, pause, stop, destroy,
    togglePause() { paused = !paused; return paused; },
    get paused() { return paused; },
    get currentFrame() { return tick; },
    get totalFrames() { return -1; },
    get fps() { return fps; },
  };
}
