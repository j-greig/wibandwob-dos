import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════
// SPORE CLOCK — a living fungal timepiece
//
// Time is told through mycelial growth, not digits.
// Hours  → dominant colony colour
// Minutes → hyphal reach (network density)
// Seconds → spore drift particles
//
// The clock grows, sporulates, and recolonises every minute.
// ═══════════════════════════════════════════════════════════════

// Mycelial growth characters (density progression)
const HYPHAE = [" ", "·", "∙", ":", "╌", "─", "┼", "╋", "▓", "█"];
const SPORE_CHARS = ["°", "•", "⊙", "◌", "○", "◦", "∘", "⁘", "⁛"];
const NODE_CHARS = ["◉", "⊛", "✦", "✧", "❋", "✿", "❀", "⚘"];
const TENDRIL_H = ["─", "═", "╌", "╍", "┄", "┈"];
const TENDRIL_V = ["│", "║", "╎", "╏", "┆", "┊"];
const BRANCH = ["┤", "├", "┬", "┴", "┼", "╋", "╳", "╬"];

// Colony colour palette — one per 2-hour block (12 colonies per day)
const COLONY_COLOURS = [
  "blue",      // 00-01  deep night spores
  "#4a6fa5",   // 02-03  predawn fungus
  "#7b68ee",   // 04-05  violet dawn mycelium
  "#da70d6",   // 06-07  morning orchid
  "#ff6b6b",   // 08-09  red cap flush
  "#ffa07a",   // 10-11  salmon gill
  "#ffd700",   // 12-13  golden chanterelle
  "#98fb98",   // 14-15  afternoon verdure
  "#20b2aa",   // 16-17  teal lichen
  "#6495ed",   // 18-19  evening cornflower
  "#9370db",   // 20-21  twilight purple
  "#483d8b",   // 22-23  midnight indigo
];

interface Spore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  char: string;
}

interface HyphalNode {
  x: number;
  y: number;
  strength: number; // 0-1 growth intensity
  connected: number[]; // indices of connected nodes
}

// Cellular automaton grid for mycelial growth
interface MycelialField {
  grid: number[][]; // 0-9 density values
  nodes: HyphalNode[];
  spores: Spore[];
  colonies: number; // active growth centres
  generation: number;
}

function createField(w: number, h: number): MycelialField {
  const grid: number[][] = [];
  for (let y = 0; y < h; y++) {
    grid.push(new Array(w).fill(0));
  }
  return { grid, nodes: [], spores: [], colonies: 0, generation: 0 };
}

// Seed a colony at (cx, cy) with given strength
function seedColony(field: MycelialField, cx: number, cy: number, strength: number) {
  const w = field.grid[0]?.length ?? 0;
  const h = field.grid.length;
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return;

  field.grid[cy][cx] = Math.min(9, Math.floor(strength * 9));
  field.nodes.push({
    x: cx, y: cy,
    strength,
    connected: [],
  });
  field.colonies++;
}

// Grow the mycelium one generation
function growField(field: MycelialField, intensity: number) {
  const h = field.grid.length;
  const w = field.grid[0]?.length ?? 0;
  if (w === 0 || h === 0) return;

  // Cellular automaton: each cell influenced by neighbours
  const next: number[][] = [];
  for (let y = 0; y < h; y++) {
    next.push([...field.grid[y]]);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const neighbours =
        field.grid[y - 1][x - 1] + field.grid[y - 1][x] + field.grid[y - 1][x + 1] +
        field.grid[y][x - 1] + field.grid[y][x + 1] +
        field.grid[y + 1][x - 1] + field.grid[y + 1][x] + field.grid[y + 1][x + 1];

      const avg = neighbours / 8;
      const current = field.grid[y][x];

      if (current === 0 && avg > 0.8) {
        // colonise empty cell if enough neighbours
        next[y][x] = Math.min(9, Math.floor(avg * intensity * 1.2));
      } else if (current > 0 && current < 9) {
        // grow existing cell
        const growth = Math.random() < intensity * 0.3 ? 1 : 0;
        next[y][x] = Math.min(9, current + growth);
      }
      // random tendril extension
      if (current === 0 && Math.random() < intensity * 0.02) {
        const nearNode = field.nodes.find(
          (n) => Math.abs(n.x - x) < 4 && Math.abs(n.y - y) < 3
        );
        if (nearNode) {
          next[y][x] = 1;
        }
      }
    }
  }

  field.grid = next;
  field.generation++;
}

// Emit spores from active nodes
function emitSpores(field: MycelialField, count: number, w: number, h: number) {
  for (let i = 0; i < count; i++) {
    const source = field.nodes.length > 0
      ? field.nodes[Math.floor(Math.random() * field.nodes.length)]
      : { x: Math.floor(w / 2), y: Math.floor(h / 2) };

    field.spores.push({
      x: source.x + (Math.random() - 0.5) * 2,
      y: source.y + (Math.random() - 0.5),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 0.8,
      age: 0,
      char: SPORE_CHARS[Math.floor(Math.random() * SPORE_CHARS.length)],
    });
  }
}

// Drift spores
function driftSpores(field: MycelialField, w: number, h: number) {
  field.spores = field.spores.filter((s) => {
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.95; // air resistance
    s.vy *= 0.95;
    s.vx += (Math.random() - 0.5) * 0.3; // brownian
    s.vy += (Math.random() - 0.5) * 0.15;
    s.age++;
    return s.age < 40 && s.x >= 0 && s.x < w && s.y >= 0 && s.y < h;
  });
}

// Render the field to a string
function renderField(
  field: MycelialField,
  w: number,
  h: number,
  seconds: number,
  colourFg: string,
): string {
  const lines: string[] = [];

  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      // Check for spore at this position
      const spore = field.spores.find(
        (s) => Math.floor(s.x) === x && Math.floor(s.y) === y
      );
      if (spore) {
        // Fade spore based on age
        line += spore.age < 10 ? spore.char : spore.age < 25 ? "·" : " ";
        continue;
      }

      // Check for node at this position
      const node = field.nodes.find((n) => n.x === x && n.y === y);
      if (node) {
        const pulse = Math.sin(seconds * 2 + node.x * 0.3) * 0.5 + 0.5;
        const ni = Math.floor(pulse * (NODE_CHARS.length - 1));
        line += NODE_CHARS[ni];
        continue;
      }

      // Mycelial density
      const density = field.grid[y]?.[x] ?? 0;
      if (density > 0) {
        // Add tendrils for mid-density cells
        if (density >= 2 && density <= 5) {
          const leftD = field.grid[y]?.[x - 1] ?? 0;
          const rightD = field.grid[y]?.[x + 1] ?? 0;
          const upD = field.grid[y - 1]?.[x] ?? 0;
          const downD = field.grid[y + 1]?.[x] ?? 0;

          if (leftD > 0 && rightD > 0 && upD > 0 && downD > 0) {
            line += BRANCH[Math.floor(Math.random() * 3)];
            continue;
          } else if (leftD > 0 && rightD > 0) {
            line += TENDRIL_H[density % TENDRIL_H.length];
            continue;
          } else if (upD > 0 && downD > 0) {
            line += TENDRIL_V[density % TENDRIL_V.length];
            continue;
          }
        }
        line += HYPHAE[density];
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }

  return lines.join("\n");
}

// Format time as fungal status
function fungalTime(now: Date): string {
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const colonyIdx = Math.floor(h / 2);
  const names = [
    "DEEP SPORE", "PREDAWN", "VIOLET DAWN", "ORCHID FLUSH",
    "RED CAP", "SALMON GILL", "CHANTERELLE", "VERDURE",
    "TEAL LICHEN", "CORNFLOWER", "TWILIGHT", "MIDNIGHT",
  ];
  const density = Math.floor((m / 60) * 100);
  return `${names[colonyIdx]} colony  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}  density:${density}%`;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Spore Clock",
    description: "Open the living mycelial timepiece",
    menu: [{ category: "applications", order: 160, label: "Spore Clock" }],
    palette: { order: 160, label: "Open Spore Clock" },
    action: () => openSporeClock(host),
  });
}

function openSporeClock(host: MicroappHost) {
  const win = host.createWindow({ title: "Spore Clock", width: 64, height: 28 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  // Main mycelium display
  const canvas = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 2,
    style: host.theme().body,
    tags: false,
  });

  // Status bar
  const status = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  // Separator
  const sep = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    content: "",
    style: host.theme().body,
    tags: false,
  });

  let field: MycelialField | null = null;
  let lastMinute = -1;
  let tick = 0;

  function getContentSize(): { w: number; h: number } {
    const w = Math.max(8, (Number(canvas.width) || 40));
    const h = Math.max(4, (Number(canvas.height) || 20));
    return { w, h };
  }

  function resetField() {
    const { w, h } = getContentSize();
    field = createField(w, h);

    const now = new Date();
    const m = now.getMinutes();

    // Seed colonies based on current time
    // More colonies as the hour progresses
    const numSeeds = 3 + Math.floor(m / 15);
    for (let i = 0; i < numSeeds; i++) {
      const angle = (i / numSeeds) * Math.PI * 2 + (now.getHours() * 0.5);
      const radius = Math.min(w, h) * 0.3;
      const cx = Math.floor(w / 2 + Math.cos(angle) * radius);
      const cy = Math.floor(h / 2 + Math.sin(angle) * radius * 0.5);
      seedColony(field, cx, cy, 0.5 + Math.random() * 0.5);
    }

    // Centre node (always)
    seedColony(field, Math.floor(w / 2), Math.floor(h / 2), 1.0);
  }

  function updateDisplay() {
    if (!field) return;
    const now = new Date();
    const { w, h } = getContentSize();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Reset field every minute (new growth cycle)
    if (minutes !== lastMinute) {
      lastMinute = minutes;
      resetField();
    }

    // Growth intensity increases through the minute
    const minuteProgress = seconds / 60;
    const intensity = 0.2 + minuteProgress * 0.8;

    // Grow mycelium
    growField(field!, intensity);

    // Spore emission scales with seconds
    const sporeRate = Math.floor(seconds / 10) + 1;
    if (tick % 3 === 0) {
      emitSpores(field!, sporeRate, w, h);
    }
    driftSpores(field!, w, h);

    // Get colony colour
    const colonyIdx = Math.floor(now.getHours() / 2);
    const colour = COLONY_COLOURS[colonyIdx] ?? "white";

    // Render
    const rendered = renderField(field!, w, h, seconds, colour);
    canvas.setContent(rendered);
    canvas.style = { fg: colour, bg: host.theme().body.bg };

    // Separator line
    const sepChar = TENDRIL_H[tick % TENDRIL_H.length];
    sep.setContent(sepChar.repeat(w));
    sep.style = { fg: colour, bg: host.theme().body.bg };

    // Status
    status.setContent(` ${fungalTime(now)}  gen:${field!.generation}  spores:${field!.spores.length}  nodes:${field!.nodes.length}`);

    host.screen.render();
    tick++;
  }

  resetField();

  // Main animation loop — ~8fps for organic feel
  createTimer(() => {
    updateDisplay();
  }, 125, timers);

  win.onResize(() => {
    resetField();
    updateDisplay();
  });

  win.describeState(() => {
    const now = new Date();
    return {
      summary: `Spore Clock — ${fungalTime(now)}`,
      generation: field?.generation ?? 0,
      sporeCount: field?.spores.length ?? 0,
      nodeCount: field?.nodes.length ?? 0,
      colonies: field?.colonies ?? 0,
    };
  });

  win.captureText(() => {
    const now = new Date();
    const header = fungalTime(now);
    const body = canvas.getContent();
    return `${header}\n\n${body}`;
  });

  win.onRestyle(() => {
    const t = host.theme();
    canvas.style = { ...t.body };
    status.style = t.muted
      ? { fg: t.muted.fg, bg: t.body.bg }
      : { fg: "grey", bg: t.body.bg };
    sep.style = { ...t.body };
    host.screen.render();
  });

  win.onCleanup(() => {
    clearTimers(timers);
  });

  win.focus();
}
