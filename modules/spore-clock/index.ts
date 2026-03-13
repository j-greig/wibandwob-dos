import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════
// SPORE CLOCK — a living fungal timepiece
//
// Time is told through living mycelial topology:
// Hours  → colony colour (circadian blending across palettes)
// Minutes → hyphal density (sparse dawn → dense canopy)
// Seconds → spore population + pulse rings from nodes
//
// Substrate memory means old growth shapes new.
// Wild colonies emerge from drifting spores.
// Competing colonies fight at boundaries.
// Death feeds birth at minute transitions.
// Nutrient zones create asymmetric, organic growth.
// ═══════════════════════════════════════════════════════════════

// ─── Glyph vocabularies ─────────────────────────────────────

// Mycelial growth — density 0-9
const HYPHAE = [" ", "·", "∙", ":", "╌", "─", "┼", "╋", "▓", "█"];
// Spore particles
const SPORE_CHARS = ["°", "•", "⊙", "◌", "○", "◦", "∘", "⁘", "⁛"];
// Colony node heartbeat
const NODE_CHARS = ["◉", "⊛", "✦", "✧", "❋", "✿", "❀", "⚘"];
// Wild colony nodes — distinct visual
const WILD_NODE_CHARS = ["◈", "⊕", "⊗", "⊘", "◇", "◆"];
// Horizontal tendrils
const TENDRIL_H = ["─", "═", "╌", "╍", "┄", "┈"];
// Vertical tendrils
const TENDRIL_V = ["│", "║", "╎", "╏", "┆", "┊"];
// Junctions (3-4 connections)
const BRANCH_CROSS = ["┤", "├", "┬", "┴", "┼", "╋"];
// Corners (exactly 2 perpendicular)
const BRANCH_CORNER = ["┌", "┐", "└", "┘", "╭", "╮", "╰", "╯"];
// Decay — cells breaking down
const DECAY_CHARS = ["░", "▒", "≈", "~", "˙", "ˑ"];
// Ghost — substrate memory residue
const GHOST_CHARS = ["᛫", "᛬", "⋅", "⋯", "∵"];
// Boundary — where colonies compete
const BOUNDARY_CHARS = ["⁂", "※", "⁑", "∗", "⊹"];
// Pulse ring — expanding time-pulse
const PULSE_CHARS = ["○", "◯", "◎", "●"];
// Network edge between connected nodes
const EDGE_CHARS = ["╶", "╵", "╴", "╷"];

// ─── Colour palettes ────────────────────────────────────────

// One per 2-hour block — seasonal biome aesthetics
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

// Seasonal growth multiplier — maps biome to growth vigour
const SEASONAL_GROWTH = [
  0.5, 0.6, 0.8, 1.0, 1.2, 1.1,  // 00-11: slow night → fast morning
  1.0, 1.3, 1.2, 0.9, 0.7, 0.5,  // 12-23: peak afternoon → quiet night
];

// ─── Colony naming vocabulary ───────────────────────────────

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

// ─── Data types ─────────────────────────────────────────────

interface SporeTrail { x: number; y: number; age: number; }

interface Spore {
  x: number; y: number;
  vx: number; vy: number;
  age: number;
  char: string;
  trails: SporeTrail[];
}

interface HyphalNode {
  x: number; y: number;
  strength: number;
  connected: number[];
  wild: boolean;
  name: string;
  born: number;
  owner: number;
}

interface MycelialField {
  grid: number[][];
  owner: number[][];     // colony ownership per cell
  ghost: number[][];     // substrate memory
  nutrient: number[][];  // growth richness
  decay: number[][];     // decay countdown
  nodes: HyphalNode[];
  spores: Spore[];
  colonies: number;
  wildColonies: number;
  generation: number;
  totalGenerations: number;
  cycleCount: number;
  competitionEvents: number;
}

interface TransitionState {
  active: boolean;
  ticksRemaining: number;
  phase: "sporulating" | "rebirth";
}

interface PulseRing {
  cx: number; cy: number;
  radius: number; maxRadius: number;
  age: number;
}

// ─── Field management ───────────────────────────────────────

function createField(w: number, h: number): MycelialField {
  const make = () => { const a: number[][] = []; for (let y = 0; y < h; y++) a.push(new Array(w).fill(0)); return a; };
  return {
    grid: make(), owner: make().map(r => r.map(() => -1)),
    ghost: make(), nutrient: make(), decay: make(),
    nodes: [], spores: [],
    colonies: 0, wildColonies: 0,
    generation: 0, totalGenerations: 0,
    cycleCount: 0, competitionEvents: 0,
  };
}

// Nutrient zones — superimposed sine waves for pseudo-noise
function generateNutrients(nut: number[][], w: number, h: number, seed: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = Math.sin(x * 0.15 + seed) * Math.cos(y * 0.2 + seed * 0.7);
      const n2 = Math.sin(x * 0.07 - seed * 1.3) * Math.cos(y * 0.11 + seed * 0.4);
      const n3 = Math.sin((x + y) * 0.09 + seed * 2.1);
      nut[y][x] = (n1 + n2 + n3 + 3) / 6;
    }
  }
}

function seedColony(
  field: MycelialField, cx: number, cy: number,
  strength: number, wild: boolean, tick: number,
): boolean {
  const w = field.grid[0]?.length ?? 0;
  const h = field.grid.length;
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return false;
  if (field.nodes.some(n => Math.abs(n.x - cx) < 4 && Math.abs(n.y - cy) < 3)) return false;

  const idx = field.nodes.length;
  field.grid[cy][cx] = Math.min(7, Math.floor(strength * 7));
  field.owner[cy][cx] = idx;
  // Seed a small 3x3 kernel around the node for faster initial growth
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ny = cy + dy, nx = cx + dx;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && field.grid[ny][nx] === 0) {
        if (Math.random() < 0.5) {
          field.grid[ny][nx] = 1 + Math.floor(Math.random() * 2);
          field.owner[ny][nx] = idx;
        }
      }
    }
  }
  field.nodes.push({
    x: cx, y: cy, strength, connected: [], wild,
    name: colonyName(idx + field.cycleCount * 7),
    born: tick, owner: idx,
  });
  if (wild) field.wildColonies++; else field.colonies++;
  return true;
}

function nearestNodeIdx(field: MycelialField, x: number, y: number): number {
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < field.nodes.length; i++) {
    const d = Math.abs(field.nodes[i].x - x) + Math.abs(field.nodes[i].y - y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ─── Growth algorithm ───────────────────────────────────────

function growField(field: MycelialField, intensity: number, seasonalRate: number) {
  const h = field.grid.length;
  const w = field.grid[0]?.length ?? 0;
  if (w === 0 || h === 0) return;

  const eff = intensity * seasonalRate;
  const next: number[][] = [];
  const nextOwner: number[][] = [];
  for (let y = 0; y < h; y++) {
    next.push([...field.grid[y]]);
    nextOwner.push([...field.owner[y]]);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const neighbours =
        field.grid[y-1][x-1] + field.grid[y-1][x] + field.grid[y-1][x+1] +
        field.grid[y][x-1]   +                       field.grid[y][x+1]   +
        field.grid[y+1][x-1] + field.grid[y+1][x] + field.grid[y+1][x+1];
      const avg = neighbours / 8;
      const cur = field.grid[y][x];
      const curOwner = field.owner[y][x];
      const nut = field.nutrient[y]?.[x] ?? 0.5;
      const ghost = (field.ghost[y]?.[x] ?? 0) * 0.1;

      // Empty cell colonisation — needs neighbour pressure + randomness
      if (cur === 0) {
        const threshold = 1.4 - nut * 0.4 - ghost;
        if (avg > threshold && Math.random() < eff * 0.45) {
          next[y][x] = Math.max(1, Math.min(4, Math.floor(avg * eff * 0.5)));
          // Inherit ownership from strongest neighbour
          const oc = new Map<number, number>();
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const o = field.owner[y+dy]?.[x+dx] ?? -1;
            if (o >= 0) oc.set(o, (oc.get(o) ?? 0) + 1);
          }
          let maxO = -1, maxC = 0;
          for (const [o, c] of oc) if (c > maxC) { maxO = o; maxC = c; }
          nextOwner[y][x] = maxO;
        }
      }
      // Low-mid density growth
      else if (cur > 0 && cur < 6) {
        if (Math.random() < eff * (0.1 + nut * 0.15)) {
          next[y][x] = cur + 1;
        }
      }
      // High density growth — only in dense clusters
      else if (cur >= 6 && cur < 9 && avg > 4) {
        if (Math.random() < eff * 0.05) {
          next[y][x] = Math.min(9, cur + 1);
        }
      }

      // Boundary competition
      if (cur > 0 && curOwner >= 0) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue;
          const ny = y + dy, nx = x + dx;
          const oo = field.owner[ny]?.[nx] ?? -1;
          const od = field.grid[ny]?.[nx] ?? 0;
          if (oo >= 0 && oo !== curOwner && od > 0) {
            if (cur > od + 1 && Math.random() < 0.025) {
              nextOwner[ny][nx] = curOwner;
              next[ny][nx] = Math.max(1, od - 1);
              field.competitionEvents++;
            }
          }
        }
      }

      // Decay — creates visual churn and texture
      if (cur >= 5) {
        if (field.decay[y][x] === 0) {
          field.decay[y][x] = cur >= 8 ? 12 + Math.floor(Math.random() * 25) :
                              cur >= 7 ? 25 + Math.floor(Math.random() * 40) :
                              40 + Math.floor(Math.random() * 60);
        } else {
          field.decay[y][x]--;
          if (field.decay[y][x] <= 0) {
            const drop = 1 + Math.floor(Math.random() * 2);
            next[y][x] = Math.max(0, cur - drop);
            field.decay[y][x] = 0;
            if (next[y][x] === 0) nextOwner[y][x] = -1;
            // Dead cells feed neighbours
            for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
              const ny2 = y + dy2, nx2 = x + dx2;
              if (ny2 >= 0 && ny2 < h && nx2 >= 0 && nx2 < w) {
                field.nutrient[ny2][nx2] = Math.min(1, (field.nutrient[ny2]?.[nx2] ?? 0) + 0.07);
              }
            }
          }
        }
      }

      // Tendril extension — organic fingers reaching outward
      if (cur === 0 && Math.random() < eff * (0.006 + nut * 0.006 + ghost * 0.008)) {
        const ni = nearestNodeIdx(field, x, y);
        if (ni >= 0) {
          const n = field.nodes[ni];
          const dist = Math.abs(n.x - x) + Math.abs(n.y - y);
          if (dist < 8) {
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

  // Node connections — link nearby nodes whose growth has met
  for (let i = 0; i < field.nodes.length; i++) {
    for (let j = i + 1; j < field.nodes.length; j++) {
      if (field.nodes[i].connected.includes(j)) continue;
      const a = field.nodes[i], b = field.nodes[j];
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (dist < 18) {
        const mx = Math.floor((a.x + b.x) / 2), my = Math.floor((a.y + b.y) / 2);
        const qx = Math.floor((a.x * 3 + b.x) / 4), qy = Math.floor((a.y * 3 + b.y) / 4);
        if ((field.grid[my]?.[mx] ?? 0) > 0 && (field.grid[qy]?.[qx] ?? 0) > 0) {
          field.nodes[i].connected.push(j);
          field.nodes[j].connected.push(i);
        }
      }
    }
  }
}

// ─── Spore dynamics ─────────────────────────────────────────

function emitSpores(field: MycelialField, count: number, w: number, h: number) {
  if (field.spores.length >= 80) return;
  for (let i = 0; i < count && field.spores.length < 80; i++) {
    const src = field.nodes.length > 0
      ? field.nodes[Math.floor(Math.random() * field.nodes.length)]
      : { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    field.spores.push({
      x: src.x + (Math.random() - 0.5) * 2,
      y: src.y + (Math.random() - 0.5),
      vx: (Math.random() - 0.5) * 1.8,
      vy: (Math.random() - 0.5) * 0.9,
      age: 0,
      char: SPORE_CHARS[Math.floor(Math.random() * SPORE_CHARS.length)],
      trails: [],
    });
  }
}

function massSporulate(field: MycelialField, w: number) {
  const h = field.grid.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (field.grid[y][x] >= 3 && Math.random() < 0.1) {
        field.spores.push({
          x, y,
          vx: (Math.random() - 0.5) * 3.0,
          vy: (Math.random() - 0.5) * 1.5,
          age: 0,
          char: SPORE_CHARS[Math.floor(Math.random() * SPORE_CHARS.length)],
          trails: [],
        });
        field.grid[y][x] = Math.max(0, field.grid[y][x] - 1);
      }
    }
  }
}

function driftSpores(field: MycelialField, w: number, h: number, tick: number) {
  // Wind direction shifts slowly over time — adds coherent spore movement
  const windX = Math.sin(tick * 0.01) * 0.15;
  const windY = Math.cos(tick * 0.013) * 0.08;

  field.spores = field.spores.filter(s => {
    // Record trail
    if (s.age > 0 && s.age % 2 === 0) {
      s.trails.push({ x: Math.floor(s.x), y: Math.floor(s.y), age: 0 });
      if (s.trails.length > 6) s.trails.shift();
    }
    for (const t of s.trails) t.age++;

    s.x += s.vx;
    s.y += s.vy;
    s.vx = s.vx * 0.93 + windX;
    s.vy = s.vy * 0.93 + windY;
    s.vx += (Math.random() - 0.5) * 0.35;
    s.vy += (Math.random() - 0.5) * 0.18;
    s.age++;

    // Wild colony seeding
    if (s.age > 12 && s.age < 35) {
      const ix = Math.floor(s.x), iy = Math.floor(s.y);
      if (ix >= 2 && ix < w - 2 && iy >= 2 && iy < h - 2) {
        const cell = field.grid[iy]?.[ix] ?? 0;
        const nearDist = field.nodes.reduce((min, n) =>
          Math.min(min, Math.abs(n.x - ix) + Math.abs(n.y - iy)), Infinity);
        if (cell === 0 && nearDist > 10 && Math.random() < 0.05) {
          if (seedColony(field, ix, iy, 0.3 + Math.random() * 0.3, true, tick)) {
            return false; // spore consumed by new colony
          }
        }
      }
    }

    return s.age < 50 && s.x >= 0 && s.x < w && s.y >= 0 && s.y < h;
  });
}

// ─── Colour utilities ───────────────────────────────────────

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
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex(
    ra[0] + (rb[0] - ra[0]) * t,
    ra[1] + (rb[1] - ra[1]) * t,
    ra[2] + (rb[2] - ra[2]) * t,
  );
}

function getCircadianColour(now: Date): string {
  const h = now.getHours(), m = now.getMinutes();
  const idx = Math.floor(h / 2);
  const nextIdx = (idx + 1) % 12;
  const progress = ((h % 2) * 60 + m) / 120;
  // Smooth blend over the last 15 minutes of each 2-hour block
  if (progress > 0.875) {
    return blendColours(
      COLONY_COLOURS[idx] ?? "#ffffff",
      COLONY_COLOURS[nextIdx] ?? "#ffffff",
      (progress - 0.875) / 0.125,
    );
  }
  return COLONY_COLOURS[idx] ?? "#ffffff";
}

// ─── Boundary detection ─────────────────────────────────────

function isBoundary(field: MycelialField, x: number, y: number, w: number, h: number): boolean {
  const my = field.owner[y]?.[x] ?? -1;
  if (my < 0) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dy === 0 && dx === 0) continue;
    const ny = y + dy, nx = x + dx;
    if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
      const o = field.owner[ny]?.[nx] ?? -1;
      if (o >= 0 && o !== my) return true;
    }
  }
  return false;
}

// ─── Rendering ──────────────────────────────────────────────

function renderField(
  field: MycelialField, w: number, h: number,
  tick: number, pulseRings: PulseRing[],
): string {
  // Build O(1) lookup maps
  const sporeMap = new Map<number, Spore>();
  for (const s of field.spores) {
    const key = Math.floor(s.y) * w + Math.floor(s.x);
    if (!sporeMap.has(key)) sporeMap.set(key, s);
  }

  const trailMap = new Map<number, number>();
  for (const s of field.spores) {
    for (const t of s.trails) {
      if (t.age < 12) {
        const key = t.y * w + t.x;
        const ex = trailMap.get(key);
        if (ex === undefined || t.age < ex) trailMap.set(key, t.age);
      }
    }
  }

  const nodeMap = new Map<number, HyphalNode>();
  for (const n of field.nodes) nodeMap.set(n.y * w + n.x, n);

  // Network edges
  const edgeSet = new Set<number>();
  for (const n of field.nodes) {
    for (const ci of n.connected) {
      const o = field.nodes[ci];
      if (!o) continue;
      const steps = Math.max(Math.abs(o.x - n.x), Math.abs(o.y - n.y));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const ex = Math.round(n.x + (o.x - n.x) * t);
        const ey = Math.round(n.y + (o.y - n.y) * t);
        if (ex >= 0 && ex < w && ey >= 0 && ey < h) edgeSet.add(ey * w + ex);
      }
    }
  }

  // Pulse ring pixels
  const pulseSet = new Map<number, number>();
  for (const ring of pulseRings) {
    const r = ring.radius;
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      const px = Math.round(ring.cx + Math.cos(ang) * r * 2.0);
      const py = Math.round(ring.cy + Math.sin(ang) * r);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        pulseSet.set(py * w + px, ring.age);
      }
    }
  }

  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const key = y * w + x;
      const density = field.grid[y]?.[x] ?? 0;

      // Pulse ring (only on empty space — don't overwrite growth)
      if (density === 0) {
        const pa = pulseSet.get(key);
        if (pa !== undefined) {
          line += PULSE_CHARS[Math.min(pa, PULSE_CHARS.length - 1)];
          continue;
        }
      }

      // Spore
      const spore = sporeMap.get(key);
      if (spore) {
        if (spore.age < 8) line += spore.char;
        else if (spore.age < 20) line += "·";
        else line += " ";
        continue;
      }

      // Spore trail (only on empty space)
      if (density === 0) {
        const ta = trailMap.get(key);
        if (ta !== undefined) {
          line += ta < 3 ? "·" : ta < 7 ? "⋅" : "᛫";
          continue;
        }
      }

      // Node
      const node = nodeMap.get(key);
      if (node) {
        const speed = node.wild ? 3.5 : 2.0;
        const pulse = Math.sin(tick * 0.15 * speed + node.x * 0.3 + node.y * 0.2) * 0.5 + 0.5;
        if (node.wild) {
          line += WILD_NODE_CHARS[Math.floor(pulse * (WILD_NODE_CHARS.length - 1))];
        } else {
          line += NODE_CHARS[Math.floor(pulse * (NODE_CHARS.length - 1))];
        }
        continue;
      }

      // Mycelial cells
      if (density > 0) {
        // Boundary competition visualisation
        if (density >= 2 && isBoundary(field, x, y, w, h)) {
          line += BOUNDARY_CHARS[(tick + x + y) % BOUNDARY_CHARS.length];
          continue;
        }

        // Decay shimmer
        if (field.decay[y]?.[x] > 0 && field.decay[y][x] < 8 && density >= 5) {
          line += DECAY_CHARS[Math.floor(Math.random() * DECAY_CHARS.length)];
          continue;
        }

        // Contextual box-drawing tendrils for mid-density
        if (density >= 2 && density <= 5) {
          const l = field.grid[y]?.[x-1] ?? 0;
          const r = field.grid[y]?.[x+1] ?? 0;
          const u = field.grid[y-1]?.[x] ?? 0;
          const d = field.grid[y+1]?.[x] ?? 0;
          const cn = (l>0?1:0) + (r>0?1:0) + (u>0?1:0) + (d>0?1:0);

          if (cn >= 3) { line += BRANCH_CROSS[density % BRANCH_CROSS.length]; continue; }
          if (l > 0 && r > 0) { line += TENDRIL_H[density % TENDRIL_H.length]; continue; }
          if (u > 0 && d > 0) { line += TENDRIL_V[density % TENDRIL_V.length]; continue; }
          if (cn === 2) {
            const ci = (r>0 && d>0) ? 0 : (l>0 && d>0) ? 1 : (r>0 && u>0) ? 2 : 3;
            line += BRANCH_CORNER[ci];
            continue;
          }
        }
        line += HYPHAE[density];
      } else {
        // Empty space — check for network edges
        if (edgeSet.has(key)) {
          line += EDGE_CHARS[tick % EDGE_CHARS.length];
          continue;
        }
        // Ghost residue
        const gv = field.ghost[y]?.[x] ?? 0;
        if (gv > 0) {
          line += GHOST_CHARS[Math.min(gv - 1, GHOST_CHARS.length - 1)];
        } else {
          line += " ";
        }
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── Time formatting ────────────────────────────────────────

function fungalTime(now: Date): string {
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const names = [
    "DEEP SPORE", "PREDAWN", "VIOLET DAWN", "ORCHID FLUSH",
    "RED CAP", "SALMON GILL", "CHANTERELLE", "VERDURE",
    "TEAL LICHEN", "CORNFLOWER", "TWILIGHT", "MIDNIGHT",
  ];
  const colonyIdx = Math.floor(h / 2);
  // Visual minute progress bar
  const barLen = 10;
  const filled = Math.floor((m / 60) * barLen);
  const bar = "▓".repeat(filled) + "░".repeat(barLen - filled);
  return `${names[colonyIdx]}  ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}  ${bar}`;
}

// ─── Module setup ───────────────────────────────────────────

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

  function getContentSize() {
    return {
      w: Math.max(8, Number(canvas.width) || 40),
      h: Math.max(4, Number(canvas.height) || 20),
    };
  }

  function resetField(preserveMemory: boolean) {
    const { w, h } = getContentSize();

    // Substrate memory — ghost layer from old field
    let oldGhost: number[][] | null = null;
    let oldCycleCount = 0, oldTotalGen = 0, oldComp = 0;
    if (preserveMemory && field) {
      const oh = field.grid.length, ow = field.grid[0]?.length ?? 0;
      oldGhost = [];
      for (let y = 0; y < Math.min(oh, h); y++) {
        const row: number[] = [];
        for (let x = 0; x < Math.min(ow, w); x++) {
          const prev = field.ghost[y]?.[x] ?? 0;
          const cur = field.grid[y]?.[x] ?? 0;
          row.push(Math.min(5, prev + (cur > 2 ? 1 : 0)));
        }
        oldGhost.push(row);
      }
      oldCycleCount = field.cycleCount;
      oldTotalGen = field.totalGenerations;
      oldComp = field.competitionEvents;
    }

    field = createField(w, h);
    field.cycleCount = oldCycleCount + (preserveMemory ? 1 : 0);
    field.totalGenerations = oldTotalGen;
    field.competitionEvents = oldComp;

    if (oldGhost) {
      for (let y = 0; y < Math.min(oldGhost.length, h); y++)
        for (let x = 0; x < Math.min(oldGhost[y].length, w); x++)
          field.ghost[y][x] = oldGhost[y][x];
    }

    nutrientSeed += 0.3;
    generateNutrients(field.nutrient, w, h, nutrientSeed);

    const now = new Date();
    const m = now.getMinutes();

    // Fibonacci spiral seed placement — golden angle
    const numSeeds = 2 + Math.floor(m / 15);
    const golden = 137.508 * (Math.PI / 180);
    for (let i = 0; i < numSeeds; i++) {
      const angle = i * golden + (now.getHours() * 0.5);
      const r = Math.min(w, h) * (0.15 + (i / numSeeds) * 0.35);
      const cx = Math.floor(w / 2 + Math.cos(angle) * r);
      const cy = Math.floor(h / 2 + Math.sin(angle) * r * 0.45);
      seedColony(field, cx, cy, 0.4 + Math.random() * 0.4, false, tick);
    }
    // Centre seed
    seedColony(field, Math.floor(w / 2), Math.floor(h / 2), 0.7, false, tick);
  }

  function updateDisplay() {
    if (!field) return;
    const now = new Date();
    const { w, h } = getContentSize();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Second pulse ring — from a random node every 5 seconds
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      if (seconds % 5 === 0 && field.nodes.length > 0) {
        const src = field.nodes[Math.floor(Math.random() * field.nodes.length)];
        pulseRings.push({
          cx: src.x, cy: src.y,
          radius: 0, maxRadius: Math.min(w, h) * 0.35,
          age: 0,
        });
      }
    }

    // Evolve pulse rings
    for (let i = pulseRings.length - 1; i >= 0; i--) {
      pulseRings[i].radius += 0.5;
      pulseRings[i].age = Math.min(3, Math.floor(pulseRings[i].radius / 3));
      if (pulseRings[i].radius >= pulseRings[i].maxRadius) {
        pulseRings.splice(i, 1);
      }
    }

    // Minute transition — sporulation then rebirth
    if (minutes !== lastMinute && lastMinute !== -1 && !transition.active) {
      transition.active = true;
      transition.phase = "sporulating";
      transition.ticksRemaining = 24; // ~3 seconds
    }

    if (transition.active) {
      transition.ticksRemaining--;
      if (transition.phase === "sporulating") {
        massSporulate(field!, w);
        driftSpores(field!, w, h, tick);
        if (transition.ticksRemaining <= 0) {
          const saved = [...field!.spores];
          lastMinute = minutes;
          resetField(true); // substrate memory preserved
          field!.spores = saved;
          transition.phase = "rebirth";
          transition.ticksRemaining = 10; // ~1.25s settling
        }
      } else {
        driftSpores(field!, w, h, tick);
        if (transition.ticksRemaining <= 0) transition.active = false;
      }
    } else {
      if (lastMinute === -1) { lastMinute = minutes; resetField(false); }

      const minuteProgress = seconds / 60;
      const intensity = 0.15 + minuteProgress * 0.85;
      const seasonal = SEASONAL_GROWTH[Math.floor(now.getHours() / 2)] ?? 1.0;

      growField(field!, intensity, seasonal);

      const sporeRate = 1 + Math.floor(seconds / 8);
      if (tick % 3 === 0) emitSpores(field!, sporeRate, w, h);
      driftSpores(field!, w, h, tick);
    }

    const colour = getCircadianColour(now);

    canvas.setContent(renderField(field!, w, h, tick, pulseRings));
    canvas.style = { fg: colour, bg: host.theme().body.bg };

    // Breathing separator
    const sepPulse = Math.sin(tick * 0.08) * 0.5 + 0.5;
    sep.setContent(TENDRIL_H[Math.floor(sepPulse * (TENDRIL_H.length - 1))].repeat(w));
    sep.style = { fg: colour, bg: host.theme().body.bg };

    // Rich status bar with symbolic indicators
    const wild = field!.wildColonies;
    const edges = Math.floor(field!.nodes.reduce((s, n) => s + n.connected.length, 0) / 2);
    const parts = [
      fungalTime(now),
      `gen:${field!.generation}`,
      `◦${field!.spores.length}`,
      `◉${field!.nodes.length}`,
    ];
    if (wild > 0) parts.push(`◈${wild}`);
    if (edges > 0) parts.push(`⟶${edges}`);
    if (field!.competitionEvents > 0) parts.push(`⚔${field!.competitionEvents}`);
    if (field!.cycleCount > 0) parts.push(`↻${field!.cycleCount}`);
    if (transition.active) parts.push(transition.phase === "sporulating" ? "⟡SPORE" : "⟡BIRTH");
    status.setContent(` ${parts.join("  ")}`);

    host.screen.render();
    tick++;
  }

  resetField(false);

  // Main loop — 8fps
  createTimer(() => updateDisplay(), 125, timers);

  win.onResize(() => { resetField(false); updateDisplay(); });

  win.describeState(() => {
    const now = new Date();
    return {
      summary: `Spore Clock — ${fungalTime(now)}`,
      generation: field?.generation ?? 0,
      totalGenerations: field?.totalGenerations ?? 0,
      sporeCount: field?.spores.length ?? 0,
      nodeCount: field?.nodes.length ?? 0,
      plannedColonies: field?.colonies ?? 0,
      wildColonies: field?.wildColonies ?? 0,
      competitionEvents: field?.competitionEvents ?? 0,
      networkEdges: Math.floor((field?.nodes ?? []).reduce((s, n) => s + n.connected.length, 0) / 2),
      cycleCount: field?.cycleCount ?? 0,
      colonies: (field?.nodes ?? []).map(n => ({
        name: n.name, position: { x: n.x, y: n.y },
        wild: n.wild, strength: n.strength,
        connections: n.connected.length,
      })),
      transitioning: transition.active ? transition.phase : "none",
      colour: getCircadianColour(now),
    };
  });

  win.captureText(() => {
    const now = new Date();
    return `${fungalTime(now)}\n\n${canvas.getContent()}`;
  });

  win.onRestyle(() => {
    const t = host.theme();
    canvas.style = { ...t.body };
    status.style = t.muted ? { fg: t.muted.fg, bg: t.body.bg } : { fg: "grey", bg: t.body.bg };
    sep.style = { ...t.body };
    host.screen.render();
  });

  win.onCleanup(() => clearTimers(timers));
  win.focus();
}
