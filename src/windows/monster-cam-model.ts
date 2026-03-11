import { renderFiglet } from "../services/figlet-service.js";
import type { MonsterCamFrame } from "../services/monster-cam-service.js";

export type MonsterCamPhase = "starting" | "ready" | "error";

export interface MonsterCamModel {
  phase: MonsterCamPhase;
  statusText: string;
  hasFace: boolean;
  hasHands: boolean;
  handCount: number;
  hasPose: boolean;
  fps: number;
  currentEmotion: string;
  emotionOverlayText: string;
  lastBbox: [number, number, number, number];
  showBg: boolean;
  monsterMode: boolean;
  latestFrame?: MonsterCamFrame;
}

export type MonsterCamMsg =
  | { type: "ready" }
  | { type: "error"; error: Error }
  | { type: "frame"; frame: MonsterCamFrame }
  | { type: "toggle-bg" }
  | { type: "toggle-monster" };

export function createMonsterCamModel(): MonsterCamModel {
  return {
    phase: "starting",
    statusText: " Starting...",
    hasFace: false,
    hasHands: false,
    handCount: 0,
    hasPose: false,
    fps: 0,
    currentEmotion: "",
    emotionOverlayText: "",
    lastBbox: [0, 0, 0, 0],
    showBg: false,
    monsterMode: false,
  };
}

export function updateMonsterCamModel(
  model: MonsterCamModel,
  msg: MonsterCamMsg,
): MonsterCamModel {
  switch (msg.type) {
    case "ready":
      return {
        ...model,
        phase: "ready",
        statusText: " Ready  b=bg m=monster q=close",
      };

    case "error":
      return {
        ...model,
        phase: "error",
        statusText: ` Error: ${msg.error.message}`,
      };

    case "toggle-bg":
      return {
        ...model,
        showBg: !model.showBg,
      };

    case "toggle-monster":
      return {
        ...model,
        monsterMode: !model.monsterMode,
      };

    case "frame": {
      const { frame } = msg;
      const emotionChanged = frame.emotion !== model.currentEmotion;
      return {
        ...model,
        phase: "ready",
        latestFrame: frame,
        hasFace: frame.hasFace,
        hasHands: frame.hasHands,
        handCount: frame.handCount,
        hasPose: frame.hasPose,
        fps: frame.fps,
        lastBbox: frame.hasFace ? frame.bbox : model.lastBbox,
        currentEmotion: frame.emotion,
        emotionOverlayText: emotionChanged
          ? renderFiglet(frame.emotion.toUpperCase(), "small")
          : model.emotionOverlayText,
      };
    }
  }
}
