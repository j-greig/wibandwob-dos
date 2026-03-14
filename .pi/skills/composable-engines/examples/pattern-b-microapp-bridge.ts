/**
 * Pattern B: Microapp bridge player with attachTarget + setRunning.
 *
 * When embedding an engine inside a microapp that uses the MicroappHost
 * UI parts system (createAnimatedPanel, createColumns, createStack),
 * use createLazyMountedPlayer() to adapt the engine's onFrame callback into
 * the attachTarget/setRunning interface that createAnimatedPanel expects.
 *
 * Copied from: microapps/wibwob-poetry-clock/index.ts (terrain voice)
 *
 * Key points:
 *   - createLazyMountedPlayer() owns the attach/destroy/start-stop lifecycle.
 *   - readNodeViewport() handles blessed width/height coercion safely.
 *   - shuffle() can be implemented as a stop/start cycle when you want a
 *     fresh random terrain config.
 */

import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
  type ContourMode,
} from "../../src/services/contour-engine.js";
import { createLazyMountedPlayer } from "../../src/services/animation-service.js";

// These types come from the MicroappHost system
type UiNode = { setContent(s: string): void; width?: number | string; height?: number | string };
type MicroappHost = { screen: { render(): void } };
type AnimatedPanelPlayer = { attachTarget(t: UiNode): void; destroy(): void };

const CONTOUR_MODES: ContourMode[] = ["chaos", "order", "hybrid"];

function createTerrainPlayer(host: MicroappHost): AnimatedPanelPlayer & {
  setRunning(running: boolean): void;
  shuffle(): void;
} {
  function randomContourConfig() {
    return {
      mode: CONTOUR_MODES[Math.floor(Math.random() * CONTOUR_MODES.length)],
      seed: Math.floor(Math.random() * 100000),
      terrainIdx: Math.floor(Math.random() * terrainNames.length),
      nLevels: 3 + Math.floor(Math.random() * 6),
      fps: 8,
    };
  }

  const bridge = createLazyMountedPlayer({
    create(target) {
      return createContourPlayer({
        ...randomContourConfig(),
        getViewport: () => readNodeViewport(target, { minWidth: 12, minHeight: 6, fallbackWidth: 12, fallbackHeight: 6 }),
        onFrame: (content) => { target.setContent(content); host.screen.render(); },
      });
    },
    render: () => host.screen.render(),
    clearOnStop: true,
  });

  return {
    ...bridge,
    shuffle() {
      bridge.setRunning(false);
      bridge.setRunning(true);
    },
  };
}

// --------------------------------------------------------------------------
// Usage inside a microapp's setup function:
// --------------------------------------------------------------------------
//
//   const terrainPlayer = createTerrainPlayer(host);
//   const terrainPanel = host.ui.createAnimatedPanel(win.body, { player: terrainPlayer });
//   const terrainRule = host.ui.createRule(win.body, { axis: "vertical" });
//
//   // In createColumns — terrain is the hero panel and only runs when visible:
//   const body = host.ui.createColumns(win.body, [
//     { key: "poem", basis: "1fr", part: poemBlock },
//     { key: "terrain-rule", basis: 1, part: terrainRule,
//       visible: () => voice === "terrain" },
//     { key: "terrain", basis: "3fr", part: terrainPanel,
//       visible: () => voice === "terrain" },
//   ]);
//
//   // In render():
//   terrainPlayer.setRunning(voice === "terrain");
//
//   // On timer tick (e.g. every minute):
//   if (voice === "terrain") terrainPlayer.shuffle();
