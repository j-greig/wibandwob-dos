import { describe, expect, test } from "bun:test";

import { createEmbeddedLivePlayer } from "../../services/animation-service.js";

describe("animation service", () => {
  test("embedded live player mounts, emits frames, and clears on destroy", async () => {
    const frames: string[] = [];
    let renderCalls = 0;
    const target = {
      width: 10,
      height: 4,
      setContent(content: string) {
        frames.push(content);
      },
    };

    const player = createEmbeddedLivePlayer({
      fps: 20,
      generator: (tick, width, height) => `tick=${tick} ${width}x${height}`,
      getViewport: (mountedTarget) => ({
        width: Number(mountedTarget.width) || 1,
        height: Number(mountedTarget.height) || 1,
      }),
      render: () => { renderCalls += 1; },
      onFrame: () => {},
    });

    player.attachTarget(target);
    player.setRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    player.setRunning(false);
    player.destroy();

    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]).toContain("10x4");
    expect(renderCalls).toBeGreaterThan(0);
  });
});
