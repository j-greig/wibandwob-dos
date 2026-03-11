import { describe, expect, test } from "bun:test";

import { createRenderScheduler } from "../../src/core/render-scheduler.js";

describe("render scheduler", () => {
  test("batches repeated render requests into one flush", () => {
    const scheduled: Array<() => void> = [];
    let renderCount = 0;
    const scheduler = createRenderScheduler({
      sync: () => {},
      persist: () => {},
      render: () => {
        renderCount += 1;
      },
      scheduleFlush: (flush) => {
        scheduled.push(flush);
      },
    });

    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();

    expect(scheduled.length).toBe(1);
    scheduled[0]();
    expect(renderCount).toBe(1);
  });

  test("keeps sync and render as separate intents within one flush", () => {
    const scheduled: Array<() => void> = [];
    const calls: string[] = [];
    const scheduler = createRenderScheduler({
      sync: () => calls.push("sync"),
      persist: () => calls.push("persist"),
      render: () => calls.push("render"),
      scheduleFlush: (flush) => {
        scheduled.push(flush);
      },
    });

    scheduler.requestSync();
    scheduler.requestRender();

    expect(scheduled.length).toBe(1);
    scheduled[0]();
    expect(JSON.stringify(calls)).toBe(JSON.stringify(["sync", "render"]));
  });

  test("persist subsumes sync but still allows a render in the same flush", () => {
    const scheduled: Array<() => void> = [];
    const calls: string[] = [];
    const scheduler = createRenderScheduler({
      sync: () => calls.push("sync"),
      persist: () => calls.push("persist"),
      render: () => calls.push("render"),
      scheduleFlush: (flush) => {
        scheduled.push(flush);
      },
    });

    scheduler.requestSync();
    scheduler.requestPersist();
    scheduler.requestRender();

    expect(scheduled.length).toBe(1);
    scheduled[0]();
    expect(JSON.stringify(calls)).toBe(JSON.stringify(["persist", "render"]));
  });

  test("flushNow drains pending work immediately", () => {
    const calls: string[] = [];
    const scheduler = createRenderScheduler({
      sync: () => calls.push("sync"),
      persist: () => calls.push("persist"),
      render: () => calls.push("render"),
      scheduleFlush: () => {},
    });

    scheduler.requestSync();
    scheduler.requestRender();
    scheduler.flushNow();

    expect(JSON.stringify(calls)).toBe(JSON.stringify(["sync", "render"]));
    scheduler.flushNow();
    expect(JSON.stringify(calls)).toBe(JSON.stringify(["sync", "render"]));
  });
});
