import blessed from "blessed";

import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import {
  createContourPlayer,
  terrainNames,
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

const MODE_ORDER = ["chaos", "order", "hybrid"] as const;

export function openContourWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Contour Studio", "contour");
  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    style: theme().body,
  });
  const status = blessed.box({
    parent: frame.body,
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    tags: false,
    style: theme().header,
  });

  const player = createContourPlayer({
    mode: "chaos",
    terrainIdx: Math.max(0, terrainNames.indexOf("meadow")),
    fps: 12,
    getViewport: () => ({
      width: Math.max(12, Number(canvas.width)),
      height: Math.max(6, Number(canvas.height)),
    }),
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
    onStatus: (s) => {
      status.setContent(` mode:${s.mode}  terrain:${s.terrain}  seed:${s.seed}  levels:${s.levels}  keys:m t/TAB r +/- `);
    },
  });

  player.play();

  frame.describeState = () => ({
    appType: "contour-studio" as const,
    summary: "Animated contour map studio with chaos, order, and hybrid terrain rendering.",
    contentPreview: canvas.getContent().split("\n").slice(0, 8).join("\n"),
    mode: player.mode,
    terrain: terrainNames[player.terrainIdx],
    seed: player.seed,
    levels: player.levels,
  });
  frame.captureText = () => `${canvas.getContent()}\n${status.getContent()}`;
  frame.cleanup = () => player.destroy();
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    canvas.focus();
  };
  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    status.style = theme().header;
  };

  const cycleMode = () => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(player.mode) + 1) % MODE_ORDER.length] ?? "chaos";
    player.setMode(next);
  };

  for (const el of [frame.frame, frame.body, canvas]) {
    el.key(["m"], cycleMode);
    el.key(["t", "tab"], () => player.setTerrain(player.terrainIdx + 1));
    el.key(["r"], () => player.reroll());
    el.key(["+", "="], () => player.setLevels(player.levels + 1));
    el.key(["-"], () => player.setLevels(player.levels - 1));
  }

  frame.frame.on("resize", () => player.reroll());
  deps.windowManager.registerWindow(frame);
  frame.focus();
}
