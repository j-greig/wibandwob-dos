const MS_LOOKUP = " ╮╭─╰╮│╯╯│╭╰─╭╮ ";
const TAU = Math.PI * 2;

const SHAPE_CIRCLE = 0;
const SHAPE_POLYGON = 1;
const SHAPE_ELLIPSE = 2;
const SHAPE_SUPER = 3;
const SHAPE_ASYM = 4;

const GRID_CHECKER = 0;
const GRID_RANDOM = 1;
const GRID_SEQ = 2;
const GRID_HEX = 3;

export type Hill = readonly [
  cx: number,
  cy: number,
  r: number,
  peak: number,
  shape: number,
  rotation: number,
  aspect: number,
  sides: number,
  power: number
];

export type ContourMode = "chaos" | "order" | "hybrid";

type TerrainFactory = (w: number, h: number, rng: SeededRandom) => Hill[];

class SeededRandom {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  randint(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  choice<T>(items: readonly T[]): T {
    return items[this.randint(0, items.length - 1)];
  }

  weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = this.uniform(0, total);
    for (let index = 0; index < items.length; index += 1) {
      threshold -= weights[index] ?? 0;
      if (threshold <= 0) {
        return items[index]!;
      }
    }
    return items[items.length - 1]!;
  }

  gauss(mean = 0, stddev = 1): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return mean + value * stddev;
    }
    let u = 0;
    let v = 0;
    while (u <= Number.EPSILON) u = this.next();
    while (v <= Number.EPSILON) v = this.next();
    const mag = Math.sqrt(-2 * Math.log(u));
    const z0 = mag * Math.cos(TAU * v);
    const z1 = mag * Math.sin(TAU * v);
    this.spare = z1;
    return mean + z0 * stddev;
  }
}

function blankGrid(width: number, height: number): string[][] {
  return Array.from({ length: Math.max(1, height - 1) }, () =>
    Array.from({ length: Math.max(1, width - 1) }, () => " ")
  );
}

function shapedDistance(dx: number, dy: number, hill: Hill): number {
  const [, , r, , shape, rotation, aspect, sides, power] = hill;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  let lx = dx * cosR + dy * sinR;
  let ly = -dx * sinR + dy * cosR;
  ly /= aspect;

  if (shape === SHAPE_CIRCLE || shape === SHAPE_ELLIPSE) {
    return lx * lx + ly * ly;
  }

  if (shape === SHAPE_POLYGON) {
    const d = Math.sqrt(lx * lx + ly * ly);
    if (d < 1e-9) return 0;
    const angle = Math.atan2(ly, lx);
    const sector = TAU / sides;
    const a = ((angle % sector) + sector) % sector - sector * 0.5;
    const polyScale = Math.cos(Math.PI / sides) / Math.max(Math.cos(a), 1e-9);
    const effective = d / polyScale;
    return effective * effective;
  }

  if (shape === SHAPE_SUPER) {
    const ax = Math.min(Math.abs(lx / r), 10);
    const ay = Math.min(Math.abs(ly / r), 10);
    const superellipse = Math.pow(Math.pow(ax, power) + Math.pow(ay, power), 2 / power);
    return superellipse * r * r;
  }

  if (shape === SHAPE_ASYM) {
    if (lx > 0) {
      lx *= 1.6;
    }
    return lx * lx + ly * ly;
  }

  return lx * lx + ly * ly;
}

export function makeHill(cx: number, cy: number, r: number, peak: number, rngSeed: number | SeededRandom): Hill {
  const rng = typeof rngSeed === "number" ? new SeededRandom(rngSeed) : rngSeed;
  const shape = rng.weightedChoice(
    [SHAPE_CIRCLE, SHAPE_POLYGON, SHAPE_ELLIPSE, SHAPE_SUPER, SHAPE_ASYM] as const,
    [3, 4, 3, 3, 2]
  );
  const rotation = rng.uniform(0, TAU);
  let aspect = 1;
  let sides = 4;
  let power = 2;

  if (shape === SHAPE_POLYGON) {
    sides = rng.randint(3, 8);
    aspect = rng.uniform(0.8, 1.2);
  } else if (shape === SHAPE_ELLIPSE) {
    aspect = rng.uniform(1.5, 3);
  } else if (shape === SHAPE_SUPER) {
    power = rng.uniform(3, 6);
    aspect = rng.uniform(0.7, 1.4);
  } else if (shape === SHAPE_ASYM) {
    aspect = rng.uniform(0.9, 1.5);
  }

  return [cx, cy, r, peak, shape, rotation, aspect, sides, power] as const;
}

export function heightmap(w: number, h: number, hills: readonly Hill[]): number[][] {
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => 0));
  for (const hill of hills) {
    const [cx, cy, r, peak, , , aspect] = hill;
    const r2 = 2 * r * r;
    const reach = 3 * r * aspect;
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(h, Math.ceil(cy + reach) + 1);
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(w, Math.ceil(cx + reach) + 1);

    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const d2 = shapedDistance(x - cx, y - cy, hill);
        grid[y]![x] += peak * Math.exp(-d2 / r2);
      }
    }
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const row of grid) {
    for (const value of row) {
      lo = Math.min(lo, value);
      hi = Math.max(hi, value);
    }
  }
  if (!Number.isFinite(lo) || hi - lo < 1e-9) {
    return grid;
  }
  const scale = 1 / (hi - lo);
  return grid.map((row) => row.map((value) => (value - lo) * scale));
}

export function march(grid: readonly number[][], h: number, w: number, threshold: number): string[][] {
  const rows: string[][] = [];
  for (let y = 0; y < h - 1; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < w - 1; x += 1) {
      let index = 0;
      if (grid[y]![x]! >= threshold) index |= 8;
      if (grid[y]![x + 1]! >= threshold) index |= 4;
      if (grid[y + 1]![x + 1]! >= threshold) index |= 2;
      if (grid[y + 1]![x]! >= threshold) index |= 1;
      row.push(MS_LOOKUP[index] ?? " ");
    }
    rows.push(row);
  }
  return rows;
}

export function composite(layers: readonly string[][][]): string[][] {
  const height = layers[0]?.length ?? 0;
  const width = layers[0]?.[0]?.length ?? 0;
  const canvas = Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
  for (const layer of layers) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = layer[y]?.[x] ?? " ";
        if (cell !== " ") {
          canvas[y]![x] = cell;
        }
      }
    }
  }
  return canvas;
}

function tArchipelago(w: number, h: number, rng: SeededRandom): Hill[] {
  const hills: Hill[] = [];
  for (let index = 0; index < rng.randint(6, 12); index += 1) {
    hills.push(makeHill(
      rng.uniform(w * 0.05, w * 0.95),
      rng.uniform(h * 0.05, h * 0.95),
      rng.uniform(Math.min(w, h) * 0.04, Math.min(w, h) * 0.12),
      rng.uniform(0.3, 1),
      rng
    ));
  }
  return hills;
}

function tSaddlePass(w: number, h: number, rng: SeededRandom): Hill[] {
  const gap = rng.uniform(w * 0.2, w * 0.35);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = Math.min(w, h) * 0.18;
  const hills = [
    makeHill(cx - gap * 0.5, cy - h * 0.05, r, 1, rng),
    makeHill(cx + gap * 0.5, cy + h * 0.05, r * 0.9, 0.85, rng)
  ];
  for (let index = 0; index < rng.randint(2, 5); index += 1) {
    const angle = rng.uniform(0, TAU);
    const distance = rng.uniform(r * 0.8, r * 2);
    hills.push(makeHill(
      cx + Math.cos(angle) * distance,
      cy + Math.sin(angle) * distance,
      rng.uniform(Math.min(w, h) * 0.03, Math.min(w, h) * 0.07),
      rng.uniform(0.15, 0.4),
      rng
    ));
  }
  return hills;
}

function tRidgeValley(w: number, h: number, rng: SeededRandom): Hill[] {
  const hills: Hill[] = [];
  const upper = h * rng.uniform(0.3, 0.5);
  for (let index = 0; index < 8; index += 1) {
    hills.push(makeHill(
      w * (index + 0.5) / 8,
      upper + rng.gauss(0, h * 0.03),
      rng.uniform(Math.min(w, h) * 0.08, Math.min(w, h) * 0.14),
      rng.uniform(0.6, 1),
      rng
    ));
  }
  const lower = h * rng.uniform(0.65, 0.8);
  for (let index = 0; index < 5; index += 1) {
    hills.push(makeHill(
      w * (index + 0.5) / 5,
      lower + rng.gauss(0, h * 0.02),
      rng.uniform(Math.min(w, h) * 0.05, Math.min(w, h) * 0.1),
      rng.uniform(0.3, 0.6),
      rng
    ));
  }
  return hills;
}

function tCaldera(w: number, h: number, rng: SeededRandom): Hill[] {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const rimRadius = Math.min(w, h) * rng.uniform(0.2, 0.3);
  const count = rng.randint(6, 10);
  const hills: Hill[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = TAU * index / count + rng.gauss(0, 0.2);
    hills.push(makeHill(
      cx + Math.cos(angle) * rimRadius,
      cy + Math.sin(angle) * rimRadius,
      rng.uniform(Math.min(w, h) * 0.06, Math.min(w, h) * 0.12),
      rng.uniform(0.6, 1),
      rng
    ));
  }
  hills.push(makeHill(cx + rng.gauss(0, 2), cy + rng.gauss(0, 2), Math.min(w, h) * 0.04, 0.5, rng));
  return hills;
}

function tLonePeak(w: number, h: number, rng: SeededRandom): Hill[] {
  const cx = w * rng.uniform(0.35, 0.65);
  const cy = h * rng.uniform(0.35, 0.65);
  const r = Math.min(w, h) * 0.2;
  const hills = [makeHill(cx, cy, r, 1, rng)];
  for (let index = 0; index < rng.randint(4, 8); index += 1) {
    const angle = rng.uniform(0, TAU);
    const distance = rng.uniform(r * 0.6, r * 2.5);
    hills.push(makeHill(
      cx + Math.cos(angle) * distance,
      cy + Math.sin(angle) * distance,
      rng.uniform(Math.min(w, h) * 0.03, Math.min(w, h) * 0.08),
      rng.uniform(0.15, 0.45),
      rng
    ));
  }
  return hills;
}

function tMeadow(w: number, h: number, rng: SeededRandom): Hill[] {
  const hills: Hill[] = [];
  for (let index = 0; index < rng.randint(5, 9); index += 1) {
    hills.push(makeHill(
      rng.uniform(w * 0.05, w * 0.95),
      rng.uniform(h * 0.05, h * 0.95),
      rng.uniform(Math.min(w, h) * 0.1, Math.min(w, h) * 0.25),
      rng.uniform(0.3, 0.8),
      rng
    ));
  }
  for (let index = 0; index < rng.randint(1, 3); index += 1) {
    hills.push(makeHill(
      rng.uniform(w * 0.1, w * 0.9),
      rng.uniform(h * 0.1, h * 0.9),
      rng.uniform(Math.min(w, h) * 0.04, Math.min(w, h) * 0.08),
      rng.uniform(0.6, 1),
      rng
    ));
  }
  return hills;
}

function tTwinPeaks(w: number, h: number, rng: SeededRandom): Hill[] {
  const separation = rng.uniform(w * 0.15, w * 0.3);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r1 = rng.uniform(Math.min(w, h) * 0.12, Math.min(w, h) * 0.2);
  const r2 = rng.uniform(Math.min(w, h) * 0.1, Math.min(w, h) * 0.18);
  const hills = [
    makeHill(cx - separation * 0.5, cy, r1, 1, rng),
    makeHill(cx + separation * 0.5, cy, r2, rng.uniform(0.7, 0.95), rng)
  ];
  for (let index = 0; index < rng.randint(3, 6); index += 1) {
    const angle = rng.uniform(0, TAU);
    const distance = rng.uniform(separation * 0.3, separation * 1.5);
    hills.push(makeHill(
      cx + Math.cos(angle) * distance,
      cy + Math.sin(angle) * distance,
      rng.uniform(Math.min(w, h) * 0.03, Math.min(w, h) * 0.07),
      rng.uniform(0.2, 0.5),
      rng
    ));
  }
  return hills;
}

const TERRAIN_FACTORIES: readonly [string, TerrainFactory][] = [
  ["archipelago", tArchipelago],
  ["saddle pass", tSaddlePass],
  ["ridge valley", tRidgeValley],
  ["caldera", tCaldera],
  ["lone peak", tLonePeak],
  ["meadow", tMeadow],
  ["twin peaks", tTwinPeaks]
] as const;

export const terrainNames = TERRAIN_FACTORIES.map(([name]) => name);

export function generateTerrainHills(w: number, h: number, seed: number, terrainIdx: number): Hill[] {
  const rng = new SeededRandom(seed);
  const terrain = TERRAIN_FACTORIES[((terrainIdx % TERRAIN_FACTORIES.length) + TERRAIN_FACTORIES.length) % TERRAIN_FACTORIES.length];
  return terrain?.[1](w, h, rng) ?? [];
}

function gridCell(row: number, col: number, pattern: number, rng: SeededRandom): string {
  if (pattern === GRID_CHECKER) return (row + col) % 2 ? "1" : "0";
  if (pattern === GRID_RANDOM) return String(rng.randint(0, 1));
  if (pattern === GRID_SEQ) return "0123456789ABCDEF"[(row * 16 + col) % 16]!;
  if (pattern === GRID_HEX) return "0123456789ABCDEF"[rng.randint(0, 15)]!;
  return "0";
}

function renderGridCluster(
  canvas: string[][],
  cx: number,
  cy: number,
  radius: number,
  density: number,
  cellSize: number,
  pattern: number,
  rng: SeededRandom
): void {
  const ch = canvas.length;
  const cw = canvas[0]?.length ?? 0;
  const step = cellSize + 1;
  const cols = Math.max(2, Math.floor((2 * radius) / step));
  const rows = Math.max(2, Math.floor((2 * radius) / (step * 0.5)));
  const x0 = Math.floor(cx - (cols * step + 1) / 2);
  const y0 = Math.floor(cy - rows);

  for (let gridRow = 0; gridRow <= rows; gridRow += 1) {
    const y = y0 + gridRow * 2;
    if (y < 0 || y >= ch) continue;
    for (let gridCol = 0; gridCol <= cols; gridCol += 1) {
      const x = x0 + gridCol * step;
      if (x < 0 || x >= cw) continue;
      let cell = "┼";
      if (gridRow === 0 && gridCol === 0) cell = "┌";
      else if (gridRow === 0 && gridCol === cols) cell = "┐";
      else if (gridRow === rows && gridCol === 0) cell = "└";
      else if (gridRow === rows && gridCol === cols) cell = "┘";
      else if (gridRow === 0) cell = "┬";
      else if (gridRow === rows) cell = "┴";
      else if (gridCol === 0) cell = "├";
      else if (gridCol === cols) cell = "┤";
      canvas[y]![x] = cell;
      if (gridCol < cols) {
        for (let dx = 1; dx < step; dx += 1) {
          const borderX = x + dx;
          if (borderX >= 0 && borderX < cw) {
            canvas[y]![borderX] = "─";
          }
        }
      }
    }

    if (gridRow >= rows) continue;
    const contentY = y + 1;
    if (contentY < 0 || contentY >= ch) continue;
    for (let gridCol = 0; gridCol <= cols; gridCol += 1) {
      const x = x0 + gridCol * step;
      if (x >= 0 && x < cw) {
        canvas[contentY]![x] = "│";
      }
    }
    for (let gridCol = 0; gridCol < cols; gridCol += 1) {
      if (rng.next() > density) continue;
      for (let dx = 1; dx < step; dx += 1) {
        const contentX = x0 + gridCol * step + dx;
        if (contentX >= 0 && contentX < cw) {
          canvas[contentY]![contentX] = gridCell(gridRow, gridCol * cellSize + dx - 1, pattern, rng);
        }
      }
    }
  }
}

function generateOrderedFromHills(w: number, h: number, seed: number, hills: readonly Hill[]): string[] {
  const canvas = blankGrid(w, h);
  const rng = new SeededRandom(seed + 7777);
  const patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX] as const;

  for (const hill of hills) {
    const [cx, cy, radius, peak] = hill;
    renderGridCluster(
      canvas,
      Math.floor(cx),
      Math.floor(cy),
      radius,
      0.3 + peak * 0.6,
      rng.choice([1, 1, 1, 2]),
      rng.choice(patterns),
      rng
    );
  }

  return canvas.map((row) => row.join(""));
}

export function generateOrdered(w: number, h: number, seed: number, terrainIdx: number): string[] {
  return generateOrderedFromHills(w, h, seed, generateTerrainHills(w, h, seed, terrainIdx));
}

function generateHybridFromHills(
  w: number,
  h: number,
  nLevels: number,
  seed: number,
  hills: readonly Hill[],
  orderRatio: number
): string[] {
  if (hills.length === 0) {
    return blankGrid(w, h).map((row) => row.join(""));
  }
  const heights = heightmap(w, h, hills);
  const thresholds = Array.from({ length: nLevels }, (_, index) => (index + 1) / (nLevels + 1));
  const contourCanvas = composite(thresholds.map((threshold) => march(heights, h, w, threshold)));
  const gridCanvas = blankGrid(w, h);
  const rng = new SeededRandom(seed + 7777);
  const patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX] as const;

  for (const hill of hills) {
    const [cx, cy, radius, peak] = hill;
    renderGridCluster(gridCanvas, Math.floor(cx), Math.floor(cy), radius * 0.7, 0.3 + peak * 0.6, 1, rng.choice(patterns), rng);
  }

  const flat = heights.flat().slice().sort((a, b) => a - b);
  const cutoff = flat[Math.min(flat.length - 1, Math.floor(flat.length * orderRatio))] ?? 0;
  const rows = Math.min(contourCanvas.length, gridCanvas.length);
  const cols = Math.min(contourCanvas[0]?.length ?? 0, gridCanvas[0]?.length ?? 0);
  const result = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const heightValue = heights[Math.min(y, heights.length - 1)]?.[Math.min(x, (heights[0]?.length ?? 1) - 1)] ?? 0;
      const primary = heightValue <= cutoff ? gridCanvas : contourCanvas;
      const fallback = heightValue <= cutoff ? contourCanvas : gridCanvas;
      result[y]![x] = primary[y]?.[x] !== " " ? primary[y]![x]! : fallback[y]?.[x] ?? " ";
    }
  }

  return result.map((row) => row.join(""));
}

export function generateHybrid(
  w: number,
  h: number,
  nLevels: number,
  seed: number,
  terrainIdx: number,
  orderRatio = 0.5
): string[] {
  return generateHybridFromHills(w, h, nLevels, seed, generateTerrainHills(w, h, seed, terrainIdx), orderRatio);
}

export function renderFromHills(w: number, h: number, nLevels: number, hills: readonly Hill[]): string[] {
  if (hills.length === 0) {
    return blankGrid(w, h).map((row) => row.join(""));
  }
  const heights = heightmap(w, h, hills);
  const thresholds = Array.from({ length: nLevels }, (_, index) => (index + 1) / (nLevels + 1));
  return composite(thresholds.map((threshold) => march(heights, h, w, threshold))).map((row) => row.join(""));
}

export function renderContourFromHills(
  w: number,
  h: number,
  opts: {
    mode: ContourMode;
    seed: number;
    terrainIdx: number;
    nLevels: number;
    orderRatio?: number;
    hills: readonly Hill[];
  }
): string[] {
  if (opts.mode === "order") {
    return generateOrderedFromHills(w, h, opts.seed, opts.hills);
  }
  if (opts.mode === "hybrid") {
    return generateHybridFromHills(w, h, opts.nLevels, opts.seed, opts.hills, opts.orderRatio ?? 0.5);
  }
  return renderFromHills(w, h, opts.nLevels, opts.hills);
}

export function renderContour(
  w: number,
  h: number,
  opts: {
    mode: ContourMode;
    seed: number;
    terrainIdx: number;
    nLevels: number;
    orderRatio?: number;
  }
): string[] {
  return renderContourFromHills(w, h, {
    ...opts,
    hills: generateTerrainHills(w, h, opts.seed, opts.terrainIdx)
  });
}
