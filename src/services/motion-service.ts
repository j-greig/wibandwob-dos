// Easing function signature
export type EasingFn = (t: number) => number; // t in [0,1] → value in [0,1]

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

// Named easings ported from vendor/textual/src/textual/_easing.py
export const EASINGS: Record<string, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) ** 2,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  elasticOut: (t) => {
    if (t <= 0 || t >= 1) return t;
    const c = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
  bounceOut: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) {
      return n * t * t;
    }
    if (t < 2 / d) {
      const x = t - 1.5 / d;
      return n * x * x + 0.75;
    }
    if (t < 2.5 / d) {
      const x = t - 2.25 / d;
      return n * x * x + 0.9375;
    }
    const x = t - 2.625 / d;
    return n * x * x + 0.984375;
  },
};

// Core tween — animates a numeric value over time
export interface TweenOpts {
  from: number;
  to: number;
  duration: number; // ms
  easing?: EasingFn | string; // EasingFn or key in EASINGS, default "easeOutCubic"
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

function resolveEasing(easing?: EasingFn | string): EasingFn {
  if (typeof easing === "function") {
    return easing;
  }
  if (typeof easing === "string" && EASINGS[easing]) {
    return EASINGS[easing];
  }
  return EASINGS.easeOutCubic;
}

export function tween(opts: TweenOpts): { cancel: () => void } {
  const from = Number.isFinite(opts.from) ? opts.from : 0;
  const to = Number.isFinite(opts.to) ? opts.to : 0;
  const duration = Math.max(0, opts.duration);
  const easing = resolveEasing(opts.easing);

  let done = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const finish = () => {
    if (done) return;
    done = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const cancel = () => {
    finish();
  };

  if (duration === 0) {
    opts.onUpdate(to);
    opts.onComplete?.();
    return { cancel };
  }

  const start = Date.now();
  const delta = to - from;

  opts.onUpdate(from);

  interval = setInterval(() => {
    const elapsed = Date.now() - start;
    const t = clamp01(elapsed / duration);
    const eased = clamp01(easing(t));
    opts.onUpdate(from + delta * eased);

    if (t >= 1) {
      finish();
      opts.onComplete?.();
    }
  }, 16);

  return { cancel };
}

type WindowFrame = { left: number; top: number; width: number; height: number };

function readWindowFrame(windowManager: unknown, id: number): WindowFrame | undefined {
  const manager = windowManager as {
    getWindowById?: (windowId: number) => {
      frame?: { left?: unknown; top?: unknown; width?: unknown; height?: unknown };
    } | undefined;
  };

  const frame = manager.getWindowById?.(id)?.frame;
  if (!frame) {
    return undefined;
  }

  const left = Number(frame.left);
  const top = Number(frame.top);
  const width = Number(frame.width);
  const height = Number(frame.height);

  if (![left, top, width, height].every((v) => Number.isFinite(v))) {
    return undefined;
  }

  return { left, top, width, height };
}

// Convenience: animate a window's position
export function tweenWindowPosition(
  windowManager: { moveWindow(id: number, x: number, y: number): boolean },
  id: number,
  targetX: number,
  targetY: number,
  duration = 220,
  easing: EasingFn | string = "easeOutCubic",
): { cancel: () => void } {
  const frame = readWindowFrame(windowManager, id);
  if (!frame) {
    return { cancel: () => {} };
  }

  return tween({
    from: 0,
    to: 1,
    duration,
    easing,
    onUpdate: (progress) => {
      const x = Math.round(lerp(frame.left, targetX, progress));
      const y = Math.round(lerp(frame.top, targetY, progress));
      windowManager.moveWindow(id, x, y);
    },
    onComplete: () => {
      windowManager.moveWindow(id, Math.round(targetX), Math.round(targetY));
    },
  });
}

// Convenience: animate a window's size
export function tweenWindowSize(
  windowManager: { resizeWindow(id: number, w: number, h: number): boolean },
  id: number,
  targetW: number,
  targetH: number,
  duration = 220,
  easing: EasingFn | string = "easeOutCubic",
): { cancel: () => void } {
  const frame = readWindowFrame(windowManager, id);
  if (!frame) {
    return { cancel: () => {} };
  }

  return tween({
    from: 0,
    to: 1,
    duration,
    easing,
    onUpdate: (progress) => {
      const w = Math.max(1, Math.round(lerp(frame.width, targetW, progress)));
      const h = Math.max(1, Math.round(lerp(frame.height, targetH, progress)));
      windowManager.resizeWindow(id, w, h);
    },
    onComplete: () => {
      windowManager.resizeWindow(id, Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)));
    },
  });
}
