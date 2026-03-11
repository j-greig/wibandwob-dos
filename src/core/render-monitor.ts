/**
 * RenderMonitor — measures blessed screen render throughput.
 *
 * Wraps screen.render() to record frame timestamps, then derives FPS
 * and average frame time over a rolling window.
 *
 * Usage:
 *   const monitor = createRenderMonitor(screen);
 *   monitor.fps          // current frames per second
 *   monitor.avgFrameMs   // average ms between renders
 *   monitor.totalFrames  // lifetime frame count
 *   monitor.subscribe(fn, intervalMs)  // live updates
 *   monitor.destroy()    // restore original screen.render
 *
 * @primitive
 */

export interface RenderMonitorHandle {
  /** Frames rendered in the last 1000ms. */
  readonly fps: number;
  /** Average milliseconds between renders (last window). 0 if no frames yet. */
  readonly avgFrameMs: number;
  /** Total frames rendered since monitor was created. */
  readonly totalFrames: number;
  /** Current snapshot reading. */
  read(): RenderReading;
  /**
   * Subscribe to periodic readings. fn is called every intervalMs (default 1000).
   * Returns unsubscribe function.
   */
  subscribe(fn: (reading: RenderReading) => void, intervalMs?: number): () => void;
  /** Restore original screen.render and stop monitoring. */
  destroy(): void;
}

export interface RenderReading {
  fps: number;
  avgFrameMs: number;
  totalFrames: number;
}

export function formatRenderReading(reading: RenderReading): string {
  const avg = reading.avgFrameMs > 0 ? `${reading.avgFrameMs.toFixed(1)}ms` : "n/a";
  return `fps=${reading.fps} avg=${avg} total=${reading.totalFrames}`;
}

/** Rolling window size in milliseconds for FPS calculation. */
const FPS_WINDOW_MS = 1000;
/** Maximum timestamps to retain in the rolling buffer. */
const MAX_BUFFER = 256;

export function createRenderMonitor(
  screen: { render: () => void },
): RenderMonitorHandle {
  const originalRender = screen.render.bind(screen);
  const timestamps: number[] = [];
  let totalFrames = 0;
  const subscribers = new Map<number, { fn: (r: RenderReading) => void; timer: ReturnType<typeof setInterval> }>();
  let nextSubId = 0;
  let destroyed = false;

  // Wrap render
  screen.render = () => {
    if (!destroyed) {
      const now = Date.now();
      timestamps.push(now);
      // Evict entries older than window + trim buffer size
      const cutoff = now - FPS_WINDOW_MS;
      let i = 0;
      while (i < timestamps.length && timestamps[i]! < cutoff) i++;
      if (i > 0) timestamps.splice(0, i);
      if (timestamps.length > MAX_BUFFER) timestamps.splice(0, timestamps.length - MAX_BUFFER);
      totalFrames++;
    }
    originalRender();
  };

  function currentFps(): number {
    const now = Date.now();
    const cutoff = now - FPS_WINDOW_MS;
    let count = 0;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i]! >= cutoff) count++;
      else break;
    }
    return count;
  }

  function currentAvgFrameMs(): number {
    if (timestamps.length < 2) return 0;
    const recent = timestamps.slice(-Math.min(timestamps.length, 30));
    let sum = 0;
    for (let i = 1; i < recent.length; i++) sum += recent[i]! - recent[i - 1]!;
    return sum / (recent.length - 1);
  }

  function reading(): RenderReading {
    return { fps: currentFps(), avgFrameMs: currentAvgFrameMs(), totalFrames };
  }

  return {
    get fps() { return currentFps(); },
    get avgFrameMs() { return currentAvgFrameMs(); },
    get totalFrames() { return totalFrames; },
    read() { return reading(); },

    subscribe(fn, intervalMs = 1000) {
      const id = nextSubId++;
      const timer = setInterval(() => fn(reading()), intervalMs);
      subscribers.set(id, { fn, timer });
      return () => {
        const sub = subscribers.get(id);
        if (sub) { clearInterval(sub.timer); subscribers.delete(id); }
      };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      screen.render = originalRender;
      for (const { timer } of subscribers.values()) clearInterval(timer);
      subscribers.clear();
      timestamps.length = 0;
    },
  };
}
