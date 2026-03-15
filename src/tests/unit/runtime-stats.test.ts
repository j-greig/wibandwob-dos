import { describe, expect, test } from "bun:test";

import { RuntimeStatsController } from "../../core/runtime-stats.js";

describe("runtime stats controller", () => {
  test("snapshot reports render, memory, and agent signals", () => {
    let renderCalls = 0;
    const screen = { render: () => { renderCalls += 1; } } as any;
    const menuBar = {
      append: () => {},
    } as any;

    const stats = new RuntimeStatsController({
      screen,
      menuBar,
      enabled: false,
      getAgentSnapshot: () => ({
        streaming: true,
        messageCount: 7,
        toolRuns: [{}, {}],
        status: "Streaming",
      }),
    });

    screen.render();
    screen.render();
    const snapshot = stats.snapshot({ fps: 2, avgFrameMs: 50, totalFrames: 2 });

    expect(renderCalls).toBe(2);
    expect(snapshot.render.fps).toBe(2);
    expect(snapshot.render.avgFrameMs).toBe(50);
    expect(snapshot.render.totalFrames).toBe(2);
    expect(snapshot.rssMb).toBeGreaterThan(0);
    expect(snapshot.heapUsedMb).toBeGreaterThanOrEqual(0);
    expect(snapshot.agent.active).toBe(true);
    expect(snapshot.agent.streaming).toBe(true);
    expect(snapshot.agent.messageCount).toBe(7);
    expect(snapshot.agent.toolRunCount).toBe(2);
    stats.destroy();
  });
});
