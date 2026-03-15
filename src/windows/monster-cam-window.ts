/**
 * Monster Cam window — live ASCII webcam view with overlay detection.
 * b = toggle ASCII background (off by default, saves CPU)
 * m = toggle monster face sprites
 * q/Esc = close
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { createRestyleBundle } from "../core/ui-parts.js";
import { MonsterCamService } from "../services/monster-cam-service.js";
import { renderWebcamFrame, gridToBlessedContent } from "../services/webcam-renderer.js";
import type { WindowManager } from "../core/window-manager.js";
import {
  createMonsterCamModel,
  updateMonsterCamModel,
  type MonsterCamModel,
  type MonsterCamMsg,
} from "./monster-cam-model.js";

interface Deps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  onStateChanged?: () => void;
}

export function openMonsterCamWindow(deps: Deps): void {
  const { screen, windowManager } = deps;

  const frame = windowManager.createFrame("Monster Cam", "microapp");

  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 1,
    style: theme().body,
    tags: true,   // enables {color-fg} tags
  });
  const emotionOverlay = blessed.box({
    parent: canvas,
    top: 0,
    left: 0,
    width: 60,
    height: 7,
    style: { fg: "magenta", bg: "black" },
    tags: false,
  });

  // Bottom bar
  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: theme().header,
  });

  const mkBtn = (label: string, right: number, width: number, onClick: () => void) => {
    const btn = blessed.box({
      parent: statusBar,
      top: 0, right, width, height: 1,
      mouse: true, clickable: true,
      content: label,
      style: { ...theme().header, hover: theme().selected },
      tags: false,
    });
    btn.on("click", onClick);
    return btn;
  };

  mkBtn(" [Q] Close ", 0,  11, () => windowManager.closeWindow(frame.id));
  const bgBtn = mkBtn(" [B] BG off", 11, 11, () => toggleBg());
  const monsterBtn = mkBtn(" [M] Monster", 22, 11, () => toggleMonster());

  const status = blessed.box({
    parent: statusBar,
    top: 0, left: 0, right: 33, height: 1,
    style: theme().header,
    content: " Starting...",
    tags: false,
  });

  // Local model/update/render loop for E033 S02.
  // Service events and UI toggles become MonsterCamMsg values, updateMonsterCamModel
  // owns state transitions, and renderModel is the single widget mutation path.
  let model = createMonsterCamModel();

  const renderModel = (nextModel: MonsterCamModel) => {
    bgBtn.setContent(nextModel.showBg ? " [B] BG on " : " [B] BG off");
    monsterBtn.setContent(nextModel.monsterMode ? " [M] Monster*" : " [M] Monster");
    emotionOverlay.setContent(nextModel.emotionOverlayText);

    if (nextModel.latestFrame) {
      const w = Math.max(1, Number(canvas.width));
      const h = Math.max(1, Number(canvas.height));
      const grid = renderWebcamFrame(nextModel.latestFrame, w, h, {
        showBg: nextModel.showBg,
        monsterMode: nextModel.monsterMode,
      });
      canvas.setContent(gridToBlessedContent(grid));
      const detections = [
        nextModel.hasFace ? "FACE" : "·",
        nextModel.hasHands ? `HANDS(${nextModel.handCount})` : "·",
        nextModel.hasPose ? "POSE" : "·",
        nextModel.monsterMode ? "MONSTER" : "·",
      ].join(" ");
      status.setContent(
        ` ${detections} | ${nextModel.fps}fps | b=${nextModel.showBg ? "bg ON" : "bg off"} m=${nextModel.monsterMode ? "monster ON" : "monster off"} q=close`
      );
    } else {
      status.setContent(nextModel.statusText);
      canvas.setContent("");
    }

    deps.onStateChanged?.();
    screen.render();
  };

  const dispatch = (msg: MonsterCamMsg) => {
    model = updateMonsterCamModel(model, msg);
    renderModel(model);
  };

  const toggleBg = () => dispatch({ type: "toggle-bg" });
  const toggleMonster = () => dispatch({ type: "toggle-monster" });

  const svc = new MonsterCamService();

  svc.on("ready", () => dispatch({ type: "ready" }));
  svc.on("error", (err) => dispatch({ type: "error", error: err }));
  svc.on("frame", (frameData) => dispatch({ type: "frame", frame: frameData }));

  svc.start();

  frame.describeState = () => ({
    appType: "monster-cam",
    summary: `Monster Cam — face:${model.hasFace} hands:${model.handCount} pose:${model.hasPose} @ ${model.fps}fps`,
    hasFace: model.hasFace,
    hasHands: model.hasHands,
    handCount: model.handCount,
    hasPose: model.hasPose,
    fps: model.fps,
    bbox: model.lastBbox,
    showBg: model.showBg,
    monsterMode: model.monsterMode,
    phase: model.phase,
    emotion: model.currentEmotion,
  });

  frame.cleanup = () => svc.stop();

  frame.onRestyle = createRestyleBundle([
    [canvas, () => theme().body],
    [status, () => theme().header],
  ]).restyle;

  for (const el of [canvas, frame.body]) {
    el.key(["b"], () => toggleBg());
    el.key(["m"], () => toggleMonster());
    el.key(["q", "escape"], () => windowManager.closeWindow(frame.id));
  }
  canvas.focus();

  frame.setFocusTarget(canvas);

  windowManager.registerWindow(frame);
  frame.focus();
}
