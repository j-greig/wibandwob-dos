/**
 * Pattern A (composed): Direct blessed box alongside ui-parts in a
 * multi-panel window.
 *
 * Same technique as the standalone window, but the engine occupies one
 * region of a composable frame with header, divider, info panel,
 * and status bar around it. Use createNodePart() to wrap the raw blessed
 * box and compose it with createColumns()/createStack().
 *
 * Copied from: src/windows/terrain-lab-window.ts (~160 lines)
 *
 * Key differences from standalone:
 *   - The contour box is wrapped in createNodePart()
 *   - createColumns()/createStack() own the layout tree
 *   - Register BEFORE layout — blessed dims unreliable before render
 *   - frame.refresh = doLayout for resize handling
 *   - Mixed blessed box (contour) + ui-parts (header, divider, etc.)
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import {
  createStack,
  createColumns,
  createNodePart,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createRule,
} from "../core/ui-parts.js";
import { createContourPlayer, readNodeViewport, terrainNames } from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

const MODE_ORDER = ["chaos", "order", "hybrid"] as const;

export function openTerrainLabWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Terrain Lab", "terrain-lab");

  // Raw blessed box for the engine
  const contourBox = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 0, height: 0,
    style: theme().body,
  });

  // ui-parts for the chrome around it
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
      statusBar.update({ left: "m:mode t:terrain r:reseed +/-:levels" });
      deps.onStateChanged?.();
    },
  });

  const contourPart = createNodePart(contourBox, {
    restyle: () => { contourBox.style = theme().body; },
  });

  const bodyColumns = createColumns(frame.body, [
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

  for (const el of [frame.frame, frame.body, contourBox]) {
    el.key(["m"], cycleMode);
    el.key(["t", "tab"], () => player.setTerrain(player.terrainIdx + 1));
    el.key(["r"], () => player.reroll());
    el.key(["+", "="], () => player.setLevels(player.levels + 1));
    el.key(["-"], () => player.setLevels(player.levels - 1));
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
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    contourBox.focus();
  };
  frame.onRestyle = () => {
    root.restyle();
  };

  frame.refresh = doLayout;
  deps.windowManager.registerWindow(frame);
  frame.focus();
  doLayout();
  player.play();
}
