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
// Hours  → dominant colony colour (circadian blending)
// Minutes → hyphal reach (network density)
// Seconds → spore drift particles + second-pulse ring
//
// Features: substrate memory, wild colonies, nutrient zones,
// decay/competition, spore trails, minute sporulation,
// colony ownership tracking, boundary competition,
// seasonal growth rates, network edges, heartbeat pulse.
// ═══════════════════════════════════════════════════════════════

// Mycelial growth characters — density 0-9
const HYPHAE = [" ", "·", "∙", ":", "╌", "─", "┼", "╋", "▓", "█"];
// Spore particle glyphs
const SPORE_CHARS = ["°", "•", "⊙", "◌", "○", "◦", "∘", "⁘", "⁛"];
// Colony node glyphs — pulsing heartbeat cycles through these
const NODE_CHARS = ["◉", "⊛", "✦", "✧", "❋", "✿", "❀", "⚘"];
// Wild colony node glyphs — distinct from planned colonies
const WILD_NODE_CHARS = ["◈", "⊕", "⊗", "⊘", "◇", "◆"];
// Horizontal tendrils — contextual box-drawing
const TENDRIL_H = ["─", "═", "╌", "╍", "┄", "┈"];
// Vertical tendrils
const TENDRIL_V = ["│", "║", "╎", "╏", "┆", "┊"];
// Junction glyphs for 3-4 connections
const BRANCH_CROSS = ["┤", "├", "┬", "┴", "┼", "╋"];
// Corner glyphs for exactly 2 perpendicular connections
const BRANCH_CORNER = ["┌", "┐", "└", "┘", "╭", "╮", "╰", "╯"];
// Decay visualisation — cells breaking down
const DECAY_CHARS = ["░", "▒", "≈", "~", "˙", "ˑ"];
// Ghost residue — faint marks from previous cycles
const GHOST_CHARS = ["᛫", "᛬", "⋅", "⋯", "∵"];
// Boundary competition — where two colonies meet
const BOUNDARY_CHARS = ["⁂", "※", "⁑", "∗", "⊹"];
// Network edge glyphs — visible connections between nodes
const EDGE_H = "╶";
const EDGE_V = "╵";
const EDGE_DIAG = ["╲", "╱"];
// Second-pulse ring — expanding ring marks seconds
const PULSE_CHARS = ["○", "◯", "◎", "●"];

// Colony colour palette — one per 2-hour block (12 colonies per day)
// Seasonal biome aesthetics: night→dawn→morning→midday→afternoon→evening→night
const COLONY_COLOURS = [
  "#1a237e",   // 00-01  deep night indigo
  "#4a6fa5",   // 02-03  predawn steel blue
  "#7b68ee",   // 04-05  violet dawn
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

// Seasonal growth rate multipliers — mapped to time of day
const SEASONAL_GROWTH = [
  0.5, 0.6, 0.8, 1.0, 1.2, 1.1,  // 00-11: night→morning ramp
  1.0, 1.3, 1.2, 0.9, 0.7, 0.5,  // 12-23: afternoon→night ramp
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
  age: number;
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
  strength: number;
  connected: number[];
  wild: boolean;
  name: string;
  born: number;
  owner: number; // colony index for ownership tracking
}

interface MycelialField {
  grid: number[][];
  owner: number[][];    // which colony owns each cell (-1 = none)
  ghost: number[][];
  nutrient: number[][];
  decay: number[][];
  nodes: HyphalNode[];
  spores: Spore[];
  colonies: number;
  wildColonies: number;
  generation: number;
  totalGenerations: number;
  cycleCount: number;
  competitionEvents: number; // count of boundary conflicts
}

interface TransitionState {
  active: boolean;
  ticksRemaining: number;
  phase: "sporulating" | "rebirth";
}

// Second pulse — expanding ring from centre
interface PulseRing {
  cx: number;
  cy: number;
  radius: number;
  maxRadius: number;
  age: number;
}

function createField(w: number, h: number): MycelialField {
  const grid: number[][] = [];
  const owner: number[][] = [];
  const ghost: number[][] = [];
  const nutrient: number[][] = [];
  const decay: number[][] = [];
  for (let y = 0; y < h; y++) {
    grid.push(new Array(w).fill(0));
    owner.push(new Array(w).fill(-1));
    ghost.push(new Array(w).fill(0));
    nutrient.push(new Array(w).fill(0));
    decay.push(new Array(w).fill(0));
  }
  return {
    grid, owner, ghost, nutrient, decay,
    nodes: [], spores: [],
    colonies: 0, wildColonies: 0,
    generation: 0, totalGenerations: 0,
    cycleCount: 0, competitionEvents: 0,
  };
}

// Generate nutrient zones — Perlin-ish noise via superimposed sine waves
function generateNutrients(nutrient: number[][], w: number, h: number, seed: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = Math.sin(x * 0.15 + seed) * Math.cos(y * 0.2 + seed * 0.7);
      const n2 = Math.sin(x * 0.07 - seed * 1.3) * Math.cos(y * 0.11 + seed * 0.4);
      const n3 = Math.sin((x + y) * 0.09 + seed * 2.1);
      nutrient[y][x] = (n1 + n2 + n3 + 3) / 6;
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

  const tooClose = field.nodes.some(
    (n) => Math.abs(n.x - cx) < 3 && Math.abs(n.y - cy) < 2
  );
  if (tooClose) return false;

  const colonyIdx = field.nodes.length;
  field.grid[cy][cx] = Math.min(9, Math.floor(strength * 9));
  field.owner[cy][cx] = colonyIdx;
  field.nodes.push({
    x: cx, y: cy,
    strength,
    connected: [],
    wild,
    name: colonyName(colonyIdx + field.cycleCount * 7),
    born: tick,
    owner: colonyIdx,
  });
  if (wild) field.wildColonies++;
  else field.colonies++;
  return true;
}

// Find nearest node to a position
function nearestNode(field: MycelialField, x: number, y: number): number {
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < field.nodes.length; i++) {
    const n = field.nodes[i];
    const d = Math.abs(n.x - x) + Math.abs(n.y - y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Grow the mycelium one generation with ownership tracking and competition
function growField(field: MycelialField, intensity: number, seasonalRate: number) {
  const h = field.grid.length;
  const w = field.grid[0]?.length ?? 0;
  if (w === 0 || h === 0) return;

  const effectiveIntensity = intensity * seasonalRate;

  const next: number[][] = [];
  const nextOwner: number[][] = [];
  for (let y = 0; y < h; y++) {
    next.push([...field.grid[y]]);
    nextOwner.push([...field.owner[y]]);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const neighbours =
        field.grid[y - 1][x - 1] + field.grid[y - 1][x] + field.grid[y - 1][x + 1] +
        field.grid[y][x - 1] + field.grid[y][x + 1] +
        field.grid[y + 1][x - 1] + field.grid[y + 1][x] + field.grid[y + 1][x + 1];

      const avg = neighbours / 8;
      const current = field.grid[y][x];
      const currentOwner = field.owner[y][x];
      const nut = field.nutrient[y]?.[x] ?? 0.5;
      const ghostBoost = (field.ghost[y]?.[x] ?? 0) * 0.1;

      if (current === 0) {
        // Colonise empty cell — needs enough neighbour pressure
        // Higher threshold = sparser, more organic growth
        const threshold = 1.2 - nut * 0.3 - ghostBoost;
        if (avg > threshold && Math.random() < effectiveIntensity * 0.6) {
          // New cells start low — texture comes from varied density
          next[y][x] = Math.min(5, Math.max(1, Math.floor(avg * effectiveIntensity * 0.6)));
          // Inherit ownership from dominant neighbour
          const ownerCounts = new Map<number, number>();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dy === 0 && dx === 0) continue;
              const o = field.owner[y + dy]?.[x + dx] ?? -1;
              if (o >= 0) ownerCounts.set(o, (ownerCounts.get(o) ?? 0) + 1);
            }
          }
          let maxO = -1, maxC = 0;
          for (const [o, c] of ownerCounts) {
            if (c > maxC) { maxO = o; maxC = c; }
          }
          nextOwner[y][x] = maxO;
        }
      } else if (current > 0 && current < 7) {
        // Grow existing — cap at 7 for most cells (reserves 8-9 for dense clusters)
        const growChance = effectiveIntensity * (0.12 + nut * 0.12);
        if (Math.random() < growChance) {
          next[y][x] = current + 1;
        }
      } else if (current === 7 && avg > 5.5) {
        // Only the densest clusters reach 8-9 — creates natural variation
        if (Math.random() < effectiveIntensity * 0.08) {
          next[y][x] = Math.min(9, current + 1);
        }
      }

      // Boundary competition — adjacent cells with different owners
      if (current > 0 && currentOwner >= 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy, nx = x + dx;
            const otherOwner = field.owner[ny]?.[nx] ?? -1;
            const otherDensity = field.grid[ny]?.[nx] ?? 0;
            if (otherOwner >= 0 && otherOwner !== currentOwner && otherDensity > 0) {
              if (current > otherDensity + 1 && Math.random() < 0.03) {
                nextOwner[ny][nx] = currentOwner;
                next[ny][nx] = Math.max(1, otherDensity - 1);
                field.competitionEvents++;
              }
            }
          }
        }
      }

      // Decay — cells above 6 start decaying sooner for more visual churn
      if (current >= 6) {
        if (field.decay[y][x] === 0) {
          // Higher density = faster decay onset
          const decayDelay = current >= 8 ? 15 + Math.floor(Math.random() * 30) :
                             current >= 7 ? 30 + Math.floor(Math.random() * 50) :
                             50 + Math.floor(Math.random() * 80);
          field.decay[y][x] = decayDelay;
        } else {
          field.decay[y][x]--;
          if (field.decay[y][x] <= 0) {
            const drop = 1 + Math.floor(Math.random() * 3);
            next[y][x] = Math.max(0, current - drop);
            field.decay[y][x] = 0;
            if (next[y][x] === 0) nextOwner[y][x] = -1;
            for (let dy2 = -1; dy2 <= 1; dy2++) {
              for (let dx2 = -1; dx2 <= 1; dx2++) {
                const ny2 = y + dy2, nx2 = x + dx2;
                if (ny2 >= 0 && ny2 < h && nx2 >= 0 && nx2 < w) {
                  field.nutrient[ny2][nx2] = Math.min(1, (field.nutrient[ny2]?.[nx2] ?? 0) + 0.06);
                }
              }
            }
          }
        }
      }

      // Random tendril extension — creates organic fingers
      if (current === 0 && Math.random() < effectiveIntensity * (0.008 + nut * 0.008 + ghostBoost * 0.01)) {
        const ni = nearestNode(field, x, y);
        if (ni >= 0) {
          const n = field.nodes[ni];
          const dist = Math.abs(n.x - x) + Math.abs(n.y - y);
          // Tendrils reach further but get thinner
          if (dist < 7) {
            next[y][x] = dist < 3 ? 2 : 1;
            nextOwner[y][x] = ni;
          }
        }
      }
    }
  }

  field.grid = next;
  field.owner = nextOwner;
  field.generation++;
  field.totalGenerations++;

  // Connect nearby nodes that have grown towards each other
  for (let i = 0; i < field.nodes.length; i++) {
    for (let j = i + 1; j < field.nodes.length; j++) {
      if (field.nodes[i].connected.includes(j)) continue;
      const ni = field.nodes[i], nj = field.nodes[j];
      const dist = Math.abs(ni.x - nj.x) + Math.abs(ni.y - nj.y);
      if (dist < 15) {
        // Check if there's a path of nonzero cells between them (sampled at midpoint + quarters)
        const mx = Math.floor((ni.x + nj.x) / 2);
        const my = Math.floor((ni.y + nj.y) / 2);
        const qx1 = Math.floor((ni.x * 3 + nj.x) / 4);
        const qy1 = Math.floor((ni.y * 3 + nj.y) / 4);
        if ((field.grid[my]?.[mx] ?? 0) > 0 && (field.grid[qy1]?.[qx1] ?? 0) > 0) {
          field.nodes[i].connected.push(j);
          field.nodes[j].connected.push(i);
        }
      }
    }
  }
}

// Emit spores from active nodes
function emitSpores(field: MycelialField, count: number, w: number, h: number) {
  const maxSpores = 80; // prevent unbounded growth
  if (field.spores.length >= maxSpores) return;

  for (let i = 0; i < count && field.spores.length < maxSpores; i++) {
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

// Mass sporulation for minute transition
function massSporulate(field: MycelialField, w: number, _h: number) {
  const fh = field.grid.length;
  for (let y = 0; y < fh; y++) {
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
        field.grid[y][x] = Math.max(0, field.grid[y][x] - 1);
      }
    }
  }
}

// Drift spores — with trail recording and wild colony seeding
function driftSpores(field: MycelialField, w: number, h: number, tick: number) {
  field.spores = field.spores.filter((s) => {
    if (s.age > 0 && s.age % 2 === 0) {
      s.trails.push({ x: Math.floor(s.x), y: Math.floor(s.y), age: 0 });
      if (s.trails.length > 6) s.trails.shift();
    }
    for (const t of s.trails) t.age++;

    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.94;
    s.vy *= 0.94;
    s.vx += (Math.random() - 0.5) * 0.35;
    s.vy += (Math.random() - 0.5) * 0.18;
    s.age++;

    // Wild colony seeding
    if (s.age > 15 && s.age < 35) {
      const ix = Math.floor(s.x), iy = Math.floor(s.y);
      if (ix >= 1 && ix < w - 1 && iy >= 1 && iy < h - 1) {
        const cellVal = field.grid[iy]?.[ix] ?? 0;
        const nearestDist = field.nodes.reduce((min, n) => {
          const d = Math.abs(n.x - ix) + Math.abs(n.y - iy);
          return d < min ? d : min;
        }, Infinity);
        if (cellVal === 0 && nearestDist > 8 && Math.random() < 0.04) {
          if (seedColony(field, ix, iy, 0.4 + Math.random() * 0.3, true, tick)) {
            return false;
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

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function blendColours(a: string, b: string, t: number): string {
  const named: Record<string, string> = { blue: "#0000ff", white: "#ffffff", grey: "#808080" };
  const ha = named[a] ?? a;
  const hb = named[b] ?? b;
  const ra = hexToRgb(ha), rb = hexToRgb(hb);
  if (!ra || !rb) return a;
  return rgbToHex(
    ra[0] + (rb[0] - ra[0]) * t,
    ra[1] + (rb[1] - ra[1]) * t,
    ra[2] + (rb[2] - ra[2]) * t,
  );
}

function getCircadianColour(now: Date): string {
  const h = now.getHours();
  const m = now.getMinutes();
  const colonyIdx = Math.floor(h / 2);
  const nextIdx = (colonyIdx + 1) % 12;
  const blockMinutes = (h % 2) * 60 + m;
  const blockProgress = blockMinutes / 120;

  if (blockProgress > 0.875) {
    const blendT = (blockProgress - 0.875) / 0.125;
    return blendColours(
      COLONY_COLOURS[colonyIdx] ?? "#ffffff",
      COLONY_COLOURS[nextIdx] ?? "#ffffff",
      blendT,
    );
  }
  return COLONY_COLOURS[colonyIdx] ?? "#ffffff";
}

// Check if (x,y) is on the boundary between two colony owners
function isBoundary(field: MycelialField, x: number, y: number, w: number, h: number): boolean {
  const myOwner = field.owner[y]?.[x] ?? -1;
  if (myOwner < 0) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dy === 0 && dx === 0) continue;
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
        const other = field.owner[ny]?.[nx] ?? -1;
        if (other >= 0 && other !== myOwner) return true;
      }
    }
  }
  return false;
}

// Render the field to a string
function renderField(
  field: MycelialField,
  w: number,
  h: number,
  tick: number,
  _seconds: number,
  pulseRings: PulseRing[],
): string {
  // Build lookup maps for O(1) access
  const sporeMap = new Map<number, Spore>();
  for (const s of field.spores) {
    const key = Math.floor(s.y) * w + Math.floor(s.x);
    sporeMap.set(key, s);
  }

  const trailMap = new Map<number, number>();
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

  const nodeMap = new Map<number, HyphalNode>();
  for (const n of field.nodes) {
    nodeMap.set(n.y * w + n.x, n);
  }

  // Build edge map — for drawing connections between nodes
  const edgeMap = new Set<number>();
  for (const n of field.nodes) {
    for (const ci of n.connected) {
      const other = field.nodes[ci];
      if (!other) continue;
      // Draw a few points along the edge
      const steps = Math.max(Math.abs(other.x - n.x), Math.abs(other.y - n.y));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const ex = Math.round(n.x + (other.x - n.x) * t);
        const ey = Math.round(n.y + (other.y - n.y) * t);
        if (ex >= 0 && ex < w && ey >= 0 && ey < h) {
          edgeMap.add(ey * w + ex);
        }
      }
    }
  }

  // Build pulse ring map
  const pulseMap = new Map<number, number>(); // key → ring index for char selection
  for (const ring of pulseRings) {
    const r = Math.floor(ring.radius);
    // Draw circle using midpoint algorithm
    for (let angle = 0; angle < 64; angle++) {
      const a = (angle / 64) * Math.PI * 2;
      const px = Math.round(ring.cx + Math.cos(a) * r * 1.8); // stretch horizontally for terminal chars
      const py = Math.round(ring.cy + Math.sin(a) * r);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        pulseMap.set(py * w + px, ring.age);
      }
    }
  }

  const lines: string[] = [];

  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const key = y * w + x;

      // Pulse rings (highest priority visual)
      const pulseAge = pulseMap.get(key);
      if (pulseAge !== undefined && (field.grid[y]?.[x] ?? 0) === 0) {
        const pi = Math.min(pulseAge, PULSE_CHARS.length - 1);
        line += PULSE_CHARS[pi];
        continue;
      }

      // Spore at this position
      const spore = sporeMap.get(key);
      if (spore) {
        line += spore.age < 10 ? spore.char : spore.age < 25 ? "·" : " ";
        continue;
      }

      // Spore trail
      const trailAge = trailMap.get(key);
      if (trailAge !== undefined && (field.grid[y]?.[x] ?? 0) === 0) {
        line += trailAge < 3 ? "·" : trailAge < 6 ? "⋅" : "᛫";
        continue;
      }

      // Node at this position
      const node = nodeMap.get(key);
      if (node) {
        const pulseSpeed = node.wild ? 3.5 : 2.0;
        const pulse = Math.sin(tick * 0.15 * pulseSpeed + node.x * 0.3 + node.y * 0.2) * 0.5 + 0.5;
        if (node.wild) {
          const ni = Math.floor(pulse * (WILD_NODE_CHARS.length - 1));
          line += WILD_NODE_CHARS[ni];
        } else {
          const ni = Math.floor(pulse * (NODE_CHARS.length - 1));
          line += NODE_CHARS[ni];
        }
        continue;
      }

      // Mycelial density
      const density = field.grid[y]?.[x] ?? 0;
      if (density > 0) {
        // Boundary between competing colonies
        if (density >= 2 && isBoundary(field, x, y, w, h)) {
          const bi = (tick + x + y) % BOUNDARY_CHARS.length;
          line += BOUNDARY_CHARS[bi];
          continue;
        }

        // Decay visualization
        if (field.decay[y]?.[x] > 0 && field.decay[y][x] < 10 && density >= 7) {
          line += DECAY_CHARS[Math.floor(Math.random() * DECAY_CHARS.length)];
          continue;
        }

        // Contextual box-drawing for mid-density
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
            // Determine corner type based on which two are connected
            const cornerIdx =
              (rightD > 0 && downD > 0) ? 0 :
              (leftD > 0 && downD > 0) ? 1 :
              (rightD > 0 && upD > 0) ? 2 :
              3; // left+up
            line += BRANCH_CORNER[cornerIdx];
            continue;
          }
        }
        line += HYPHAE[density];
      } else {
        // Network edge visualization (faint connections between nodes)
        if (edgeMap.has(key)) {
          line += EDGE_H;
          continue;
        }

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
  // Minutes progress as a visual bar
  const barLen = 10;
  const filled = Math.floor((m / 60) * barLen);
  const bar = "▓".repeat(filled) + "░".repeat(barLen - filled);
  return `${names[colonyIdx]}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}  ${bar}  ${density}%`;
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

  const canvas = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 2,
    style: host.theme().body,
    tags: false,
  });

  const status = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  const sep = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    content: "",
    style: host.theme().body,
    tags: false,
  });

  let field: MycelialField | null = null;
  let lastMinute = -1;
  let lastSecond = -1;
  let tick = 0;
  let nutrientSeed = Math.random() * 100;
  const transition: TransitionState = { active: false, ticksRemaining: 0, phase: "sporulating" };
  const pulseRings: PulseRing[] = [];

  function getContentSize(): { w: number; h: number } {
    const w = Math.max(8, (Number(canvas.width) || 40));
    const h = Math.max(4, (Number(canvas.height) || 20));
    return { w, h };
  }

  function resetField(preserveMemory: boolean) {
    const { w, h } = getContentSize();

    let oldGhost: number[][] | null = null;
    let oldCycleCount = 0;
    let oldTotalGen = 0;
    let oldCompetition = 0;
    if (preserveMemory && field) {
      const oh = field.grid.length;
      const ow = field.grid[0]?.length ?? 0;
      oldGhost = [];
      for (let y = 0; y < Math.min(oh, h); y++) {
        const row: number[] = [];
        for (let x = 0; x < Math.min(ow, w); x++) {
          const prev = field.ghost[y]?.[x] ?? 0;
          const curr = field.grid[y]?.[x] ?? 0;
          row.push(Math.min(5, prev + (curr > 3 ? 1 : 0)));
        }
        oldGhost.push(row);
      }
      oldCycleCount = field.cycleCount;
      oldTotalGen = field.totalGenerations;
      oldCompetition = field.competitionEvents;
    }

    field = createField(w, h);
    field.cycleCount = oldCycleCount + (preserveMemory ? 1 : 0);
    field.totalGenerations = oldTotalGen;
    field.competitionEvents = oldCompetition;

    if (oldGhost) {
      for (let y = 0; y < Math.min(oldGhost.length, h); y++) {
        for (let x = 0; x < Math.min(oldGhost[y].length, w); x++) {
          field.ghost[y][x] = oldGhost[y][x];
        }
      }
    }

    nutrientSeed += 0.3;
    generateNutrients(field.nutrient, w, h, nutrientSeed);

    const now = new Date();
    const m = now.getMinutes();

    // Fibonacci seed spacing — golden angle distribution
    // Fewer seeds = more space between colonies = more visible structure
    const numSeeds = 2 + Math.floor(m / 20);
    const goldenAngle = 137.508 * (Math.PI / 180);
    for (let i = 0; i < numSeeds; i++) {
      const angle = i * goldenAngle + (now.getHours() * 0.5);
      // Wider radius spread for better spacing
      const radius = Math.min(w, h) * (0.15 + (i / numSeeds) * 0.35);
      const cx = Math.floor(w / 2 + Math.cos(angle) * radius);
      const cy = Math.floor(h / 2 + Math.sin(angle) * radius * 0.45);
      seedColony(field, cx, cy, 0.4 + Math.random() * 0.4, false, tick);
    }

    seedColony(field, Math.floor(w / 2), Math.floor(h / 2), 0.8, false, tick);
  }

  function updateDisplay() {
    if (!field) return;
    const now = new Date();
    const { w, h } = getContentSize();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Second pulse — emit expanding ring every few seconds
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      if (seconds % 5 === 0 && field.nodes.length > 0) {
        // Pulse from a random node
        const src = field.nodes[Math.floor(Math.random() * field.nodes.length)];
        pulseRings.push({
          cx: src.x, cy: src.y,
          radius: 0, maxRadius: Math.min(w, h) * 0.3,
          age: 0,
        });
      }
    }

    // Update pulse rings
    for (const ring of pulseRings) {
      ring.radius += 0.4;
      ring.age = Math.min(3, Math.floor(ring.radius / 3));
    }
    // Remove completed rings
    const activeRings = pulseRings.filter(r => r.radius < r.maxRadius);
    pulseRings.length = 0;
    pulseRings.push(...activeRings);

    // Minute transition handling
    if (minutes !== lastMinute && lastMinute !== -1) {
      if (!transition.active) {
        transition.active = true;
        transition.phase = "sporulating";
        transition.ticksRemaining = 20;
      }
    }

    if (transition.active) {
      transition.ticksRemaining--;
      if (transition.phase === "sporulating") {
        massSporulate(field!, w, h);
        driftSpores(field!, w, h, tick);

        if (transition.ticksRemaining <= 0) {
          const savedSpores = [...field!.spores];
          lastMinute = minutes;
          resetField(true);
          field!.spores = savedSpores;
          transition.phase = "rebirth";
          transition.ticksRemaining = 8;
        }
      } else {
        driftSpores(field!, w, h, tick);
        if (transition.ticksRemaining <= 0) {
          transition.active = false;
        }
      }
    } else {
      if (lastMinute === -1) {
        lastMinute = minutes;
        resetField(false);
      }

      const minuteProgress = seconds / 60;
      const intensity = 0.2 + minuteProgress * 0.8;
      const seasonalIdx = Math.floor(now.getHours() / 2);
      const seasonalRate = SEASONAL_GROWTH[seasonalIdx] ?? 1.0;

      growField(field!, intensity, seasonalRate);

      const sporeRate = Math.floor(seconds / 10) + 1;
      if (tick % 3 === 0) {
        emitSpores(field!, sporeRate, w, h);
      }
      driftSpores(field!, w, h, tick);
    }

    const colour = getCircadianColour(now);

    const rendered = renderField(field!, w, h, tick, seconds, pulseRings);
    canvas.setContent(rendered);
    canvas.style = { fg: colour, bg: host.theme().body.bg };

    // Breathing separator
    const sepPulse = Math.sin(tick * 0.08) * 0.5 + 0.5;
    const sepIdx = Math.floor(sepPulse * (TENDRIL_H.length - 1));
    sep.setContent(TENDRIL_H[sepIdx].repeat(w));
    sep.style = { fg: colour, bg: host.theme().body.bg };

    // Rich status bar
    const wildCount = field!.wildColonies;
    const wildStr = wildCount > 0 ? `  ◈${wildCount}` : "";
    const cycleStr = field!.cycleCount > 0 ? `  ↻${field!.cycleCount}` : "";
    const compStr = field!.competitionEvents > 0 ? `  ⚔${field!.competitionEvents}` : "";
    const edgeCount = field!.nodes.reduce((sum, n) => sum + n.connected.length, 0) / 2;
    const edgeStr = edgeCount > 0 ? `  ⟶${Math.floor(edgeCount)}` : "";
    const transStr = transition.active
      ? `  ${transition.phase === "sporulating" ? "⟡SPORE" : "⟡BIRTH"}`
      : "";
    status.setContent(
      ` ${fungalTime(now)}  ◦${field!.spores.length} ◉${field!.nodes.length}${wildStr}${edgeStr}${compStr}${cycleStr}${transStr}`
    );

    host.screen.render();
    tick++;
  }

  resetField(false);

  createTimer(() => {
    updateDisplay();
  }, 125, timers);

  win.onResize(() => {
    resetField(false);
    updateDisplay();
  });

  win.describeState(() => {
    const now = new Date();
    const nodeInfo = (field?.nodes ?? []).map((n) => ({
      name: n.name,
      position: { x: n.x, y: n.y },
      wild: n.wild,
      strength: n.strength,
      connections: n.connected.length,
    }));
    return {
      summary: `Spore Clock — ${fungalTime(now)}`,
      generation: field?.generation ?? 0,
      totalGenerations: field?.totalGenerations ?? 0,
      sporeCount: field?.spores.length ?? 0,
      nodeCount: field?.nodes.length ?? 0,
      plannedColonies: field?.colonies ?? 0,
      wildColonies: field?.wildColonies ?? 0,
      competitionEvents: field?.competitionEvents ?? 0,
      cycleCount: field?.cycleCount ?? 0,
      colonies: nodeInfo,
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
