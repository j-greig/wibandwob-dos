import type blessed from "blessed";

export interface AnimationClock {
  readonly tick: number;
  subscribe(handler: (tick: number) => void): () => void;
  play(): void;
  pause(): void;
  destroy(): void;
}

export function createAnimationClock(fps: number): AnimationClock {
  let tick = 0;
  let running = true;
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
