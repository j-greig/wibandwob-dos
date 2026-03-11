import blessed from "blessed";

import { createRenderMonitor, type RenderMonitorHandle, type RenderReading } from "./render-monitor.js";
import { theme } from "./theme/resolver.js";

export interface RuntimeStatsSnapshot {
  render: RenderReading;
  rssMb: number;
  heapUsedMb: number;
  agent: {
    active: boolean;
    streaming: boolean;
    messageCount: number;
    toolRunCount: number;
    status?: string;
  };
}

interface RuntimeStatsDeps {
  screen: blessed.Widgets.Screen;
  menuBar: blessed.Widgets.BoxElement;
  enabled: boolean;
  getAgentSnapshot: () => {
    streaming?: boolean;
    messageCount?: number;
    toolRuns?: Array<unknown>;
    status?: string;
  } | undefined;
}

export class RuntimeStatsController {
  private readonly monitor: RenderMonitorHandle;
  private badge?: blessed.Widgets.BoxElement;
  private unsubscribe?: () => void;

  constructor(private readonly deps: RuntimeStatsDeps) {
    this.monitor = createRenderMonitor(deps.screen);
  }

  init(): void {
    if (!this.deps.enabled) {
      return;
    }
    this.badge = blessed.box({
      parent: this.deps.menuBar,
      top: 0,
      left: 52,
      height: 1,
      width: 1,
      tags: false,
      style: theme().menuBar,
      content: "",
    });
    this.render(this.snapshot());
    this.unsubscribe = this.monitor.subscribe((reading) => {
      this.render(this.snapshot(reading));
      this.deps.screen.render();
    }, 1000);
  }

  snapshot(render = this.monitorSnapshot()): RuntimeStatsSnapshot {
    const mem = process.memoryUsage();
    const agent = this.deps.getAgentSnapshot();
    return {
      render,
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      agent: {
        active: Boolean(agent),
        streaming: Boolean(agent?.streaming),
        messageCount: agent?.messageCount ?? 0,
        toolRunCount: agent?.toolRuns?.length ?? 0,
        status: agent?.status,
      },
    };
  }

  applyTheme(): void {
    if (this.badge) {
      this.badge.style = theme().menuBar;
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.badge?.destroy();
    this.badge = undefined;
    this.monitor.destroy();
  }

  private monitorSnapshot(): RenderReading {
    return {
      fps: this.monitor.fps,
      avgFrameMs: this.monitor.avgFrameMs,
      totalFrames: this.monitor.totalFrames,
    };
  }

  private render(snapshot: RuntimeStatsSnapshot): void {
    if (!this.badge) {
      return;
    }
    const agent = snapshot.agent.active
      ? snapshot.agent.streaming
        ? `AG stream ${snapshot.agent.messageCount}m`
        : `AG ${snapshot.agent.messageCount}m/${snapshot.agent.toolRunCount}t`
      : "AG off";
    const text = ` ${snapshot.render.fps}fps ${snapshot.render.avgFrameMs.toFixed(0)}ms ${snapshot.rssMb}M ${agent} `;
    this.badge.width = text.length;
    this.badge.setContent(text);
  }
}
