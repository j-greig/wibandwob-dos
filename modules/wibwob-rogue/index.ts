/**
 * WibWob Rogue — roguelike microapp for WibWob-DOS.
 * Opens a window with a turn-based roguelike: castle, forest, mountain biomes.
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { initState, step, getFrame, describeEngine, setViewportHeight } from "./rogue-engine/engine.js";
import { renderFrame } from "./rogue-renderer.js";
import { mapKey } from "./rogue-input.js";
import type { GameState, GameCommand } from "./rogue-engine/types.js";

const LOG_LINES = 4;

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "WibWob Rogue",
    menu: [{ category: "applications", order: 60, label: "WibWob Rogue" }],
    palette: { order: 260, label: "WibWob Rogue" },
    action: () => openRogue(host),
  });
}

function openRogue(host: MicroappHost) {
  const win = host.createWindow({
    title: "WibWob Rogue",
    width: 98,
    height: 40,
  });

  const seed = Date.now();
  const state = initState(seed);

  // Content box — tags enabled for colour
  const content = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    tags: true,
    style: {
      fg: "white",
      bg: "black",
    },
  });

  function draw() {
    const innerW = (content.width as number) || 96;
    const innerH = (content.height as number) || 36;
    const mapH = innerH - LOG_LINES;
    const viewW = Math.min(innerW, 96);
    const viewH = Math.min(mapH, 72);
    setViewportHeight(viewH);

    const cells = getFrame(state, viewW, viewH);
    renderFrame(content, cells, viewW, viewH + LOG_LINES, state.log, LOG_LINES);
    host.screen.render();
  }

  // Initial render
  draw();

  // Key bindings — use win.body.key() like other microapps
  const handleCmd = (cmd: GameCommand) => {
    step(state, cmd);
    draw();
  };
  win.body.key(["h", "left"],  () => handleCmd("move-west"));
  win.body.key(["j", "down"],  () => handleCmd("move-south"));
  win.body.key(["k", "up"],    () => handleCmd("move-north"));
  win.body.key(["l", "right"], () => handleCmd("move-east"));
  win.body.key(["w"],          () => handleCmd("squeeze-toggle"));
  win.body.key(["e", "enter", "space"], () => handleCmd("interact"));

  // Also handle writeInput (agent API sends input this way)
  win.onInput((input: string) => {
    const cmdMap: Record<string, GameCommand> = {
      h: "move-west", j: "move-south", k: "move-north", l: "move-east",
      w: "squeeze-toggle", e: "interact",
    };
    const cmd = cmdMap[input.toLowerCase()];
    if (cmd) {
      step(state, cmd);
      draw();
    }
  });

  // describeState for /state API
  win.describeState(() => {
    const desc = describeEngine(state);
    return {
      summary: `WibWob Rogue — Turn ${desc.turn}, ${desc.biome} (${desc.label})`,
      ...desc,
    };
  });

  win.captureText(() => {
    const viewW = 96;
    const viewH = 36;
    const cells = getFrame(state, viewW, viewH);
    const lines: string[] = [];
    for (let y = 0; y < viewH; y++) {
      let line = "";
      for (let x = 0; x < viewW; x++) {
        const idx = y * viewW + x;
        line += cells[idx]?.ch ?? " ";
      }
      lines.push(line.trimEnd());
    }
    lines.push("─".repeat(60));
    for (const msg of state.log.slice(-4)) {
      lines.push(msg);
    }
    return lines.join("\n");
  });

  win.onRestyle(() => {
    // Keep dark background regardless of theme
    content.style.fg = "white";
    content.style.bg = "black";
    draw();
  });

  win.onResize(() => {
    draw();
  });

  win.onCleanup(() => {});

  win.focus();
}
