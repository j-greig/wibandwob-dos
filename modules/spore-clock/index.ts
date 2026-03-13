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
// Hours  → dominant colony colour (with circadian blending)
// Minutes → hyphal reach (network density)
// Seconds → spore drift particles
//
// The clock grows, sporulates, decays, and recolonises.
// Substrate memory means old growth shapes new growth.
// Wild colonies emerge from drifting spores.
// Death feeds birth at minute transitions.
// ═══════════════════════════════════════════════════════════════

// Mycelial growth characters (density progression)
const HYPHAE = [" ", "·", "∙", ":", "╌", "─", "┼", "╋", "▓", "█"];
const SPORE_CHARS = ["°", "•", "⊙", "◌", "○", "◦", "∘", "⁘", "⁛"];
const NODE_CHARS = ["◉", "⊛", "✦", "✧", "❋", "✿", "❀", "⚘"];
const TENDRIL_H = ["─", "═", "╌", "╍", "┄", "┈"];
const TENDRIL_V = ["│", "║", "╎", "╏", "┆", "┊"];
const BRANCH_CROSS = ["┤", "├", "┬", "┴", "┼", "╋"];
const BRANCH_CORNER = ["┌", "┐", "└", "┘", "╭", "╮", "╰", "╯"];
const DECAY_CHARS = ["░", "▒", "≈", "~", "˙", "ˑ"];
const GHOST_CHARS = ["᛫", "᛬", "⋅", "⋯", "∵"];

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

// Colony name vocabulary — procedural mycological names
const GENUS = [
  "Amanita", "Tremella", "Cordyceps", "Hericium", "Pleurotus",
  "Ganoderma", "Mycena", "Russula", "Psilocybe", "Cantharellus",
  "Lactarius", "Boletus", "Clavaria", "Trametes", "Polyporus",
  "Hypholoma", "Armillaria", "Coprinus", "Lentinula", "Marasmius",
];
const EPITHET = [
  "Prime", "Nexus", "Cluster", "Node", "Bloom",
  "Crown", "Veil", "Ring", "Thallus", "Axis",
  "Mycel", "Spire", "Root", "Arch", "Core",
  "Haven", "Weave", "Drift", "Pulse", "Deep",
];

function colonyName(idx: number): string {
  return `${GENUS[idx % GENUS.length]} ${EPITHET[Math.floor(idx / GENUS.length) % EPITHET.length]}`;
}

interface SporeTrail {
  x: number;
  y: number;
  age: number; // fading counter
}

interface Spore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  char: string;
  trails: SporeTrail[];
}

interface HyphalNode {
  x: number;
  y: number;
  strength: number;    // 0-1 growth intensity
  connected: number[]; // indices of connected nodes
  wild: boolean;       // seeded by spore collision?
  name: string;        // procedural colony name
  born: number;        // tick of creation
}

// Cellular automaton grid for mycelial growth
interface MycelialField {
  grid: number[][];       // 0-9 density values
  ghost: number[][];      // substrate memory from previous cycles
  nutrient: number[][];   // nutrient richness map (0-1)
  decay: number[][];      // decay timers per cell
  nodes: HyphalNode[];
  spores: Spore[];
  colonies: number;       // planned colony count
  wildColonies: number;   // emergent colony count
  generation: number;
  totalGenerations: number; // across all cycles
  cycleCount: number;      // number of minute resets
}

// Minute transition state
interface TransitionState {
  active: boolean;
  ticksRemaining: number;  // ~24 ticks = 3 seconds at 8fps
  phase: "sporulating" | "rebirth";
}

function createField(w: number, h: number): MycelialField {
  const grid: number[][] = [];
  const ghost: number[][] = [];
  const nutrient: number[][] = [];
  const decay: number[][] = [];
  for (let y = 0; y < h; y++) {
    grid.push(new Array(w).fill(0));
    ghost.push(new Array(w).fill(0));
    nutrient.push(new Array(w).fill(0));
    decay.push(new Array(w).fill(0));
  }
  return {
    grid, ghost, nutrient, decay,
    nodes: [], spores: [],
    colonies: 0, wildColonies: 0,
    generation: 0, totalGenerations: 0,
    cycleCount: 0,
  };
}

// Generate nutrient zones — Perlin-ish noise via superimposed sine waves
function generateNutrients(nutrient: number[][], w: number, h: number, seed: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = Math.sin(x * 0.15 + seed) * Math.cos(y * 0.2 + seed * 0.7);
      const n2 = Math.sin(x * 0.07 - seed * 1.3) * Math.cos(y * 0.11 + seed * 0.4);
      const n3 = Math.sin((x + y) * 0.09 + seed * 2.1);
      nutrient[y][x] = (n1 + n2 + n3 + 3) / 6; // normalise to 0-1
    }
  }
}

// Seed a colony at (cx, cy) with given strength
function seedColony(
  field: MycelialField, cx: number, cy: number,
  strength: number, wild: boolean, tick: number,
): boolean {
  const w = field.grid[0]?.length ?? 0;
  const h = field.grid.length;
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return false;

  // Don't seed too close to existing nodes
  const tooClose = field.nodes.some(
    (n) => Math.abs(n.x - cx) < 3 && Math.abs(n.y - cy) < 2
  );
  if (tooClose) return false;

  field.grid[cy][cx] = Math.min(9, Math.floor(strength * 9));
  const idx = field.nodes.length;
  field.nodes.push({
    x: cx, y: cy,
    strength,
    connected: [],
    wild,
    name: colonyName(idx + field.cycleCount * 7),
    born: tick,
  });
  if (wild) field.wildColonies++;
  else field.colonies++;
  return true;
}

// Grow the mycelium one generation
function growField(field: MycelialField, intensity: number) {
  const h = field.grid.length;
  const w = field.grid[0]?.length ?? 0;
  if (w === 0 || h === 0) return;

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
      const nut = field.nutrient[y]?.[x] ?? 0.5;
      const ghostBoost = (field.ghost[y]?.[x] ?? 0) * 0.15; // ghost residue helps growth

      if (current === 0 && avg > 0.6 - ghostBoost) {
        // colonise empty cell — nutrient zones affect growth threshold
        const threshold = 0.8 - nut * 0.4 - ghostBoost;
        if (avg > threshold) {
          next[y][x] = Math.min(9, Math.floor(avg * intensity * (1.0 + nut * 0.4)));
        }
      } else if (current > 0 && current < 9) {
        // grow existing cell — nutrient-boosted
        const growChance = intensity * (0.2 + nut * 0.2);
        const growth = Math.random() < growChance ? 1 : 0;
        next[y][x] = Math.min(9, current + growth);
      }

      // Decay — max-density cells start decaying after random interval
      if (current >= 8) {
        if (field.decay[y][x] === 0) {
          // Start decay timer — random 20-80 ticks
          field.decay[y][x] = 20 + Math.floor(Math.random() * 60);
        } else {
          field.decay[y][x]--;
          if (field.decay[y][x] <= 0) {
            // Decay! Drop density, feed neighbours
            next[y][x] = Math.max(0, current - 2 - Math.floor(Math.random() * 3));
            field.decay[y][x] = 0;
            // Nutrient boost to neighbours from decay
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = y + dy, nx = x + dx;
                if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                  field.nutrient[ny][nx] = Math.min(1, (field.nutrient[ny]?.[nx] ?? 0) + 0.05);
                }
              }
            }
          }
        }
      }

      // Random tendril extension — nutrient-guided and ghost-guided
      if (current === 0 && Math.random() < intensity * (0.015 + nut * 0.015 + ghostBoost * 0.02)) {
        const nearNode = field.nodes.find(
          (n) => Math.abs(n.x - x) < 5 && Math.abs(n.y - y) < 4
        );
        if (nearNode) {
          next[y][x] = 1;
        }
      }
    }
  }

  field.grid = next;
  field.generation++;
  field.totalGenerations++;
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
      trails: [],
    });
  }
}

// Mass sporulation for minute transition — flood of spores from all cells
function massSporulate(field: MycelialField, w: number, h: number) {
  const h2 = field.grid.length;
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w; x++) {
      if (field.grid[y][x] >= 4 && Math.random() < 0.08) {
        field.spores.push({
          x, y,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 1.2,
          age: 0,
          char: SPORE_CHARS[Math.floor(Math.random() * SPORE_CHARS.length)],
          trails: [],
        });
        // Reduce cell density as it releases spores
        field.grid[y][x] = Math.max(0, field.grid[y][x] - 1);
      }
    }
  }
}

// Drift spores — with trail recording and wild colony seeding
function driftSpores(field: MycelialField, w: number, h: number, tick: number) {
  field.spores = field.spores.filter((s) => {
    // Record trail before moving
    if (s.age > 0 && s.age % 2 === 0) {
      s.trails.push({ x: Math.floor(s.x), y: Math.floor(s.y), age: 0 });
      if (s.trails.length > 6) s.trails.shift(); // max 6 trail points
    }
    // Age trails
    for (const t of s.trails) t.age++;

    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.94; // air resistance
    s.vy *= 0.94;
    s.vx += (Math.random() - 0.5) * 0.35; // brownian
    s.vy += (Math.random() - 0.5) * 0.18;
    s.age++;

    // Wild colony seeding — spores that drift far and land on empty space
    if (s.age > 15 && s.age < 35) {
      const ix = Math.floor(s.x), iy = Math.floor(s.y);
      if (ix >= 1 && ix < w - 1 && iy >= 1 && iy < h - 1) {
        const cellVal = field.grid[iy]?.[ix] ?? 0;
        const nearestNodeDist = field.nodes.reduce((min, n) => {
          const d = Math.abs(n.x - ix) + Math.abs(n.y - iy);
          return d < min ? d : min;
        }, Infinity);
        // Seed wild colony if far from any node and on empty ground
        if (cellVal === 0 && nearestNodeDist > 8 && Math.random() < 0.04) {
          if (seedColony(field, ix, iy, 0.4 + Math.random() * 0.3, true, tick)) {
            return false; // spore consumed
          }
        }
      }
    }

    return s.age < 45 && s.x >= 0 && s.x < w && s.y >= 0 && s.y < h;
  });
}

// Hex colour to RGB
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Blend two colour strings (hex or named) — simple RGB lerp
function blendColours(a: string, b: string, t: number): string {
  // Named colour fallback map
  const named: Record<string, string> = { blue: "#0000ff", white: "#ffffff", grey: "#808080" };
  const ha = named[a] ?? a;
  const hb = named[b] ?? b;
  const ra = hexToRgb(ha), rb = hexToRgb(hb);
  if (!ra || !rb) return a;
  const r = ra[0] + (rb[0] - ra[0]) * t;
  const g = ra[1] + (rb[1] - ra[1]) * t;
  const bl = ra[2] + (rb[2] - ra[2]) * t;
  return rgbToHex(r, g, bl);
}

// Get blended colony colour based on current time — smooth circadian transition
function getCircadianColour(now: Date): string {
  const h = now.getHours();
  const m = now.getMinutes();
  const colonyIdx = Math.floor(h / 2);
  const nextIdx = (colonyIdx + 1) % 12;

  // Position within the 2-hour block (0-1)
  const blockMinutes = (h % 2) * 60 + m;
  const blockProgress = blockMinutes / 120;

  // Blend in the last 15 minutes of each block
  if (blockProgress > 0.875) {
    const blendT = (blockProgress - 0.875) / 0.125; // 0→1 over last 15 min
    return blendColours(
      COLONY_COLOURS[colonyIdx] ?? "white",
      COLONY_COLOURS[nextIdx] ?? "white",
      blendT,
    );
  }
  return COLONY_COLOURS[colonyIdx] ?? "white";
}

// Render the field to a string
function renderField(
  field: MycelialField,
  w: number,
  h: number,
  tick: number,
  seconds: number,
): string {
  // Build spore position lookup for O(1) access instead of O(n) find()
  const sporeMap = new Map<number, Spore>();
  for (const s of field.spores) {
    const key = Math.floor(s.y) * w + Math.floor(s.x);
    sporeMap.set(key, s);
  }

  // Build trail lookup
  const trailMap = new Map<number, number>(); // key → oldest age (for fading)
  for (const s of field.spores) {
    for (const t of s.trails) {
      if (t.age < 10) {
        const key = t.y * w + t.x;
        const existing = trailMap.get(key);
        if (existing === undefined || t.age < existing) {
          trailMap.set(key, t.age);
        }
      }
    }
  }

  // Build node position lookup
  const nodeMap = new Map<number, HyphalNode>();
  for (const n of field.nodes) {
    nodeMap.set(n.y * w + n.x, n);
  }

  const lines: string[] = [];

  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const key = y * w + x;

      // Check for spore at this position
      const spore = sporeMap.get(key);
      if (spore) {
        line += spore.age < 10 ? spore.char : spore.age < 25 ? "·" : " ";
        continue;
      }

      // Check for spore trail
      const trailAge = trailMap.get(key);
      if (trailAge !== undefined) {
        const density = field.grid[y]?.[x] ?? 0;
        if (density === 0) {
          line += trailAge < 3 ? "·" : trailAge < 6 ? "⋅" : "᛫";
          continue;
        }
      }

      // Check for node at this position
      const node = nodeMap.get(key);
      if (node) {
        // Heartbeat pulse — sin wave modulates node glyph selection
        const pulseSpeed = node.wild ? 3.5 : 2.0;
        const pulse = Math.sin(tick * 0.15 * pulseSpeed + node.x * 0.3 + node.y * 0.2) * 0.5 + 0.5;
        const ni = Math.floor(pulse * (NODE_CHARS.length - 1));
        line += NODE_CHARS[ni];
        continue;
      }

      // Mycelial density
      const density = field.grid[y]?.[x] ?? 0;
      if (density > 0) {
        // Decay visualization
        if (field.decay[y]?.[x] > 0 && field.decay[y][x] < 10 && density >= 7) {
          line += DECAY_CHARS[Math.floor(Math.random() * DECAY_CHARS.length)];
          continue;
        }

        // Contextual box-drawing for mid-density cells
        if (density >= 2 && density <= 6) {
          const leftD = field.grid[y]?.[x - 1] ?? 0;
          const rightD = field.grid[y]?.[x + 1] ?? 0;
          const upD = field.grid[y - 1]?.[x] ?? 0;
          const downD = field.grid[y + 1]?.[x] ?? 0;
          const connections = (leftD > 0 ? 1 : 0) + (rightD > 0 ? 1 : 0) +
                              (upD > 0 ? 1 : 0) + (downD > 0 ? 1 : 0);

          if (connections >= 3) {
            line += BRANCH_CROSS[density % BRANCH_CROSS.length];
            continue;
          } else if (leftD > 0 && rightD > 0) {
            line += TENDRIL_H[density % TENDRIL_H.length];
            continue;
          } else if (upD > 0 && downD > 0) {
            line += TENDRIL_V[density % TENDRIL_V.length];
            continue;
          } else if (connections === 2) {
            // Corner pieces
            const ci = ((leftD > 0 || rightD > 0) ? 1 : 0) + ((upD > 0) ? 2 : 0);
            line += BRANCH_CORNER[ci % BRANCH_CORNER.length];
            continue;
          }
        }
        line += HYPHAE[density];
      } else {
        // Ghost residue from previous cycles
        const ghostVal = field.ghost[y]?.[x] ?? 0;
        if (ghostVal > 0) {
          line += GHOST_CHARS[Math.min(ghostVal - 1, GHOST_CHARS.length - 1)];
        } else {
          line += " ";
        }
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
  return `${names[colonyIdx]}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}  ▓${density}%`;
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
  let nutrientSeed = Math.random() * 100;
  const transition: TransitionState = { active: false, ticksRemaining: 0, phase: "sporulating" };

  function getContentSize(): { w: number; h: number } {
    const w = Math.max(8, (Number(canvas.width) || 40));
    const h = Math.max(4, (Number(canvas.height) || 20));
    return { w, h };
  }

  function resetField(preserveMemory: boolean) {
    const { w, h } = getContentSize();

    // Save ghost layer from old field (substrate memory)
    let oldGhost: number[][] | null = null;
    let oldCycleCount = 0;
    let oldTotalGen = 0;
    if (preserveMemory && field) {
      const oh = field.grid.length;
      const ow = field.grid[0]?.length ?? 0;
      oldGhost = [];
      for (let y = 0; y < Math.min(oh, h); y++) {
        const row: number[] = [];
        for (let x = 0; x < Math.min(ow, w); x++) {
          // Accumulate: old ghost + 10% of current density
          const prev = field.ghost[y]?.[x] ?? 0;
          const curr = field.grid[y]?.[x] ?? 0;
          row.push(Math.min(5, prev + (curr > 3 ? 1 : 0)));
        }
        oldGhost.push(row);
      }
      oldCycleCount = field.cycleCount;
      oldTotalGen = field.totalGenerations;
    }

    field = createField(w, h);
    field.cycleCount = oldCycleCount + (preserveMemory ? 1 : 0);
    field.totalGenerations = oldTotalGen;

    // Restore ghost layer
    if (oldGhost) {
      for (let y = 0; y < Math.min(oldGhost.length, h); y++) {
        for (let x = 0; x < Math.min(oldGhost[y].length, w); x++) {
          field.ghost[y][x] = oldGhost[y][x];
        }
      }
    }

    // Generate nutrient zones — rotate slowly over time
    nutrientSeed += 0.3;
    generateNutrients(field.nutrient, w, h, nutrientSeed);

    const now = new Date();
    const m = now.getMinutes();

    // Fibonacci-inspired seed spacing — golden angle distribution
    const numSeeds = 3 + Math.floor(m / 12);
    const goldenAngle = 137.508 * (Math.PI / 180);
    for (let i = 0; i < numSeeds; i++) {
      const angle = i * goldenAngle + (now.getHours() * 0.5);
      const radius = Math.min(w, h) * (0.2 + (i / numSeeds) * 0.2);
      const cx = Math.floor(w / 2 + Math.cos(angle) * radius);
      const cy = Math.floor(h / 2 + Math.sin(angle) * radius * 0.5);
      seedColony(field, cx, cy, 0.5 + Math.random() * 0.5, false, tick);
    }

    // Centre node (always)
    seedColony(field, Math.floor(w / 2), Math.floor(h / 2), 1.0, false, tick);
  }

  function updateDisplay() {
    if (!field) return;
    const now = new Date();
    const { w, h } = getContentSize();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Minute transition handling
    if (minutes !== lastMinute && lastMinute !== -1) {
      if (!transition.active) {
        // Start sporulation phase
        transition.active = true;
        transition.phase = "sporulating";
        transition.ticksRemaining = 20; // ~2.5s of sporulation
      }
    }

    if (transition.active) {
      transition.ticksRemaining--;
      if (transition.phase === "sporulating") {
        // Mass sporulate — old field releases spores
        massSporulate(field!, w, h);
        driftSpores(field!, w, h, tick);

        if (transition.ticksRemaining <= 0) {
          // Save spores, reset field, restore spores (death feeds birth)
          const savedSpores = [...field!.spores];
          lastMinute = minutes;
          resetField(true); // preserve substrate memory
          field!.spores = savedSpores;
          transition.phase = "rebirth";
          transition.ticksRemaining = 8; // ~1s rebirth settling
        }
      } else {
        // Rebirth phase — spores can seed wild colonies during this
        driftSpores(field!, w, h, tick);
        if (transition.ticksRemaining <= 0) {
          transition.active = false;
        }
      }
    } else {
      // Normal operation — reset field on first run
      if (lastMinute === -1) {
        lastMinute = minutes;
        resetField(false);
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
      driftSpores(field!, w, h, tick);
    }

    // Get blended colony colour
    const colour = getCircadianColour(now);

    // Render
    const rendered = renderField(field!, w, h, tick, seconds);
    canvas.setContent(rendered);
    canvas.style = { fg: colour, bg: host.theme().body.bg };

    // Separator line — breathing separator
    const sepPulse = Math.sin(tick * 0.08) * 0.5 + 0.5;
    const sepIdx = Math.floor(sepPulse * (TENDRIL_H.length - 1));
    const sepChar = TENDRIL_H[sepIdx];
    sep.setContent(sepChar.repeat(w));
    sep.style = { fg: colour, bg: host.theme().body.bg };

    // Enhanced status bar
    const wildCount = field!.wildColonies;
    const wildStr = wildCount > 0 ? `  wild:${wildCount}` : "";
    const cycleStr = field!.cycleCount > 0 ? `  cycle:${field!.cycleCount}` : "";
    const transStr = transition.active
      ? `  ${transition.phase === "sporulating" ? "⟡ SPORULATING" : "⟡ REBIRTH"}`
      : "";
    status.setContent(
      ` ${fungalTime(now)}  gen:${field!.generation}  ◦${field!.spores.length}  ◉${field!.nodes.length}${wildStr}${cycleStr}${transStr}`
    );

    host.screen.render();
    tick++;
  }

  resetField(false);

  // Main animation loop — ~8fps for organic feel
  createTimer(() => {
    updateDisplay();
  }, 125, timers);

  win.onResize(() => {
    resetField(false); // full reset on resize (dimensions changed)
    updateDisplay();
  });

  win.describeState(() => {
    const now = new Date();
    const nodeNames = (field?.nodes ?? []).map((n) => ({
      name: n.name,
      position: { x: n.x, y: n.y },
      wild: n.wild,
      strength: n.strength,
    }));
    return {
      summary: `Spore Clock — ${fungalTime(now)}`,
      generation: field?.generation ?? 0,
      totalGenerations: field?.totalGenerations ?? 0,
      sporeCount: field?.spores.length ?? 0,
      nodeCount: field?.nodes.length ?? 0,
      plannedColonies: field?.colonies ?? 0,
      wildColonies: field?.wildColonies ?? 0,
      cycleCount: field?.cycleCount ?? 0,
      colonies: nodeNames,
      transitioning: transition.active ? transition.phase : "none",
      colour: getCircadianColour(now),
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
