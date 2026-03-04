/**
 * Pattern A: Direct blessed box in a standalone window.
 *
 * This is the simplest embedding — create a blessed box, wire the player's
 * onFrame to box.setContent(), lay out manually or with anchored sizing.
 *
 * Copied from: src/windows/contour-window.ts (88 lines)
 * The original 218-line window was split into:
 *   - src/services/contour-engine.ts  (engine, pure computation)
 *   - src/windows/contour-window.ts   (this pattern — chrome + keys)
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import { createContourPlayer, terrainNames } from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

const MODE_ORDER = ["chaos", "order", "hybrid"] as const;

export function openContourWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Contour Studio", "contour");

  // 1. Create a blessed box — this is the rendering target
  const canvas = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 1,
    style: theme().body,
  });
  const status = blessed.box({
    parent: frame.body,
    left: 0, right: 0, bottom: 0, height: 1,
    tags: false, style: theme().header,
  });

  // 2. Create the player — wire onFrame to the box
  //    IMPORTANT: use || fallback, not just Math.max, because
  //    Number("100%-2") = NaN and Math.max(n, NaN) = NaN
  const player = createContourPlayer({
    mode: "chaos",
    terrainIdx: Math.max(0, terrainNames.indexOf("meadow")),
    fps: 12,
    getViewport: () => ({
      width: Math.max(12, Number(canvas.width) || 40),
      height: Math.max(6, Number(canvas.height) || 15),
    }),
    onFrame: (content) => {
      canvas.setContent(content);
      deps.screen.render();
    },
    onStatus: (s) => {
      status.setContent(` mode:${s.mode}  terrain:${s.terrain}  seed:${s.seed}  levels:${s.levels} `);
    },
  });

  // 3. Register FIRST, play AFTER — blessed dims unreliable before render
  deps.windowManager.registerWindow(frame);
  frame.focus();
  player.play();

  // 4. Standard window contract: describeState, cleanup, captureText
  frame.describeState = () => ({
    appType: "contour-studio" as const,
    summary: "Animated contour map studio.",
    mode: player.mode,
    terrain: terrainNames[player.terrainIdx],
    seed: player.seed,
    levels: player.levels,
  });
  frame.captureText = () => `${canvas.getContent()}\n${status.getContent()}`;
  frame.cleanup = () => player.destroy();
  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    status.style = theme().header;
  };

  // 5. Key bindings — bind to multiple elements for reliable capture
  for (const el of [frame.frame, frame.body, canvas]) {
    el.key(["m"], () => {
      const next = MODE_ORDER[(MODE_ORDER.indexOf(player.mode) + 1) % MODE_ORDER.length] ?? "chaos";
      player.setMode(next);
    });
    el.key(["t", "tab"], () => player.setTerrain(player.terrainIdx + 1));
    el.key(["r"], () => player.reroll());
    el.key(["+", "="], () => player.setLevels(player.levels + 1));
    el.key(["-"], () => player.setLevels(player.levels - 1));
  }
}
