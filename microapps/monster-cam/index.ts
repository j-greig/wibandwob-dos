/**
 * Monster Cam — live ASCII webcam with face/hand detection overlays.
 * b = toggle background, m = toggle monster sprites, q = close.
 */
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  MonsterCamService,
  renderWebcamFrame,
  gridToBlessedContent,
} from "../../src/services/microapp-sdk.js";
import blessed from "blessed";
import {
  createMonsterCamModel,
  updateMonsterCamModel,
  type MonsterCamModel,
  type MonsterCamMsg,
} from "./model.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Monster Cam",
    description: "Open the Monster Cam — live ASCII webcam with detection overlays.",
    action: () => {
      const win = host.createWindow({ title: "Monster Cam" });
      const theme = () => host.theme();
      const screen = host.screen;

      const canvas = blessed.box({
        parent: win.body,
        top: 0, left: 0, right: 0, bottom: 1,
        style: theme().body,
        tags: true,
      });

      const emotionOverlay = blessed.box({
        parent: canvas,
        top: 0, left: 0, width: 60, height: 7,
        style: { fg: "magenta", bg: "black" },
        tags: false,
      });

      const statusBar = blessed.box({
        parent: win.body,
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

      mkBtn(" [Q] Close ", 0, 11, () => win.close());
      const bgBtn = mkBtn(" [B] BG off", 11, 11, () => dispatch({ type: "toggle-bg" }));
      const monsterBtn = mkBtn(" [M] Monster", 22, 11, () => dispatch({ type: "toggle-monster" }));

      const status = blessed.box({
        parent: statusBar,
        top: 0, left: 0, right: 33, height: 1,
        style: theme().header,
        content: " Starting...",
        tags: false,
      });

      let model: MonsterCamModel = createMonsterCamModel();

      const renderModel = (m: MonsterCamModel) => {
        bgBtn.setContent(m.showBg ? " [B] BG on " : " [B] BG off");
        monsterBtn.setContent(m.monsterMode ? " [M] Monster*" : " [M] Monster");
        emotionOverlay.setContent(m.emotionOverlayText);

        if (m.latestFrame) {
          const w = Math.max(1, Number(canvas.width));
          const h = Math.max(1, Number(canvas.height));
          const grid = renderWebcamFrame(m.latestFrame, w, h, {
            showBg: m.showBg,
            monsterMode: m.monsterMode,
          });
          canvas.setContent(gridToBlessedContent(grid));
          const detections = [
            m.hasFace ? "FACE" : "·",
            m.hasHands ? `HANDS(${m.handCount})` : "·",
            m.hasPose ? "POSE" : "·",
            m.monsterMode ? "MONSTER" : "·",
          ].join(" ");
          status.setContent(
            ` ${detections} | ${m.fps}fps | b=${m.showBg ? "bg ON" : "bg off"} m=${m.monsterMode ? "monster ON" : "monster off"} q=close`
          );
        } else {
          status.setContent(m.statusText);
          canvas.setContent("");
        }
        screen.render();
      };

      const dispatch = (msg: MonsterCamMsg) => {
        model = updateMonsterCamModel(model, msg);
        renderModel(model);
      };

      const svc = new MonsterCamService();
      svc.on("ready", () => dispatch({ type: "ready" }));
      svc.on("error", (err) => dispatch({ type: "error", error: err }));
      svc.on("frame", (frameData) => dispatch({ type: "frame", frame: frameData }));
      svc.start();

      for (const el of [canvas, win.body]) {
        el.key(["b"], () => dispatch({ type: "toggle-bg" }));
        el.key(["m"], () => dispatch({ type: "toggle-monster" }));
        el.key(["q", "escape"], () => win.close());
      }

      win.setFocusTarget(canvas);

      win.describeState(() => ({
        appType: "wibwob.monster-cam",
        summary: `Monster Cam — face:${model.hasFace} hands:${model.handCount} pose:${model.hasPose} @ ${model.fps}fps`,
        hasFace: model.hasFace,
        hasHands: model.hasHands,
        handCount: model.handCount,
        hasPose: model.hasPose,
        fps: model.fps,
        showBg: model.showBg,
        monsterMode: model.monsterMode,
        phase: model.phase,
        emotion: model.currentEmotion,
      }));

      win.onCleanup(() => svc.stop());

      win.onRestyle(() => {
        canvas.style = theme().body;
        statusBar.style = theme().header;
        status.style = theme().header;
      });
    },
    palette: { order: 80, label: "Monster Cam" },
    menu: [{ category: "applications", order: 80, label: "Monster Cam" }],
  });
}
