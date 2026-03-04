/**
 * Pattern A (composed): Direct blessed box alongside ui-parts in a
 * multi-panel window.
 *
 * Same technique as the standalone window, but the engine occupies one
 * region of a manually laid-out frame with header, divider, info panel,
 * and status bar around it.
 *
 * Copied from: src/windows/terrain-lab-window.ts (~160 lines)
 *
 * Key differences from standalone:
 *   - Manual doLayout() function positions everything
 *   - Register BEFORE layout — blessed dims unreliable before render
 *   - frame.refresh = doLayout for resize handling
 *   - Mixed blessed box (contour) + ui-parts (header, divider, etc.)
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import {
  createHeaderBar, createStatusBar, createTextBlock, createRule,
} from "../core/ui-parts.js";
import { createContourPlayer, terrainNames } from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

export function openTerrainLabWindow(deps: BaseWindowDeps): void {
  const frame = deps.windowManager.createFrame("Terrain Lab", "terrain-lab");

  // Raw blessed box for the engine
  const contourBox = blessed.box({
    parent: frame.body,
    top: 0, left: 0, width: 0, height: 0,
    style: theme().body,
  });

  // ui-parts for the chrome around it
  const infoBlock = createTextBlock(frame.body, { paddingLeft: 1 });
  const header = createHeaderBar(frame.body);
  const divider = createRule(frame.body, { axis: "vertical" });
  const statusBar = createStatusBar(frame.body);

  const player = createContourPlayer({
    mode: "chaos",
    terrainIdx: Math.max(0, terrainNames.indexOf("meadow")),
    fps: 12,
    getViewport: () => ({
      width: Math.max(8, Number(contourBox.width) || 40),
      height: Math.max(4, Number(contourBox.height) || 15),
    }),
    onFrame: (content) => {
      contourBox.setContent(content);
      deps.screen.render();
    },
    onStatus: (s) => {
      header.update({ left: `${s.terrain} #${s.seed}`, right: s.mode.toUpperCase() });
      infoBlock.update({
        text: `Mode:    ${s.mode}\nTerrain: ${s.terrain}\nLevels:  ${s.levels}\nSeed:    ${s.seed}`,
      });
      statusBar.update({ left: "m:mode t:terrain r:reseed +/-:levels" });
      deps.onStateChanged?.();
    },
  });

  // Manual layout — positions the blessed box + ui-parts together
  const doLayout = () => {
    const w = Math.max(1, Number(frame.body.width) || 0);
    const h = Math.max(1, Number(frame.body.height) || 0);
    const headerH = 1, statusH = 1;
    const bodyH = Math.max(1, h - headerH - statusH);
    const infoW = Math.max(1, Math.min(20, Math.floor(w * 0.25)));
    const mapW = Math.max(8, w - infoW - 1);

    header.layout({ top: 0, left: 0, width: w, height: headerH });
    contourBox.top = headerH;
    contourBox.left = 0;
    contourBox.width = mapW;
    contourBox.height = bodyH;
    divider.layout({ top: headerH, left: mapW, width: 1, height: bodyH });
    divider.update({ visible: true });
    infoBlock.layout({ top: headerH, left: mapW + 1, width: infoW, height: bodyH });
    statusBar.layout({ top: headerH + bodyH, left: 0, width: w, height: statusH });
  };

  frame.frame.on("resize", doLayout);
  frame.refresh = doLayout;

  // Register FIRST, layout + play AFTER
  deps.windowManager.registerWindow(frame);
  frame.focus();
  doLayout();
  player.play();

  frame.describeState = () => ({
    appType: "terrain-lab" as const,
    summary: "Terrain Lab — composable contour map with info panel.",
    mode: player.mode,
    terrain: terrainNames[player.terrainIdx],
    seed: player.seed,
    levels: player.levels,
  });
  frame.cleanup = () => {
    player.destroy();
    header.destroy();
    divider.destroy();
    infoBlock.destroy();
    statusBar.destroy();
  };
}
