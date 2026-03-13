/**
 * Terrain Lab — composable demo embedding ContourPlayer alongside
 * other UI parts. Proves the engine is a lego brick.
 *
 * Layout:
 *   ┌─ header (terrain name + seed) ──────────────────┐
 *   │ contour map (animated)        │ info panel       │
 *   │                               │ - mode           │
 *   │                               │ - terrain        │
 *   │                               │ - levels         │
 *   │                               │ - coverage       │
 *   ├─ status bar (keys) ────────────────────────────────┤
 *   └────────────────────────────────────────────────────┘
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { theme } from "../core/theme/resolver.js";
import {
  createRestyleBundle,
  createStack,
  createRow,
  createNodePart,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createRule,
} from "../core/ui-parts.js";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./generative-windows.js";

const MODE_ORDER = ["chaos", "order", "hybrid"] as const;

export function openTerrainLabWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Terrain Lab", "terrain-lab");

  // Contour canvas — left side, rendered directly by the player
  const contourBox = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 0, height: 0,
    style: theme().body,
  });

  // Info panel text block
  const infoBlock = createTextBlock(frame.body, { paddingLeft: 1, paddingTop: 0 });

  const header = createHeaderBar(frame.body);
  const divider = createRule(frame.body, { axis: "vertical" });
  const statusBar = createStatusBar(frame.body);

  let infoText = "";

  const player = createContourPlayer({
    mode: "chaos",
    terrainIdx: Math.max(0, terrainNames.indexOf("meadow")),
    fps: 12,
    getViewport: () => readNodeViewport(contourBox, { minWidth: 8, minHeight: 4 }),
    onFrame: (content) => {
      contourBox.setContent(content);
      deps.screen.render();
    },
    onStatus: (s) => {
      header.update({ left: `${s.terrain} #${s.seed}`, right: s.mode.toUpperCase() });
      infoText = [
        `Mode:    ${s.mode}`,
        `Terrain: ${s.terrain}`,
        `Levels:  ${s.levels}`,
        `Seed:    ${s.seed}`,
        "",
        "Keys:",
        " m   mode",
        " t   terrain",
        " r   reseed",
        " +/- levels",
      ].join("\n");
      infoBlock.update({ text: infoText });
      statusBar.update({ left: "m:mode t:terrain r:reseed +/-:levels s:save" });
      deps.onStateChanged?.();
    },
  });

  const contourPart = createNodePart(contourBox, {
    restyle: () => { contourBox.style = theme().body; },
  });

  const bodyColumns = createRow(frame.body, [
    { key: "map", basis: "3fr", part: contourPart },
    { key: "divider", basis: 1, part: divider },
    { key: "info", basis: "1fr", part: infoBlock },
  ]);

  const root = createStack(frame.body, [
    { key: "header", basis: 1, part: header },
    { key: "body", basis: "1fr", part: bodyColumns },
    { key: "status", basis: 1, part: statusBar },
  ]);

  const doLayout = () => {
    const w = Math.max(1, Number(frame.body.width) || 0);
    const h = Math.max(1, Number(frame.body.height) || 0);
    root.layout({ top: 0, left: 0, width: w, height: h });
  };

  const cycleMode = () => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(player.mode) + 1) % MODE_ORDER.length] ?? "chaos";
    player.setMode(next);
  };

  const saveFrame = () => {
    const text = contourBox.getContent();
    if (!text) return;
    const dir = path.join(process.cwd(), "scratch", "captures");
    fs.mkdirSync(dir, { recursive: true });
    const name = `terrain_${player.mode}_${terrainNames[player.terrainIdx]}_${player.seed}_${Date.now()}.txt`;
    fs.writeFileSync(path.join(dir, name), text, "utf8");
    statusBar.update({ left: `saved: ${name}` });
    deps.screen.render();
  };

  for (const el of [frame.frame, frame.body, contourBox]) {
    el.key(["m"], cycleMode);
    el.key(["t", "tab"], () => player.setTerrain(player.terrainIdx + 1));
    el.key(["r"], () => player.reroll());
    el.key(["+", "="], () => player.setLevels(player.levels + 1));
    el.key(["-"], () => player.setLevels(player.levels - 1));
    el.key(["s"], saveFrame);
  }

  frame.frame.on("resize", doLayout);

  frame.describeState = () => ({
    appType: "terrain-lab" as const,
    summary: "Terrain Lab — composable contour map with info panel.",
    mode: player.mode,
    terrain: terrainNames[player.terrainIdx],
    seed: player.seed,
    levels: player.levels,
  });
  frame.captureText = () => `${contourBox.getContent()}\n\n${infoText}`;
  frame.cleanup = () => {
    player.destroy();
    root.destroy();
  };
  frame.setFocusTarget(contourBox);
  const restyleBundle = createRestyleBundle([]);
  frame.onRestyle = () => {
    restyleBundle.restyle();
    root.restyle();
  };

  frame.refresh = doLayout;
  deps.windowManager.registerWindow(frame);
  frame.focus();

  // Layout and play AFTER registration — frame.body dimensions are not
  // reliable until blessed has rendered the frame at least once.
  doLayout();
  player.play();
}
