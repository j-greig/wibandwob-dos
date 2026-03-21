/**
 * runtime-helpers.ts — Runtime utilities for microapp authors.
 *
 * Exports: createAnimationClock, createLayoutReporter, registerMicroappHooks.
 * Import via microapp-sdk.js, not directly.
 */
import type blessed from "blessed";

export interface AnimationClock {
  readonly tick: number;
  subscribe(handler: (tick: number) => void): () => void;
  play(): void;
  pause(): void;
  destroy(): void;
}

export interface AnimationClockOptions {
  /** Start the clock immediately. Default: false (starts paused). */
  autoplay?: boolean;
}

/**
 * Create an interval-based animation clock.
 *
 * **Starts paused by default.** Call `clock.play()` after setup to begin animation.
 * This prevents CPU saturation during window construction before rendering is ready.
 *
 * @param fps - Frames per second. Recommended ≤ 10fps.
 * @param opts - Options. Use `{ autoplay: true }` to start immediately (legacy behaviour).
 *
 * @warn fps > 10 risks saturating the blessed render loop and making the HTTP API
 *   unresponsive. Recommended maximum: 8–10fps. At 30fps with grid-canvas output
 *   the event loop saturates and the control API stops responding.
 * @warn Always call `clock.destroy()` in your `onCleanup` hook to prevent zombie
 *   intervals after the window is closed.
 */
export function createAnimationClock(fps: number, opts: AnimationClockOptions = {}): AnimationClock {
  if (fps > 10) {
    // eslint-disable-next-line no-console
    console.warn(`[microapp-sdk] createAnimationClock: fps=${fps} risks saturating blessed render (recommended ≤10fps). High fps + grid-canvas = CPU cliff.`);
  }
  let tick = 0;
  let running = opts.autoplay ?? false; // default: paused
  const handlers = new Set<(tick: number) => void>();
  const interval = setInterval(() => {
    if (!running) return;
    tick++;
    for (const handler of handlers) handler(tick);
  }, Math.round(1000 / fps));
  return {
    get tick() { return tick; },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    play() { running = true; },
    pause() { running = false; },
    destroy() { clearInterval(interval); handlers.clear(); },
  };
}

export type LayoutRegionRect = { top: number; left: number; width: number; height: number };

export interface LayoutRegionSnapshot {
  visible: boolean;
  attached: boolean;
  collapsed: boolean;
  rect: LayoutRegionRect;
}

export interface LayoutReport {
  schema: "wibwob.layout-report/v1";
  viewport: { width: number; height: number };
  regions: Record<string, LayoutRegionSnapshot>;
}

export interface LayoutReporter {
  snapshot(viewport: { width: number; height: number }): LayoutReport;
}

export function createLayoutReporter(regions: Record<string, blessed.Widgets.BoxElement>): LayoutReporter {
  const rectOf = (node: blessed.Widgets.BoxElement): LayoutRegionRect => {
    if (!node.parent) return { top: 0, left: 0, width: 0, height: 0 };
    return {
      top: Number(node.top) || 0,
      left: Number(node.left) || 0,
      width: Number(node.width) || 0,
      height: Number(node.height) || 0,
    };
  };

  return {
    snapshot(viewport) {
      const out: Record<string, LayoutRegionSnapshot> = {};
      for (const [name, node] of Object.entries(regions)) {
        const rect = rectOf(node);
        const attached = !!node.parent;
        out[name] = {
          visible: !!node.visible,
          attached,
          collapsed: !attached || (!node.visible && rect.width === 0 && rect.height === 0),
          rect,
        };
      }
      return {
        schema: "wibwob.layout-report/v1",
        viewport,
        regions: out,
      };
    },
  };
}

// ── registerMicroappHooks ────────────────────────────────────────────────────

/**
 * Register all four required microapp hooks in one call.
 *
 * This is the preferred pattern for new microapps — TypeScript will enforce
 * that all four hooks are provided. Missing any one is the most common cause
 * of broken state inspection, zombie timers, and theme-switch glitches.
 *
 * @example
 * ```typescript
 * registerMicroappHooks(win, {
 *   captureText:   () => myContent,
 *   describeState: () => ({ summary: "My App — 3 items" }),
 *   onCleanup:     () => { clock.destroy(); },
 *   onRestyle:     () => { label.style.fg = host.theme().text; },
 * });
 * ```
 *
 * Individual hook methods (`win.captureText(...)` etc.) remain available
 * for cases where hooks need to be registered conditionally or at different
 * points in the lifecycle.
 */
export function registerMicroappHooks(
  win: {
    captureText(fn: () => string): void;
    describeState(fn: () => { summary?: string; [key: string]: unknown }): void;
    onCleanup(fn: () => void): void;
    onRestyle(fn: () => void): void;
  },
  hooks: {
    /** Return the readable text content of the window. Must return >0 chars for validation to pass. */
    captureText: () => string;
    /** Return a summary of current state for agent inspection via /state API. */
    describeState: () => { summary?: string; [key: string]: unknown };
    /** Called when the window is closed. Stop all timers, destroy all handles. */
    onCleanup: () => void;
    /** Called when the theme changes. Re-apply host.theme() colours to your widgets. */
    onRestyle: () => void;
  },
): void {
  win.captureText(hooks.captureText);
  win.describeState(hooks.describeState);
  win.onCleanup(hooks.onCleanup);
  win.onRestyle(hooks.onRestyle);
}
