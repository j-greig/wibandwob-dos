/**
 * Tide Pool — WibWob-DOS microapp.
 *
 * Wires the engine (pure state) and renderer (unified text display) to the
 * microapp host, blessed keyboard events, and the command registry.
 *
 * Follows the TR-808 pattern: stack layout with header, display, button bar,
 * and status bar. All visual logic lives in renderer.ts.
 */

import { TidePoolEngine } from "./engine.js";
import { TIDEPOOL_SIDEBAR_WIDTH } from "./layout-constants.js";
import {
  renderTidePool,
  summarizeState,
  headerLeft,
  headerRight,
  statusLeft,
  statusRight,
  CELL_COLS,
} from "./renderer.js";
import { SPECIES_IDS, SPECIES, MAX_SHANNON, type SpeciesId } from "./species.js";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

// Key map: number keys seed species at random grid positions
const KEY_TO_SPECIES: Record<string, SpeciesId> = {
  "1": "algae",
  "2": "lichen",
  "3": "coral",
  "4": "anemone",
  "5": "barnacle",
};

const DEFAULT_TICK_MS = 500;
const MIN_TICK_MS = 200;
const MAX_TICK_MS = 2000;

type TideMode = "all" | SpeciesId;

export default function setup(host: MicroappHost) {
  let engine: TidePoolEngine | undefined;
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let tickMs = DEFAULT_TICK_MS;
  let speed = 1;
  let shannonHistory: number[] = [];
  let highlight: SpeciesId | null = null;

  function openTidePool(args?: Record<string, unknown>) {
    const win = host.createWindow({
      title: "Tide Pool",
      width: 120,
      height: 35,
    });

    // Compute grid dimensions from window body
    const initW = Math.max(60, Number(win.body.width) || 100);
    const initH = Math.max(20, Number(win.body.height) || 30);
    const gridW = Math.max(10, Math.floor((initW - 35) / CELL_COLS));
    const gridH = Math.max(5, initH - 12);

    engine = new TidePoolEngine(gridW, gridH);
    shannonHistory = [];
    highlight = null;

    // Restore from snapshot if provided
    if (args?._restore && typeof args._restore === "object") {
      engine.hydrate(args._restore as Record<string, unknown>);
      if (typeof args._speed === "number") {
        speed = args._speed as number;
        tickMs = DEFAULT_TICK_MS / speed;
      }
      if (Array.isArray(args._shannonHistory)) {
        shannonHistory = args._shannonHistory as number[];
      }
    }

    engine.start();

    // -- UI: TR-808 stack pattern --
    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const display = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });

    // Button bar: mode switcher for highlight + controls
    const buttonBar = host.ui.createButtonBar<TideMode>(
      win.body,
      [
        { id: "all", label: "ALL" },
        { id: "algae", label: "◦Alg" },
        { id: "lichen", label: "※Lic" },
        { id: "coral", label: "✧Cor" },
        { id: "anemone", label: "♦Ane" },
        { id: "barnacle", label: "✶Bar" },
      ],
      (id) => {
        highlight = id === "all" ? null : id;
        render();
        host.screen.render();
      },
    );

    const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });

    const root = host.ui.createStack(win.body, [
      { key: "header", basis: 1, part: headerBar },
      { key: "display", basis: "1fr", part: display },
      { key: "buttons", basis: 1, part: buttonBar },
      { key: "status", basis: 1, part: statusBar },
    ]);

    // -- Render --
    function render() {
      if (!engine) return;

      const innerW = Math.max(60, Number(win.body.width) || 100);
      const innerH = Math.max(20, Number(win.body.height) || 30);

      // Layout the stack to fill the window body
      root.layout({ top: 0, left: 0, width: innerW, height: innerH });

      // Display content height = total - header(1) - buttons(1) - status(1)
      const displayH = Math.max(5, innerH - 3);

      const content = renderTidePool(engine, innerW, displayH, shannonHistory, highlight);
      headerBar.update({
        left: headerLeft(engine),
        right: headerRight(engine, speed),
      });
      display.update({ text: content });
      buttonBar.update({
        leftText: " [SPC]play [R]eset [T]ide [+/-]spd [S]eed [1-5]seed",
        activeId: highlight ?? "all",
      });
      statusBar.update({
        left: statusLeft(engine),
        right: statusRight(engine),
      });
      host.screen.render();
    }

    // -- Engine resize on window resize only --
    function resizeEngine() {
      if (!engine) return;
      const innerW = Math.max(60, Number(win.body.width) || 100);
      const innerH = Math.max(20, Number(win.body.height) || 30);
      const sidebarW = TIDEPOOL_SIDEBAR_WIDTH;
      const dividerW = 3;
      const gridAreaW = innerW - sidebarW - dividerW - 2;
      const targetGridW = Math.max(5, Math.floor(gridAreaW / CELL_COLS));
      // Display height = innerH - 3 (header + buttons + status)
      const targetGridH = Math.max(5, innerH - 3);
      if (engine.width !== targetGridW || engine.height !== targetGridH) {
        engine.resize(targetGridW, targetGridH);
      }
    }

    // -- Tick loop (setTimeout chain to avoid event-loop starvation) --
    function startTicking() {
      stopTicking();
      scheduleTick();
    }

    function scheduleTick() {
      tickTimer = setTimeout(() => {
        if (!engine || !engine.running) return;
        engine.tick();
        shannonHistory.push(engine.shannonDiversity);
        if (shannonHistory.length > 200) shannonHistory.shift();
        render();
        // Chain next tick — gives event loop a chance to breathe
        if (engine?.running) scheduleTick();
      }, tickMs);
    }

    function stopTicking() {
      if (tickTimer) {
        clearTimeout(tickTimer);
        tickTimer = null;
      }
    }

    function setSpeed(newSpeed: number) {
      speed = Math.max(1, Math.min(8, newSpeed));
      tickMs = Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, DEFAULT_TICK_MS / speed));
      if (engine?.running) startTicking();
    }

    // -- Keyboard --
    win.onInput((ch, key) => {
      if (!engine) return;

      // Space: play/pause
      if (key?.name === "space" || ch === " ") {
        engine.toggle();
        if (engine.running) startTicking();
        else stopTicking();
        render();
        return;
      }

      // R: reset with new random seed
      if (ch === "r" || ch === "R") {
        engine.reset();
        engine.start();
        shannonHistory = [];
        startTicking();
        render();
        return;
      }

      // S: new seed (reset with specific random seed)
      if (ch === "s" || ch === "S") {
        engine.reset(Date.now() & 0xffffffff);
        engine.start();
        shannonHistory = [];
        startTicking();
        render();
        return;
      }

      // T: cycle tide
      if (ch === "t" || ch === "T") {
        engine.cycleTide();
        render();
        return;
      }

      // H: cycle species highlight
      if (ch === "h" || ch === "H") {
        if (highlight === null) {
          highlight = SPECIES_IDS[0];
        } else {
          const idx = SPECIES_IDS.indexOf(highlight);
          if (idx >= SPECIES_IDS.length - 1) {
            highlight = null; // cycle back to "all"
          } else {
            highlight = SPECIES_IDS[idx + 1];
          }
        }
        render();
        return;
      }

      // +/= : speed up
      if (ch === "+" || ch === "=") {
        setSpeed(speed + 1);
        render();
        return;
      }

      // -/_ : slow down
      if (ch === "-" || ch === "_") {
        setSpeed(speed - 1);
        render();
        return;
      }

      // Number keys seed species
      const species = KEY_TO_SPECIES[ch ?? ""];
      if (species) {
        const x = Math.floor(engine.width * (0.2 + Math.random() * 0.6));
        const y = Math.floor(engine.height * (0.2 + Math.random() * 0.6));
        engine.seedSpecies(species, x, y, 2);
        render();
        return;
      }
    });

    // -- State --
    win.describeState(() => {
      if (!engine) return { summary: "Tide Pool — not initialized" };
      return {
        summary: summarizeState(engine, speed),
        generation: engine.generation,
        era: engine.era,
        tide: engine.tide,
        tidePhase: Number(engine.tidePhase.toFixed(3)),
        shannonDiversity: Number(engine.shannonDiversity.toFixed(3)),
        dominant: engine.dominant,
        populations: { ...engine.populations },
        extinct: [...engine.extinct],
        totalPopulation: engine.totalPopulation,
        running: engine.running,
        speed,
        seed: engine.seed,
        gridSize: `${engine.width}x${engine.height}`,
        recentEvents: engine.events.slice(-5).map(e => e.detail),
        highlight,
      };
    });

    win.captureText(() => {
      if (!engine) return "Tide Pool — not initialized";
      return renderTidePool(engine, 100, 40, shannonHistory, highlight);
    });

    // -- Restyle --
    win.onRestyle(() => {
      render();
    });

    // -- Resize --
    win.onResize(() => {
      resizeEngine();
      render();
    });

    // -- Cleanup --
    win.onCleanup(() => {
      stopTicking();
      engine = undefined;
    });

    // -- Snapshot --
    host.registerSnapshot({
      canRestore: (snap) => snap.appType === "wibwob.tidepool",
      restore: (snap) => {
        openTidePool({ _restore: snap._restore, _speed: snap._speed, _shannonHistory: snap._shannonHistory });
      },
    });

    // Initial resize + render, then start ticking after a brief delay
    resizeEngine();
    render();
    win.focus();
    setTimeout(() => startTicking(), 500);

    // Return snapshot data for workspace persistence
    return {
      snapshot: () => {
        if (!engine) return {};
        return {
          appType: "wibwob.tidepool",
          _restore: engine.serialize(),
          _speed: speed,
          _shannonHistory: shannonHistory.slice(-100),
        };
      },
    };
  }

  // -- Register command --
  host.registerCommand({
    id: "open",
    label: "Tide Pool",
    description: "Open an ASCII ecosystem simulator — five species competing in a bounded tide pool.",
    menu: [{ category: "applications", order: 38, label: "Tide Pool" }],
    palette: { order: 58, label: "Open Tide Pool" },
    action: (args) => {
      openTidePool(args as Record<string, unknown> | undefined);
    },
  });
}
