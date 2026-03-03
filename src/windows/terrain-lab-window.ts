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
import { theme } from "../core/theme/resolver.js";
import {
  createStack,
  createColumns,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createRule,
} from "../core/ui-parts.js";
import {
  createContourPlayer,
  terrainNames,
} from "../services/contour-engine.js";
import type { BaseWindowDeps } from "./misc-windows.js";

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
    getViewport: () => ({
      width: Math.max(8, Number(contourBox.width)),
      height: Math.max(4, Number(contourBox.height)),
    }),
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
    },
  });

  // Manual layout since contourBox is raw blessed, not a UiPart
  const doLayout = () => {
    const w = Math.max(1, Number(frame.body.width) || 0);
    const h = Math.max(1, Number(frame.body.height) || 0);

    const headerH = 1;
    const statusH = 1;
    const bodyH = Math.max(1, h - headerH - statusH);
    const infoW = Math.max(1, Math.min(20, Math.floor(w * 0.25)));
    const divW = 1;
    const mapW = Math.max(8, w - infoW - divW);

    header.layout({ top: 0, left: 0, width: w, height: headerH });

    // Contour map — left
    contourBox.top = headerH;
    contourBox.left = 0;
    contourBox.width = mapW;
    contourBox.height = bodyH;

    // Divider
    divider.layout({ top: headerH, left: mapW, width: divW, height: bodyH });
    divider.update({ visible: true });

    // Info panel — right
    infoBlock.layout({ top: headerH, left: mapW + divW, width: infoW, height: bodyH });

    statusBar.layout({ top: headerH + bodyH, left: 0, width: w, height: statusH });
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
    header.destroy();
    divider.destroy();
    infoBlock.destroy();
    statusBar.destroy();
  };
  frame.focus = () => {
    deps.windowManager.focusWindow(frame);
    contourBox.focus();
  };
  frame.onRestyle = () => {
    contourBox.style = theme().body;
    header.restyle();
    divider.restyle();
    infoBlock.restyle();
    statusBar.restyle();
  };

  frame.refresh = doLayout;
  deps.windowManager.registerWindow(frame);
  frame.focus();

  // Layout and play AFTER registration — frame.body dimensions are not
  // reliable until blessed has rendered the frame at least once.
  doLayout();
  player.play();
}
