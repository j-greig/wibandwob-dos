import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════
// ASCIICKER — ASCII 3D world renderer
//
// Inspired by github.com/msokalski/asciicker (MIT)
// A proper 3D software renderer: heightmap terrain projected
// through a 3D camera with depth buffer, triangle rasterization,
// per-cell material/colour, directional lighting.
//
// Not a 2D tile map — a real 3D engine rendered to ASCII.
// ═══════════════════════════════════════════════════════════════

// ─── Render buffer cell ─────────────────────────────────────

interface Sample {
  depth: number;     // z-buffer
  glyph: string;
  fg: number;        // ANSI 256 colour index
  bg: number;        // ANSI 256 colour index
  flags: number;     // 0=empty, 1=terrain, 2=sprite, 4=water
}

// ─── Biome types ────────────────────────────────────────────

const enum Biome {
  DEEP_WATER = 0,
  WATER = 1,
  SAND = 2,
  GRASS = 3,
  FOREST = 4,
  ROCK = 5,
  MOUNTAIN = 6,
  SNOW = 7,
}

// Material: top face glyph set, side face glyph set, colour ramp (light→dark)
interface Material {
  topGlyphs: string[];
  sideGlyphs: string[];
  fgLight: number;     // ANSI 256 - bright
  fgMid: number;       // ANSI 256 - medium
  fgDark: number;      // ANSI 256 - shadow
  bgLight: number;
  bgDark: number;
}

// ANSI 256 colour helpers
function rgb6(r: number, g: number, b: number): number {
  return 16 + r * 36 + g * 6 + b; // 6x6x6 cube
}
function grey(n: number): number { return 232 + n; } // 0-23 greyscale

const MATERIALS: Record<Biome, Material> = {
  [Biome.DEEP_WATER]: {
    topGlyphs: ["≈", "~", "∽", "≋", "∿", "░"],
    sideGlyphs: ["█", "▓"],
    fgLight: rgb6(2, 3, 5), fgMid: rgb6(1, 2, 5), fgDark: rgb6(0, 1, 3),
    bgLight: rgb6(0, 1, 4), bgDark: rgb6(0, 0, 3),
  },
  [Biome.WATER]: {
    topGlyphs: ["~", "∼", "≈", "˜", "∿", "·"],
    sideGlyphs: ["▓", "▒"],
    fgLight: rgb6(2, 4, 5), fgMid: rgb6(1, 3, 5), fgDark: rgb6(0, 2, 4),
    bgLight: rgb6(0, 2, 5), bgDark: rgb6(0, 1, 4),
  },
  [Biome.SAND]: {
    topGlyphs: [".", "·", "∙", ",", "'"],
    sideGlyphs: ["▒", "░", "▓"],
    fgLight: rgb6(5, 5, 2), fgMid: rgb6(4, 4, 1), fgDark: rgb6(3, 3, 0),
    bgLight: rgb6(5, 4, 2), bgDark: rgb6(4, 3, 1),
  },
  [Biome.GRASS]: {
    topGlyphs: [".", ";", ",", "'", "\"", "`", ":", "∴", "·", "⌂", "♠", "░"],
    sideGlyphs: ["▒", "░", "▓", "█", "▌"],
    fgLight: rgb6(2, 5, 0), fgMid: rgb6(1, 4, 0), fgDark: rgb6(0, 2, 0),
    bgLight: rgb6(1, 4, 0), bgDark: rgb6(0, 2, 0),
  },
  [Biome.FOREST]: {
    topGlyphs: ["♣", "♠", "▲", "△", "⌂", "♧", "↟", "↡", "▓"],
    sideGlyphs: ["║", "▓", "█", "▌", "▐"],
    fgLight: rgb6(1, 5, 0), fgMid: rgb6(0, 3, 0), fgDark: rgb6(0, 1, 0),
    bgLight: rgb6(0, 3, 0), bgDark: rgb6(0, 1, 0),
  },
  [Biome.ROCK]: {
    topGlyphs: ["#", "▒", "░", "▓", "∎", "▪"],
    sideGlyphs: ["█", "▓", "▒", "░"],
    fgLight: grey(14), fgMid: grey(10), fgDark: grey(6),
    bgLight: grey(8), bgDark: grey(4),
  },
  [Biome.MOUNTAIN]: {
    topGlyphs: ["▲", "△", "▴", "◮", "⏶", "∧"],
    sideGlyphs: ["█", "▓", "▌", "▐"],
    fgLight: grey(16), fgMid: grey(12), fgDark: grey(7),
    bgLight: grey(10), bgDark: grey(5),
  },
  [Biome.SNOW]: {
    topGlyphs: ["*", "·", "∘", "°", "⁎", "❄"],
    sideGlyphs: ["█", "▓"],
    fgLight: grey(23), fgMid: grey(20), fgDark: grey(16),
    bgLight: grey(22), bgDark: grey(18),
  },
};

// ─── Player sprite from asciicker (player-nude.xp, front-facing standing) ───

interface SpriteCell { ch: string; fg: [number,number,number]; bg: [number,number,number] }
const PLAYER_SPRITE = {
  w: 5, h: 8,
  cells: [
    null, null, { ch: "▄", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null, null,
    null, { ch: "▐", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "\"", fg: [0,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▌", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null,
    null, null, { ch: "v", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null, null,
    null, { ch: "▄", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "┬", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▄", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null,
    { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "┼", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] },
    null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "U", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null,
    null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null,
    null, { ch: "▀", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, null, { ch: "▀", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, null,
  ] as (SpriteCell | null)[],
};

function spriteRgbToAnsi(c: [number, number, number]): number {
  return 16 + Math.round(c[0]/255*5) * 36 + Math.round(c[1]/255*5) * 6 + Math.round(c[2]/255*5);
}

// ─── Noise for terrain generation ───────────────────────────

function hash2d(x: number, y: number, s: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + s * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy, s), b = hash2d(ix+1, iy, s);
  const c = hash2d(ix, iy+1, s), d = hash2d(ix+1, iy+1, s);
  return a + sx * (b-a) + sy * (c-a) + sx*sy * (a-b-c+d);
}

function fractal(x: number, y: number, s: number, oct: number): number {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < oct; i++) {
    v += smoothNoise(x*f, y*f, s+i*100) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ─── Terrain ────────────────────────────────────────────────

interface TerrainCell {
  height: number;   // 0-255
  biome: Biome;
}

interface Terrain {
  w: number;
  h: number;
  cells: TerrainCell[];
  seed: number;
}

function genTerrain(w: number, h: number, seed: number): Terrain {
  const cells: TerrainCell[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = fractal(x*0.018, y*0.018, seed, 6);
      const ridge = 1 - Math.abs(fractal(x*0.012, y*0.012, seed+500, 4) * 2 - 1);
      const combined = raw * 0.65 + ridge * 0.35;
      const height = Math.floor(Math.max(0, Math.min(255, combined * 255)));
      const moisture = fractal(x*0.025, y*0.025, seed+1000, 4);

      let biome: Biome;
      if (height < 45) biome = Biome.DEEP_WATER;
      else if (height < 60) biome = Biome.WATER;
      else if (height < 72) biome = Biome.SAND;
      else if (height < 135) biome = moisture > 0.55 ? Biome.FOREST : Biome.GRASS;
      else if (height < 180) biome = Biome.ROCK;
      else if (height < 220) biome = Biome.MOUNTAIN;
      else biome = Biome.SNOW;

      cells[y * w + x] = { height, biome };
    }
  }
  const terrain = { w, h, cells, seed };

  // Post-processing pass 1: Carve rivers from mountains to sea
  carveRivers(terrain, seed);

  // Post-processing pass 2: Add scattered structures on flat grass
  addStructures(terrain, seed);

  return terrain;
}

// Carve rivers — follow gradient downhill from random mountain sources
function carveRivers(t: Terrain, seed: number) {
  const numRivers = 3 + Math.floor(hash2d(seed, seed * 7, 42) * 4);
  for (let r = 0; r < numRivers; r++) {
    // Find a mountain source
    let sx = Math.floor(hash2d(r * 37, seed, 11) * t.w);
    let sy = Math.floor(hash2d(seed, r * 53, 22) * t.h);
    // Walk to nearest high ground
    for (let i = 0; i < 50; i++) {
      const best = { x: sx, y: sy, h: t.cells[sy * t.w + sx]?.height ?? 0 };
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = sx + dx, ny = sy + dy;
          if (nx >= 0 && nx < t.w && ny >= 0 && ny < t.h) {
            const nh = t.cells[ny * t.w + nx].height;
            if (nh > best.h) { best.x = nx; best.y = ny; best.h = nh; }
          }
        }
      }
      if (best.x === sx && best.y === sy) break;
      sx = best.x; sy = best.y;
    }

    // Now flow downhill, carving water
    let cx = sx, cy = sy;
    for (let step = 0; step < 200; step++) {
      const idx = cy * t.w + cx;
      if (cx < 0 || cx >= t.w || cy < 0 || cy >= t.h) break;
      const cell = t.cells[idx];
      if (cell.biome === Biome.DEEP_WATER) break; // reached the sea

      // Carve: set to water level
      if (cell.height > 60) {
        cell.biome = Biome.WATER;
        cell.height = 58;
        // Widen the river slightly
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > 1) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < t.w && ny >= 0 && ny < t.h) {
              const nc = t.cells[ny * t.w + nx];
              if (nc.height > 65 && nc.biome !== Biome.WATER) {
                nc.biome = Biome.SAND; // riverbank
                nc.height = Math.min(nc.height, 70);
              }
            }
          }
        }
      }

      // Find lowest neighbour
      let lowestH = cell.height, lx = cx, ly = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < t.w && ny >= 0 && ny < t.h) {
            const nh = t.cells[ny * t.w + nx].height;
            if (nh < lowestH) { lowestH = nh; lx = nx; ly = ny; }
          }
        }
      }
      if (lx === cx && ly === cy) break; // stuck in a basin
      cx = lx; cy = ly;
    }
  }
}

// Add small structures (ruins, huts) on flat grassland
function addStructures(t: Terrain, seed: number) {
  const numStructures = 5 + Math.floor(hash2d(seed * 3, seed * 11, 77) * 8);
  for (let s = 0; s < numStructures; s++) {
    const sx = Math.floor(hash2d(s * 41, seed * 7, 33) * (t.w - 20)) + 10;
    const sy = Math.floor(hash2d(seed * 13, s * 59, 44) * (t.h - 20)) + 10;
    const cell = t.cells[sy * t.w + sx];
    if (cell.biome !== Biome.GRASS && cell.biome !== Biome.SAND) continue;

    // Check flatness — all neighbours within 10 height units
    let flat = true;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nc = t.cells[(sy+dy) * t.w + (sx+dx)];
        if (!nc || Math.abs(nc.height - cell.height) > 10) { flat = false; break; }
      }
      if (!flat) break;
    }
    if (!flat) continue;

    // Build a small structure — raise height and change biome to ROCK
    const size = 2 + Math.floor(hash2d(s, seed, 55) * 2);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = sx + dx, ny = sy + dy;
        if (nx < 0 || nx >= t.w || ny < 0 || ny >= t.h) continue;
        const nc = t.cells[ny * t.w + nx];
        // Walls on perimeter, floor inside
        if (Math.abs(dx) === size || Math.abs(dy) === size) {
          nc.height = cell.height + 20;
          nc.biome = Biome.ROCK;
        }
      }
    }
  }
}

// ─── World objects (trees, bushes, rocks) ───────────────────

const enum ObjKind { TREE = 0, PINE = 1, BUSH = 2, ROCK_OBJ = 3, HOUSE = 4 }

interface WorldObj {
  x: number; y: number;
  kind: ObjKind;
  size: number; // 0-1 scale factor
}

// Multi-cell sprite definitions for objects
// Each row is bottom-to-top; cells have { ch, fg, bg } or null (transparent)
interface ObjSprite {
  rows: ({ ch: string; fg: number; bg: number } | null)[][];
}

function makeObjSprites(): Record<ObjKind, ObjSprite> {
  const trunkFg = rgb6(3, 2, 0);
  const trunkBg = rgb6(2, 1, 0);
  const leafFg = rgb6(0, 4, 0);
  const leafBg = rgb6(0, 3, 0);
  const leafLt = rgb6(1, 5, 0);
  const leafDk = rgb6(0, 2, 0);
  const pineFg = rgb6(0, 3, 1);
  const pineBg = rgb6(0, 2, 0);
  const bushFg = rgb6(1, 4, 0);
  const bushBg = rgb6(0, 3, 0);
  const rockFg = grey(12);
  const rockBg = grey(8);
  const wallFg = rgb6(4, 3, 2);
  const wallBg = rgb6(3, 2, 1);
  const roofFg = rgb6(4, 1, 0);
  const roofBg = rgb6(3, 1, 0);

  const c = (ch: string, fg: number, bg: number) => ({ ch, fg, bg });
  const _ = null;

  return {
    [ObjKind.TREE]: {
      // 5 rows, 3 wide — bottom-to-top
      rows: [
        [_, c("║", trunkFg, trunkBg), _],                         // trunk base
        [_, c("║", trunkFg, trunkBg), _],                         // trunk mid
        [c("◣", leafDk, leafBg), c("♣", leafFg, leafBg), c("◢", leafDk, leafBg)], // canopy low
        [c("▓", leafLt, leafBg), c("♠", leafFg, leafBg), c("▓", leafLt, leafBg)], // canopy mid
        [_, c("▲", leafLt, leafFg), _],                           // canopy top
      ],
    },
    [ObjKind.PINE]: {
      rows: [
        [_, c("│", trunkFg, trunkBg), _],
        [c("░", pineFg, pineBg), c("▲", pineFg, pineBg), c("░", pineFg, pineBg)],
        [_, c("▲", pineFg, pineBg), _],
        [_, c("△", pineFg, pineBg), _],
      ],
    },
    [ObjKind.BUSH]: {
      rows: [
        [c("░", bushFg, bushBg), c("♣", bushFg, bushBg), c("░", bushFg, bushBg)],
        [_, c("•", bushFg, bushBg), _],
      ],
    },
    [ObjKind.ROCK_OBJ]: {
      rows: [
        [c("▓", rockFg, rockBg), c("█", rockFg, rockBg), c("▓", rockFg, rockBg)],
        [_, c("▲", rockFg, rockBg), _],
      ],
    },
    [ObjKind.HOUSE]: {
      rows: [
        [c("▌", wallFg, wallBg), c("▐", wallFg, wallBg), c("▌", wallFg, wallBg)],
        [c("█", wallFg, wallBg), c("░", wallFg, wallBg), c("█", wallFg, wallBg)],
        [c("▓", roofFg, roofBg), c("▲", roofFg, roofBg), c("▓", roofFg, roofBg)],
        [_, c("△", roofFg, roofBg), _],
      ],
    },
  };
}

const OBJ_SPRITES = makeObjSprites();

function placeObjects(t: Terrain, seed: number): WorldObj[] {
  const objs: WorldObj[] = [];

  for (let y = 3; y < t.h - 3; y += 2) {
    for (let x = 3; x < t.w - 3; x += 2) {
      const cell = t.cells[y * t.w + x];
      const rng = hash2d(x * 17 + seed, y * 31 + seed, seed + 7);

      if (cell.biome === Biome.FOREST) {
        if (rng < 0.45) {
          objs.push({ x, y, kind: rng < 0.25 ? ObjKind.TREE : ObjKind.PINE, size: 0.7 + rng * 0.6 });
        }
      } else if (cell.biome === Biome.GRASS) {
        if (rng < 0.12) {
          objs.push({ x, y, kind: ObjKind.TREE, size: 0.6 + rng * 0.5 });
        } else if (rng < 0.2) {
          objs.push({ x, y, kind: ObjKind.BUSH, size: 0.5 + rng * 0.5 });
        }
      } else if (cell.biome === Biome.ROCK || cell.biome === Biome.MOUNTAIN) {
        if (rng < 0.08) {
          objs.push({ x, y, kind: ObjKind.ROCK_OBJ, size: 0.8 + rng * 0.3 });
        }
      }
    }
  }

  // Place houses near structures (use existing structure positions)
  for (let y = 10; y < t.h - 10; y += 8) {
    for (let x = 10; x < t.w - 10; x += 8) {
      const cell = t.cells[y * t.w + x];
      const rng = hash2d(x * 43 + seed, y * 67, seed + 99);
      if ((cell.biome === Biome.GRASS || cell.biome === Biome.SAND) && rng < 0.04) {
        objs.push({ x, y, kind: ObjKind.HOUSE, size: 1 });
      }
    }
  }

  return objs;
}

function getH(t: Terrain, x: number, y: number): number {
  if (x < 0 || x >= t.w || y < 0 || y >= t.h) return 0;
  return t.cells[y * t.w + x].height;
}

function getBiome(t: Terrain, x: number, y: number): Biome {
  if (x < 0 || x >= t.w || y < 0 || y >= t.h) return Biome.DEEP_WATER;
  return t.cells[y * t.w + x].biome;
}

// ─── 3D Camera ──────────────────────────────────────────────

interface Camera {
  x: number; y: number; z: number;  // world position
  yaw: number;      // degrees (0-360)
  pitch: number;    // tilt angle (fixed ~30°)
  zoom: number;     // scale factor
}

// ─── 3D projection ─────────────────────────────────────────
// Faithful to asciicker: isometric-ish with 30° pitch,
// yaw-rotatable, architectural perspective (verticals stay vertical).

function projectPoint(
  wx: number, wy: number, wz: number,
  cam: Camera, sw: number, sh: number,
): { sx: number; sy: number; depth: number } {
  // Translate relative to camera
  const rx = wx - cam.x;
  const ry = wy - cam.y;
  const rz = wz - cam.z;

  // Rotate by yaw around Z axis
  const yr = cam.yaw * Math.PI / 180;
  const cosY = Math.cos(yr);
  const sinY = Math.sin(yr);
  const tx = rx * cosY - ry * sinY;
  const ty = rx * sinY + ry * cosY;

  // Isometric projection with ~30° pitch
  // Like asciicker: x component maps horizontally,
  // y component maps into screen (depth + vertical),
  // z maps vertically
  const sin30 = 0.5;  // sin(30°)
  const cos30 = 0.866; // cos(30°)

  const scale = cam.zoom * 2; // base scale factor — each world unit = 2 screen columns
  const screenX = tx * scale;
  const screenY = -ty * sin30 * scale - rz * cos30 * scale;
  const depth = ty; // depth for z-sorting

  const sx = Math.round(sw / 2 + screenX);
  const sy = Math.round(sh / 2 + screenY);

  return { sx, sy, depth };
}

// ─── 3D Renderer ────────────────────────────────────────────

function renderScene(
  terrain: Terrain,
  cam: Camera,
  sw: number, sh: number,
  playerX: number, playerY: number,
  tick: number,
  worldObjs: WorldObj[],
  npcList?: { x: number; y: number; sprite: { ch: string; fg: number; bg: number }[] }[],
): Sample[] {
  // Create depth buffer
  const buf: Sample[] = new Array(sw * sh);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = { depth: -Infinity, glyph: " ", fg: 0, bg: 0, flags: 0 };
  }

  // Determine visible world range
  const viewRange = Math.floor(22 / cam.zoom) + 10;
  const cx = Math.floor(cam.x), cy = Math.floor(cam.y);

  // Fog parameters — fade to grey at distance
  const fogStart = viewRange * 0.5;
  const fogEnd = viewRange * 0.95;
  const fogColour = rgb6(1, 1, 2); // blue-grey atmospheric fog

  // Collect all terrain columns to render
  type Col = { wx: number; wy: number; h: number; biome: Biome; depth: number; dist: number };
  const columns: Col[] = [];

  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const wx = cx + dx, wy = cy + dy;
      const h = getH(terrain, wx, wy);
      const biome = getBiome(terrain, wx, wy);

      // Compute depth for sorting
      const rx = wx - cam.x, ry = wy - cam.y;
      const yr = cam.yaw * Math.PI / 180;
      const depth = rx * Math.sin(yr) + ry * Math.cos(yr);

      const dist = Math.sqrt(dx*dx + dy*dy);
      columns.push({ wx, wy, h, biome, depth, dist });
    }
  }

  // Sort back to front (furthest first)
  columns.sort((a, b) => b.depth - a.depth);

  // Height scale: how many world height units = 1 screen row
  const heightScale = 8;

  // Directional light — sun direction rotates slowly
  // Day/night cycle — sun orbits slowly, elevation changes lighting mood
  const dayProgress = (tick * 0.003) % 1; // 0-1 full day cycle (~330 ticks = ~42s)
  const sunAngle = dayProgress * Math.PI * 2;
  const lightX = Math.cos(sunAngle);
  const lightY = Math.sin(sunAngle);
  // Sun elevation: high at noon (0.25), low at dawn/dusk, below horizon at night
  const sunElevation = Math.sin(dayProgress * Math.PI * 2) * 0.5 + 0.5;
  const lightZ = 0.3 + sunElevation * 0.6; // 0.3 to 0.9

  for (const col of columns) {
    const { wx, wy, h, biome, dist } = col;
    // Fog factor: 0 = no fog, 1 = full fog
    const fogT = dist <= fogStart ? 0 : dist >= fogEnd ? 1 : (dist - fogStart) / (fogEnd - fogStart);
    const mat = MATERIALS[biome];

    // Surface normal from height differences
    const hL = getH(terrain, wx-1, wy);
    const hR = getH(terrain, wx+1, wy);
    const hU = getH(terrain, wx, wy-1);
    const hD = getH(terrain, wx, wy+1);
    const nx = (hL - hR) / 32;
    const ny = (hU - hD) / 32;
    const nz = 1;
    const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);

    // Diffuse lighting
    const dot = (nx/nLen * lightX + ny/nLen * lightY + nz/nLen * lightZ);
    const diffuse = Math.max(0.15, Math.min(1, dot * 0.5 + 0.5));

    // Choose colour based on lighting — use fg+bg dithering for texture
    // Add per-cell variation to create the rich look of the original
    const cellNoise = hash2d(wx * 7, wy * 13, 42);
    let fg: number, bg: number;
    if (diffuse > 0.65) {
      fg = cellNoise > 0.5 ? mat.fgLight : mat.fgMid;
      bg = cellNoise > 0.3 ? mat.bgLight : mat.bgDark;
    } else if (diffuse > 0.35) {
      fg = cellNoise > 0.5 ? mat.fgMid : mat.fgDark;
      bg = mat.bgDark;
    } else {
      fg = mat.fgDark;
      bg = cellNoise > 0.5 ? mat.bgDark : mat.bgLight;
    }
    // Fog blend — lerp ANSI indices towards fog colour at distance
    if (fogT > 0.1) {
      fg = fogT > 0.8 ? fogColour : fg;
      bg = fogT > 0.6 ? fogColour : bg;
    }

    // Top face height in world units
    const topZ = h / heightScale;

    // Water level — flatten water surfaces
    const waterLevel = 60;
    const isWater = biome === Biome.DEEP_WATER || biome === Biome.WATER;
    const effectiveZ = isWater ? waterLevel / heightScale : topZ;

    // Project the top face of this column
    const topProj = projectPoint(wx, wy, effectiveZ, cam, sw, sh);

    // Select glyph — animated for water, hash-based for others
    let gi: number;
    if (isWater) {
      gi = (tick + wx + wy) % mat.topGlyphs.length;
    } else {
      gi = Math.abs((wx * 7 + wy * 13) % mat.topGlyphs.length);
    }
    const topGlyph = mat.topGlyphs[gi];
    const topFlags = isWater ? 4 : 1;

    // Render as a 2x1 block to fill gaps at oblique yaw angles
    for (let px = 0; px < 2; px++) {
      const sx = topProj.sx + px;
      if (sx < 0 || sx >= sw || topProj.sy < 0 || topProj.sy >= sh) continue;
      const idx = topProj.sy * sw + sx;
      if (topProj.depth > buf[idx].depth) {
        buf[idx] = {
          depth: topProj.depth,
          glyph: topGlyph,
          fg, bg,
          flags: topFlags,
        };
      }
    }

    // Draw side/cliff faces — the key to the 3D look!
    // For each column, draw vertical side from ground up to top
    if (!isWater) {
      // Check what's "in front" of this column (screen-space)
      // The 3D effect comes from rendering the vertical extent of tall cells
      const groundZ = Math.max(0, Math.min(
        getH(terrain, wx, wy + 1),
        getH(terrain, wx + 1, wy),
        getH(terrain, wx - 1, wy),
        getH(terrain, wx, wy - 1),
      )) / heightScale;

      const visibleHeight = effectiveZ - groundZ;
      if (visibleHeight > 1) {
        const sideSteps = Math.min(10, Math.ceil(visibleHeight / 1.2));
        for (let s = 1; s <= sideSteps; s++) {
          const sideZ = effectiveZ - s * (visibleHeight / sideSteps);
          const sideProj = projectPoint(wx, wy, sideZ, cam, sw, sh);
          const sideDarkness = 0.4 + (s / sideSteps) * 0.3;
          const sideFg = fogT > 0.8 ? fogColour : sideDarkness > 0.5 ? mat.fgDark : mat.fgMid;
          const sideBg = fogT > 0.6 ? fogColour : mat.bgDark;
          const sideGi = s % mat.sideGlyphs.length;
          // 2-wide block for gap filling
          for (let px = 0; px < 2; px++) {
            const ssx = sideProj.sx + px;
            if (ssx < 0 || ssx >= sw || sideProj.sy < 0 || sideProj.sy >= sh) continue;
            const sideIdx = sideProj.sy * sw + ssx;
            if (sideProj.depth > buf[sideIdx].depth) {
              buf[sideIdx] = {
                depth: sideProj.depth,
                glyph: mat.sideGlyphs[sideGi],
                fg: sideFg, bg: sideBg,
                flags: 1,
              };
            }
          }
        }
      }
    }
  }

  // ─── Draw world objects (trees, bushes, etc.) ────────────
  // Filter to visible objects and sort by depth (back to front)
  const visibleObjs: { obj: WorldObj; depth: number; dist: number }[] = [];
  for (const obj of worldObjs) {
    const dx = obj.x - cam.x, dy = obj.y - cam.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > viewRange) continue;
    const yr = cam.yaw * Math.PI / 180;
    const depth = dx * Math.sin(yr) + dy * Math.cos(yr);
    visibleObjs.push({ obj, depth, dist });
  }
  visibleObjs.sort((a, b) => b.depth - a.depth);

  for (const { obj, depth: objDepth, dist } of visibleObjs) {
    const sprite = OBJ_SPRITES[obj.kind];
    if (!sprite) continue;
    const fogT = dist <= fogStart ? 0 : dist >= fogEnd ? 1 : (dist - fogStart) / (fogEnd - fogStart);
    if (fogT > 0.85) continue; // too fogged to see

    const oh = getH(terrain, obj.x, obj.y);
    const baseZ = oh / heightScale;

    // Render each row of the sprite from bottom to top
    for (let row = 0; row < sprite.rows.length; row++) {
      const rowData = sprite.rows[row];
      const rowZ = baseZ + (row + 1) * 2.2 * obj.size;
      const proj = projectPoint(obj.x, obj.y, rowZ, cam, sw, sh);

      for (let cx = 0; cx < rowData.length; cx++) {
        const cell = rowData[cx];
        if (!cell) continue;
        const screenX = proj.sx + (cx - 1) * 2; // centre the 3-wide sprite, 2-wide columns
        for (let px = 0; px < 2; px++) {
          const bx = screenX + px;
          if (bx < 0 || bx >= sw || proj.sy < 0 || proj.sy >= sh) continue;
          const bidx = proj.sy * sw + bx;
          if (objDepth > buf[bidx].depth) {
            let fg = cell.fg, bg = cell.bg;
            // Apply fog
            if (fogT > 0.3) {
              fg = fogT > 0.6 ? fogColour : fg;
              bg = fogT > 0.5 ? fogColour : bg;
            }
            buf[bidx] = { depth: objDepth, glyph: cell.ch, fg, bg, flags: 1 };
          }
        }
      }
    }
  }

  // Draw player sprite — multi-cell coloured character from asciicker
  const ph = getH(terrain, Math.floor(playerX), Math.floor(playerY));
  const pz = ph / heightScale + 4; // sprite floats above terrain
  const pp = projectPoint(playerX, playerY, pz, cam, sw, sh);
  if (pp.sx >= 0 && pp.sx < sw && pp.sy >= 0 && pp.sy < sh) {
    // Blit the sprite centred on the projected position
    const sprW = PLAYER_SPRITE.w, sprH = PLAYER_SPRITE.h;
    const ox = pp.sx - Math.floor(sprW / 2);
    const oy = pp.sy - Math.floor(sprH / 2);
    for (let sy = 0; sy < sprH; sy++) {
      for (let sx = 0; sx < sprW; sx++) {
        const cell = PLAYER_SPRITE.cells[sy * sprW + sx];
        if (!cell) continue;
        const bx = ox + sx, by = oy + sy;
        if (bx < 0 || bx >= sw || by < 0 || by >= sh) continue;
        const bidx = by * sw + bx;
        buf[bidx] = {
          depth: pp.depth + 100, // always on top
          glyph: cell.ch,
          fg: spriteRgbToAnsi(cell.fg),
          bg: cell.bg[0] === 0 && cell.bg[1] === 0 && cell.bg[2] === 0
            ? buf[bidx].bg // transparent black bg → keep terrain bg
            : spriteRgbToAnsi(cell.bg),
          flags: 2,
        };
      }
    }
    // Draw shadow below player
    const shadowProj = projectPoint(playerX, playerY, ph / heightScale, cam, sw, sh);
    if (shadowProj.sx >= 0 && shadowProj.sx < sw &&
        shadowProj.sy >= 0 && shadowProj.sy < sh) {
      const si = shadowProj.sy * sw + shadowProj.sx;
      if (buf[si].flags !== 2) {
        buf[si] = { ...buf[si], glyph: "◦", fg: grey(3) };
      }
    }
  }

  // ─── Water reflections ────────────────────────────────────
  // For each water cell, look "above" it in screen space for terrain
  // and dim-copy it as a reflection
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = y * sw + x;
      const s = buf[idx];
      if (s.flags !== 4) continue; // only water cells

      // Look for the nearest terrain cell above this in screen space
      for (let ry = 1; ry <= 6; ry++) {
        const sourceY = y - ry * 2; // reflection source is above
        if (sourceY < 0) break;
        const sourceIdx = sourceY * sw + x;
        const source = buf[sourceIdx];
        if (source.flags === 1 || source.flags === 2) {
          // Dim the reflection — shift colours toward water blue
          const waterFg = rgb6(0, 1, 3);
          const reflFg = (ry <= 2) ? source.fg : waterFg;
          buf[idx] = {
            ...s,
            glyph: ry <= 3 ? source.glyph : s.glyph,
            fg: reflFg,
            bg: rgb6(0, 1, Math.max(2, 4 - ry)),
          };
          break;
        }
      }
    }
  }

  // ─── NPC sprites ──────────────────────────────────────
  if (npcList) {
    for (const npc of npcList) {
      const ndx = npc.x - cam.x, ndy = npc.y - cam.y;
      const nDist = Math.sqrt(ndx * ndx + ndy * ndy);
      if (nDist > viewRange) continue;
      const nh = getH(terrain, Math.floor(npc.x), Math.floor(npc.y));
      const nz = nh / heightScale;
      for (let row = 0; row < npc.sprite.length; row++) {
        const cell = npc.sprite[row];
        const rz = nz + (npc.sprite.length - row) * 1.5;
        const proj = projectPoint(npc.x, npc.y, rz, cam, sw, sh);
        for (let px = 0; px < 2; px++) {
          const bx = proj.sx + px;
          if (bx < 0 || bx >= sw || proj.sy < 0 || proj.sy >= sh) continue;
          const bidx = proj.sy * sw + bx;
          const yr2 = cam.yaw * Math.PI / 180;
          const npcDepth = ndx * Math.sin(yr2) + ndy * Math.cos(yr2);
          if (npcDepth > buf[bidx].depth) {
            buf[bidx] = {
              depth: npcDepth,
              glyph: cell.ch,
              fg: cell.fg,
              bg: cell.bg === 16 ? buf[bidx].bg : cell.bg, // 16 = rgb6(0,0,0) = transparent
              flags: 2,
            };
          }
        }
      }
    }
  }

  // ─── Minimap overlay — top-right corner ────────────────
  const mmSize = 16;
  const mmOx = sw - mmSize - 2, mmOy = 2;
  const mmScale = 4;
  for (let my = 0; my < mmSize; my++) {
    for (let mx = 0; mx < mmSize; mx++) {
      const wmx = Math.floor(playerX) - mmSize * mmScale / 2 + mx * mmScale;
      const wmy = Math.floor(playerY) - mmSize * mmScale / 2 + my * mmScale;
      const b = getBiome(terrain, wmx, wmy);
      const px = mmOx + mx, py = mmOy + my;
      if (px < 0 || px >= sw || py < 0 || py >= sh) continue;
      const bidx = py * sw + px;
      let mmFg = grey(8), mmBg = grey(4), mmCh = "·";
      switch (b) {
        case Biome.DEEP_WATER: mmFg = rgb6(0, 0, 3); mmBg = rgb6(0, 0, 2); mmCh = "≈"; break;
        case Biome.WATER: mmFg = rgb6(0, 1, 4); mmBg = rgb6(0, 1, 3); mmCh = "~"; break;
        case Biome.SAND: mmFg = rgb6(5, 5, 2); mmBg = rgb6(4, 4, 1); mmCh = "."; break;
        case Biome.GRASS: mmFg = rgb6(1, 4, 0); mmBg = rgb6(0, 3, 0); mmCh = "."; break;
        case Biome.FOREST: mmFg = rgb6(0, 3, 0); mmBg = rgb6(0, 2, 0); mmCh = "♣"; break;
        case Biome.ROCK: mmFg = grey(12); mmBg = grey(6); mmCh = "#"; break;
        case Biome.MOUNTAIN: mmFg = grey(14); mmBg = grey(8); mmCh = "▲"; break;
        case Biome.SNOW: mmFg = grey(22); mmBg = grey(18); mmCh = "*"; break;
      }
      if (mx === Math.floor(mmSize / 2) && my === Math.floor(mmSize / 2)) {
        mmFg = rgb6(5, 0, 0); mmBg = rgb6(5, 5, 0); mmCh = "◎";
      }
      buf[bidx] = { depth: Infinity, glyph: mmCh, fg: mmFg, bg: mmBg, flags: 1 };
    }
  }

  return buf;
}

// ─── Convert buffer to ANSI string ─────────────────────────

function bufferToAnsi(buf: Sample[], sw: number, sh: number, tick: number, sunElevation: number = 0.7): string {
  // Sky gradient — 5 zones for smooth atmospheric transition
  // Shifts with day/night: darker at night, warmer at dawn/dusk
  const nightFactor = 1 - sunElevation; // 0 at noon, 1 at midnight
  const skyZones = [
    rgb6(0, 0, Math.max(1, Math.round(2 - nightFactor))),
    rgb6(0, 0, Math.max(1, Math.round(2 - nightFactor * 0.5))),
    rgb6(0, Math.round(1 - nightFactor * 0.5), Math.round(3 - nightFactor)),
    rgb6(Math.round(1 - nightFactor * 0.5), Math.round(2 - nightFactor), Math.round(4 - nightFactor)),
    rgb6(Math.round(2 - nightFactor), Math.round(3 - nightFactor), 5),
  ];
  const skyGlyphs = ["·", "∙", "✦", " ", " ", " ", " ", " "];

  const lines: string[] = [];
  for (let y = 0; y < sh; y++) {
    let line = "";
    let lastFg = -1, lastBg = -1;
    const skyProgress = y / sh;
    const zoneIdx = Math.min(4, Math.floor(skyProgress * 5));
    const skyBg = skyZones[zoneIdx];
    const skyFg = skyProgress < 0.15 ? grey(Math.round(16 - nightFactor * 8)) : skyBg;

    for (let x = 0; x < sw; x++) {
      const s = buf[y * sw + x];
      if (s.flags === 0) {
        // Sky background instead of black
        const thisSkyFg = skyFg;
        const thisSkyBg = skyBg;
        // Sparse stars in upper sky
        const isStar = y < sh * 0.25 && ((x * 7 + y * 13 + tick) % 47 === 0);
        const skyChar = isStar ? skyGlyphs[0] : " ";
        if (thisSkyFg !== lastFg || thisSkyBg !== lastBg) {
          line += `\x1b[38;5;${thisSkyFg};48;5;${thisSkyBg}m`;
          lastFg = thisSkyFg; lastBg = thisSkyBg;
        }
        line += skyChar;
      } else {
        // Emit ANSI colour codes only when changed
        if (s.fg !== lastFg && s.bg !== lastBg) {
          line += `\x1b[38;5;${s.fg};48;5;${s.bg}m`;
        } else if (s.fg !== lastFg) {
          line += `\x1b[38;5;${s.fg}m`;
        } else if (s.bg !== lastBg) {
          line += `\x1b[48;5;${s.bg}m`;
        }
        lastFg = s.fg;
        lastBg = s.bg;
        line += s.glyph;
      }
    }
    lines.push(line);
  }
  return lines.join("\n") + "\x1b[0m";
}

// ─── Module setup ───────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Asciicker",
    description: "Open the ASCII 3D world explorer",
    menu: [{ category: "applications", order: 170, label: "Asciicker" }],
    palette: { order: 170, label: "Open Asciicker" },
    action: () => openAsciicker(host),
  });
}

function openAsciicker(host: MicroappHost) {
  const win = host.createWindow({ title: "Asciicker", width: 80, height: 32 });
  // Defer maximize — registration is async, need it to complete first
  setTimeout(() => win.maximize(), 50);
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

  // World generation
  const worldSeed = Math.floor(Math.random() * 100000);
  const terrain = genTerrain(256, 256, worldSeed);
  const worldObjs = placeObjects(terrain, worldSeed);

  // ─── NPC entities — patrol the terrain ────────────────
  interface NPC {
    x: number; y: number;
    homeX: number; homeY: number;
    dx: number; dy: number;
    sprite: { ch: string; fg: number; bg: number }[];
    name: string;
    patrolRadius: number;
  }

  const npcs: NPC[] = [];
  const npcSprites = [
    { name: "Villager", ch: "☺", fg: rgb6(5, 4, 2), bg: rgb6(3, 2, 1), cells: [
      { ch: "○", fg: rgb6(5, 4, 2), bg: rgb6(0, 0, 0) },
      { ch: "╬", fg: rgb6(2, 2, 4), bg: rgb6(0, 0, 0) },
      { ch: "∏", fg: rgb6(3, 2, 1), bg: rgb6(0, 0, 0) },
    ]},
    { name: "Guard", ch: "☻", fg: rgb6(4, 4, 4), bg: rgb6(2, 0, 0), cells: [
      { ch: "▲", fg: rgb6(4, 4, 4), bg: rgb6(0, 0, 0) },
      { ch: "╬", fg: rgb6(4, 0, 0), bg: rgb6(0, 0, 0) },
      { ch: "∏", fg: rgb6(3, 2, 1), bg: rgb6(0, 0, 0) },
    ]},
    { name: "Merchant", ch: "$", fg: rgb6(5, 5, 0), bg: rgb6(3, 2, 0), cells: [
      { ch: "♦", fg: rgb6(5, 5, 0), bg: rgb6(0, 0, 0) },
      { ch: "╬", fg: rgb6(4, 3, 0), bg: rgb6(0, 0, 0) },
      { ch: "∏", fg: rgb6(3, 2, 1), bg: rgb6(0, 0, 0) },
    ]},
  ];

  // Place NPCs on grass/sand areas
  for (let i = 0; i < 12; i++) {
    const sx = Math.floor(hash2d(i * 97, worldSeed * 3, 77) * (terrain.w - 40)) + 20;
    const sy = Math.floor(hash2d(worldSeed * 5, i * 61, 88) * (terrain.h - 40)) + 20;
    const b = getBiome(terrain, sx, sy);
    if (b !== Biome.GRASS && b !== Biome.SAND && b !== Biome.FOREST) continue;
    const spriteType = npcSprites[i % npcSprites.length];
    npcs.push({
      x: sx, y: sy, homeX: sx, homeY: sy,
      dx: (hash2d(i, worldSeed, 33) - 0.5) * 0.3,
      dy: (hash2d(worldSeed, i, 44) - 0.5) * 0.3,
      sprite: spriteType.cells, name: spriteType.name,
      patrolRadius: 5 + Math.floor(hash2d(i * 7, worldSeed, 55) * 8),
    });
  }

  // Find grass starting position
  let startX = 128, startY = 128;
  outer: for (let r = 0; r < 30; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const b = getBiome(terrain, 128+dx, 128+dy);
        if (b === Biome.GRASS || b === Biome.SAND) {
          startX = 128 + dx; startY = 128 + dy;
          break outer;
        }
      }
    }
  }

  let playerX = startX, playerY = startY;
  const cam: Camera = {
    x: startX, y: startY, z: getH(terrain, startX, startY) / 8,
    yaw: 45, pitch: 30, zoom: 1.0,
  };
  let tick = 0;
  const keys = new Set<string>();

  function getContentSize() {
    return {
      w: Math.max(8, Number(canvas.width) || 60),
      h: Math.max(4, Number(canvas.height) || 24),
    };
  }

  const biomeNames = ["Deep Water", "Shallows", "Sand", "Grassland", "Forest", "Rock", "Mountain", "Snow"];

  function updateDisplay() {
    const { w, h } = getContentSize();

    // Process movement — screen-relative with terrain collision
    const yr = cam.yaw * Math.PI / 180;
    const cosY = Math.cos(yr), sinY = Math.sin(yr);
    const upWX = sinY, upWY = -cosY;    // screen-up → world
    const rtWX = cosY, rtWY = sinY;     // screen-right → world

    // Speed varies with terrain — slower uphill, faster downhill
    const currentH = getH(terrain, Math.floor(playerX), Math.floor(playerY));
    const baseSpeed = 0.5;
    let dx = 0, dy = 0;
    if (keys.has("w") || keys.has("up"))    { dx += upWX; dy += upWY; }
    if (keys.has("s") || keys.has("down"))  { dx -= upWX; dy -= upWY; }
    if (keys.has("d") || keys.has("right")) { dx += rtWX; dy += rtWY; }
    if (keys.has("a") || keys.has("left"))  { dx -= rtWX; dy -= rtWY; }

    if (dx !== 0 || dy !== 0) {
      // Normalise diagonal movement
      const len = Math.sqrt(dx*dx + dy*dy);
      dx = dx/len * baseSpeed;
      dy = dy/len * baseSpeed;

      const newX = playerX + dx, newY = playerY + dy;
      const nx = Math.floor(newX), ny = Math.floor(newY);

      // Terrain collision: can't walk into deep water or off map
      if (nx >= 2 && nx < terrain.w - 3 && ny >= 2 && ny < terrain.h - 3) {
        const targetBiome = getBiome(terrain, nx, ny);
        const targetH = getH(terrain, nx, ny);
        const heightDiff = targetH - currentH;

        // Block deep water and steep cliffs (>40 height units up)
        if (targetBiome !== Biome.DEEP_WATER && heightDiff < 40) {
          // Slow down going uphill
          const slopeFactor = heightDiff > 10 ? 0.5 : heightDiff > 0 ? 0.8 : 1.0;
          playerX += dx * slopeFactor;
          playerY += dy * slopeFactor;
        }
      }
    }

    playerX = Math.max(2, Math.min(terrain.w-3, playerX));
    playerY = Math.max(2, Math.min(terrain.h-3, playerY));

    // Smooth camera follow with height tracking
    const targetZ = getH(terrain, Math.floor(playerX), Math.floor(playerY)) / 8;
    cam.x += (playerX - cam.x) * 0.15;
    cam.y += (playerY - cam.y) * 0.15;
    cam.z += (targetZ - cam.z) * 0.1;

    // Update NPCs — simple patrol AI
    for (const npc of npcs) {
      npc.x += npc.dx;
      npc.y += npc.dy;
      // Bounce off patrol radius
      const distFromHome = Math.sqrt((npc.x - npc.homeX) ** 2 + (npc.y - npc.homeY) ** 2);
      if (distFromHome > npc.patrolRadius) {
        npc.dx = (npc.homeX - npc.x) * 0.05;
        npc.dy = (npc.homeY - npc.y) * 0.05;
      }
      // Random direction change
      if (hash2d(tick + npc.homeX, npc.homeY, 99) < 0.02) {
        npc.dx = (hash2d(tick, npc.homeX, 11) - 0.5) * 0.3;
        npc.dy = (hash2d(npc.homeY, tick, 22) - 0.5) * 0.3;
      }
      // Clamp to terrain
      npc.x = Math.max(2, Math.min(terrain.w - 3, npc.x));
      npc.y = Math.max(2, Math.min(terrain.h - 3, npc.y));
    }

    // Render 3D scene
    const buf = renderScene(terrain, cam, w, h, playerX, playerY, tick, worldObjs, npcs);
    const dayProg = (tick * 0.003) % 1;
    const sunElev = Math.sin(dayProg * Math.PI * 2) * 0.5 + 0.5;
    const ansi = bufferToAnsi(buf, w, h, tick, sunElev);
    canvas.setContent(ansi);

    // Separator
    sep.setContent("─".repeat(w));

    // Status bar
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    const biomeName = cell ? biomeNames[cell.biome] : "???";
    const alt = cell ? Math.floor(cell.height / 2.55) : 0;
    const yawStr = `${Math.floor(cam.yaw)}°`;
    // Day/night phase name
    const dayPhases = ["Dawn", "Morning", "Noon", "Afternoon", "Dusk", "Evening", "Night", "Late Night"];
    const phaseIdx = Math.floor(dayProg * 8) % 8;
    const sunPct = Math.round(sunElev * 100);
    status.setContent(
      ` ⊕${Math.floor(playerX)},${Math.floor(playerY)}  ▲${alt}m  ${biomeName}  ` +
      `◎${yawStr}  ×${cam.zoom.toFixed(1)}  ☀${dayPhases[phaseIdx]}(${sunPct}%)  ` +
      `WASD:move Q/E:rotate +/-:zoom`
    );

    host.screen.render();
    tick++;
  }

  // Key handling
  const keyHandler = (_ch: string, key: { name?: string } | undefined) => {
    if (!key || !key.name) return;
    const n = key.name.toLowerCase();
    if (n === "q") { cam.yaw = (cam.yaw + 15) % 360; }
    else if (n === "e") { cam.yaw = (cam.yaw + 345) % 360; }
    else if (n === "=") { cam.zoom = Math.min(3, cam.zoom + 0.15); }
    else if (n === "-") { cam.zoom = Math.max(0.4, cam.zoom - 0.15); }
    else if (["w", "a", "s", "d", "up", "down", "left", "right"].includes(n)) {
      keys.add(n);
      setTimeout(() => keys.delete(n), 200);
    }
  };

  host.screen.on("keypress", keyHandler);

  createTimer(() => updateDisplay(), 125, timers);

  win.onResize(() => updateDisplay());

  win.describeState(() => {
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    return {
      summary: `Asciicker — ${Math.floor(playerX)},${Math.floor(playerY)} ${cell ? biomeNames[cell.biome] : ""}`,
      position: { x: Math.floor(playerX), y: Math.floor(playerY) },
      altitude: cell ? Math.floor(cell.height / 2.55) : 0,
      biome: cell ? biomeNames[cell.biome] : "Unknown",
      yaw: Math.floor(cam.yaw),
      zoom: cam.zoom,
      worldSeed,
      worldSize: `${terrain.w}x${terrain.h}`,
      npcCount: npcs.length,
      objectCount: worldObjs.length,
      tick,
    };
  });

  win.captureText(() => {
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    return `Asciicker — pos:${Math.floor(playerX)},${Math.floor(playerY)} alt:${cell ? Math.floor(cell.height / 2.55) : 0}m\n\n${canvas.getContent()}`;
  });

  win.onRestyle(() => {
    const t = host.theme();
    canvas.style = { ...t.body };
    status.style = t.muted ? { fg: t.muted.fg, bg: t.body.bg } : { fg: "grey", bg: t.body.bg };
    sep.style = { ...t.body };
    host.screen.render();
  });

  win.onCleanup(() => {
    host.screen.removeListener("keypress", keyHandler);
    clearTimers(timers);
  });

  win.focus();
}
