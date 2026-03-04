/**
 * Pattern B: Microapp bridge player with attachTarget + setRunning.
 *
 * When embedding an engine inside a microapp that uses the MicroappHost
 * UI parts system (createAnimatedPanel, createColumns, createStack),
 * you need a thin bridge that adapts the engine's onFrame callback into
 * the attachTarget/setRunning interface that createAnimatedPanel expects.
 *
 * Copied from: modules/wibwob-poetry-clock/index.ts (terrain voice)
 *
 * Key points:
 *   - The bridge owns the engine lifecycle: setRunning(true) creates it,
 *     setRunning(false) destroys it. No wasted frames when hidden.
 *   - shuffle() randomises all engine settings — call on timer ticks
 *     for variety without recreating the player.
 *   - attachTarget is called by createAnimatedPanel when the panel mounts.
 *   - The engine player is created lazily inside setRunning, not in the
 *     bridge constructor, so blessed dimensions are available.
 */

import {
  createContourPlayer, terrainNames,
  type ContourPlayer, type ContourMode,
} from "../../src/services/contour-engine.js";

// These types come from the MicroappHost system
type UiNode = { setContent(s: string): void };
type MicroappHost = { screen: { render(): void } };
type AnimatedPanelPlayer = { attachTarget(t: UiNode): void; destroy(): void };

const CONTOUR_MODES: ContourMode[] = ["chaos", "order", "hybrid"];

function createTerrainPlayer(host: MicroappHost): AnimatedPanelPlayer & {
  setRunning(running: boolean): void;
  shuffle(): void;
} {
  let target: UiNode | null = null;
  let player: ContourPlayer | null = null;
  let running = false;

  const randomise = () => {
    if (!player) return;
    player.setMode(CONTOUR_MODES[Math.floor(Math.random() * CONTOUR_MODES.length)]);
    player.setTerrain(Math.floor(Math.random() * terrainNames.length));
    player.setLevels(3 + Math.floor(Math.random() * 6)); // 3–8
    player.reroll();
  };

  return {
    attachTarget(nextTarget) {
      target = nextTarget;
    },

    shuffle() {
      randomise();
    },

    setRunning(nextRunning) {
      running = nextRunning;

      // Turning off: destroy engine, clear canvas
      if (!running) {
        player?.destroy();
        player = null;
        if (target) {
          target.setContent("");
          host.screen.render();
        }
        return;
      }

      // Turning on: create engine with random settings
      if (!target) return;
      if (player) { player.destroy(); player = null; }

      const t = target;
      player = createContourPlayer({
        mode: CONTOUR_MODES[Math.floor(Math.random() * CONTOUR_MODES.length)],
        seed: Math.floor(Math.random() * 100000),
        terrainIdx: Math.floor(Math.random() * terrainNames.length),
        nLevels: 3 + Math.floor(Math.random() * 6),
        fps: 8,
        getViewport: () => ({
          width: Number((t as any).width) || 12,
          height: Number((t as any).height) || 6,
        }),
        onFrame: (content) => {
          t.setContent(content);
          host.screen.render();
        },
      });
      player.play();
    },

    destroy() {
      player?.destroy();
      player = null;
      target = null;
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
//   // In createColumns — terrain is the HERO (3fr), text is sidebar (1fr):
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
