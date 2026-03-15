import { describe, expect, test } from "bun:test";

import {
  createMonsterCamModel,
  updateMonsterCamModel,
} from "../../microapps/monster-cam/model.js";
import type { MonsterCamFrame } from "../../src/services/monster-cam-service.js";

function makeFrame(overrides: Partial<MonsterCamFrame> = {}): MonsterCamFrame {
  return {
    w: 2,
    h: 2,
    ts: 0,
    hasFace: true,
    bbox: [1, 2, 3, 4],
    faceKeypoints: [],
    hasHands: true,
    handCount: 2,
    handBoxes: [],
    handLabels: [],
    hasPose: true,
    poseLandmarks: [],
    emotion: "happy",
    fps: 12,
    gray: new Uint8Array([0, 1, 2, 3]),
    ...overrides,
  };
}

describe("monster cam model", () => {
  test("initial model starts in starting phase", () => {
    const model = createMonsterCamModel();
    expect(model.phase).toBe("starting");
    expect(model.showBg).toBe(false);
    expect(model.monsterMode).toBe(false);
    expect(model.statusText).toContain("Starting");
  });

  test("toggle messages update view flags", () => {
    let model = createMonsterCamModel();
    model = updateMonsterCamModel(model, { type: "toggle-bg" });
    model = updateMonsterCamModel(model, { type: "toggle-monster" });
    expect(model.showBg).toBe(true);
    expect(model.monsterMode).toBe(true);
  });

  test("ready and error messages update phase and status", () => {
    let model = createMonsterCamModel();
    model = updateMonsterCamModel(model, { type: "ready" });
    expect(model.phase).toBe("ready");
    expect(model.statusText).toContain("Ready");

    model = updateMonsterCamModel(model, {
      type: "error",
      error: new Error("camera missing"),
    });
    expect(model.phase).toBe("error");
    expect(model.statusText).toContain("camera missing");
  });

  test("frame message becomes the single visible state path", () => {
    const frame = makeFrame();
    const model = updateMonsterCamModel(createMonsterCamModel(), {
      type: "frame",
      frame,
    });

    expect(model.phase).toBe("ready");
    expect(model.latestFrame).toBe(frame);
    expect(model.hasFace).toBe(true);
    expect(model.handCount).toBe(2);
    expect(model.hasPose).toBe(true);
    expect(model.fps).toBe(12);
    expect(JSON.stringify(model.lastBbox)).toBe(JSON.stringify([1, 2, 3, 4]));
    expect(model.currentEmotion).toBe("happy");
    expect(model.emotionOverlayText.length).toBeGreaterThan(0);
  });

  test("last face bbox is preserved when later frames lose the face", () => {
    const withFace = updateMonsterCamModel(createMonsterCamModel(), {
      type: "frame",
      frame: makeFrame({ hasFace: true, bbox: [4, 5, 6, 7] }),
    });
    const withoutFace = updateMonsterCamModel(withFace, {
      type: "frame",
      frame: makeFrame({ hasFace: false, bbox: [0, 0, 0, 0] }),
    });

    expect(JSON.stringify(withoutFace.lastBbox)).toBe(JSON.stringify([4, 5, 6, 7]));
    expect(withoutFace.hasFace).toBe(false);
  });
});
