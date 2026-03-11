import { describe, expect, test } from "bun:test";

import { createRenderMonitor, formatRenderReading } from "../core/render-monitor.js";

describe("render monitor", () => {
  test("tracks render count and exposes snapshots", async () => {
    const screen = { render() {} };
    const monitor = createRenderMonitor(screen);

    screen.render();
    await new Promise((resolve) => setTimeout(resolve, 15));
    screen.render();
    await new Promise((resolve) => setTimeout(resolve, 15));
    screen.render();

    const reading = monitor.read();
    expect(reading.totalFrames).toBe(3);
    expect(reading.fps).toBeGreaterThan(0);
    expect(reading.avgFrameMs).toBeGreaterThan(0);

    monitor.destroy();
  });

  test("formats readings for smoke logs", () => {
    expect(formatRenderReading({ fps: 12, avgFrameMs: 83.333, totalFrames: 144 }))
      .toBe("fps=12 avg=83.3ms total=144");
    expect(formatRenderReading({ fps: 0, avgFrameMs: 0, totalFrames: 0 }))
      .toBe("fps=0 avg=n/a total=0");
  });
});
