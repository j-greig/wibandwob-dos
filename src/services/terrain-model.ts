import {
  generateTerrainHills,
  heightmap,
  terrainNames,
  type Hill,
} from "./contour-engine.js";

export type TerrainBiome =
  | "deep-water"
  | "shallow-water"
  | "shore"
  | "plain"
  | "forest"
  | "hill"
  | "ridge"
  | "peak";

export type TerrainObject = "tree" | "pine" | "house" | "rock" | "flower" | "boat" | "bush" | null;

export interface TerrainCell {
  elevation: number;
  relativeElevation: number;
  waterDepth: number;
  isWater: boolean;
  biome: TerrainBiome;
  treeDensity: number;
  object: TerrainObject;
}

export interface TerrainMap {
  width: number;
  height: number;
  seed: number;
  terrainIdx: number;
  terrainName: string;
  seaLevel: number;
  minElevation: number;
  maxElevation: number;
  waterCoverage: number;
  vegetationEnabled: boolean;
  hills: Hill[];
  cells: TerrainCell[][];
}

export interface TerrainPoint {
  x: number;
  y: number;
  elevation: number;
  biome: TerrainBiome;
}

export interface SavedTerrainArtifact {
  version: 1;
  source: "wibwobworld";
  exportedAt: string;
  renderMode: "terrain" | "contours" | "hybrid";
  levels: number;
  playerLabel: string;
  playerGlyph: string;
  playerSprite: string[];
  focus: TerrainPoint;
  map: TerrainMap;
}

export interface TerrainModelOptions {
  width: number;
  height: number;
  seed: number;
  terrainIdx: number;
  seaLevel: number;
  vegetationEnabled?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function cellNoise(seed: number, x: number, y: number): number {
  const value = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + seed * 0.0001) * 43758.5453;
  return value - Math.floor(value);
}

function coarseNoise(seed: number, x: number, y: number, scale: number): number {
  return cellNoise(seed * 17 + 31, Math.floor(x / scale), Math.floor(y / scale));
}

function slopeAt(grid: number[][], x: number, y: number): number {
  const center = grid[y]?.[x] ?? 0;
  let maxDelta = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const neighbor = grid[y + oy]?.[x + ox];
      if (typeof neighbor !== "number") continue;
      maxDelta = Math.max(maxDelta, Math.abs(center - neighbor));
    }
  }
  return clamp01(maxDelta * 4.5);
}

function moistureAt(grid: number[][], seaLevel: number, x: number, y: number): number {
  const radius = 6;
  let score = 0;
  let weightTotal = 0;

  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const elevation = grid[y + oy]?.[x + ox];
      if (typeof elevation !== "number") continue;
      const distance = Math.sqrt(ox * ox + oy * oy);
      if (distance > radius) continue;
      const weight = 1 / (1 + distance * 1.75);
      weightTotal += weight;
      if (elevation < seaLevel) {
        score += weight;
      }
    }
  }

  const localWater = weightTotal > 0 ? score / weightTotal : 0;
  const valleyBias = clamp01(1 - Math.abs((grid[y]?.[x] ?? 0) - (seaLevel + 0.1)) * 2.8);
  return clamp01(localWater * 0.75 + valleyBias * 0.25);
}

function classifyBiome(
  elevation: number,
  seaLevel: number,
  vegetationEnabled: boolean,
  treeDensity: number,
  slope: number,
): TerrainBiome {
  if (elevation < seaLevel - 0.14) return "deep-water";
  if (elevation < seaLevel) return "shallow-water";
  if (elevation < seaLevel + 0.04) return "shore";
  if (elevation >= 0.9) return "peak";
  if (elevation >= 0.76) return "ridge";
  if (elevation >= 0.6) return "hill";
  if (
    vegetationEnabled &&
    treeDensity >= 0.56 &&
    slope <= 0.38 &&
    elevation >= seaLevel + 0.03 &&
    elevation <= 0.82
  ) {
    return "forest";
  }
  return "plain";
}

function placeObject(
  biome: TerrainBiome,
  treeDensity: number,
  roll: number,
  waterDepth: number,
  elevation: number,
  seaLevel: number,
  slope: number,
): TerrainObject {
  // Water: sparse boats near shore
  if (biome === "shallow-water" && waterDepth < 0.06 && roll < 0.02) return "boat";
  if (biome === "deep-water" || biome === "shallow-water") return null;

  // Peak/ridge: rocks
  if (biome === "peak" && roll < 0.3) return "rock";
  if (biome === "ridge" && roll < 0.2) return "rock";

  // Hill: scattered rocks and bushes
  if (biome === "hill") {
    if (roll < 0.08) return "rock";
    if (roll < 0.15) return "bush";
    return null;
  }

  // Forest: dense trees
  if (biome === "forest") {
    if (roll < 0.35) return "tree";
    if (roll < 0.55) return "pine";
    if (roll < 0.60) return "bush";
    return null;
  }

  // Plain: mixed objects
  if (biome === "plain") {
    if (treeDensity > 0.3 && roll < 0.12) return "tree";
    if (treeDensity > 0.2 && roll < 0.18) return "bush";
    if (roll < 0.02 && slope < 0.15) return "house";
    if (roll > 0.95) return "flower";
    return null;
  }

  // Shore: sparse flowers
  if (biome === "shore" && roll < 0.05) return "flower";

  return null;
}

export function createTerrainMap(opts: TerrainModelOptions): TerrainMap {
  const width = Math.max(8, Math.floor(opts.width));
  const height = Math.max(6, Math.floor(opts.height));
  const seaLevel = clamp01(opts.seaLevel);
  const vegetationEnabled = opts.vegetationEnabled !== false;
  const terrainIdx = ((opts.terrainIdx % terrainNames.length) + terrainNames.length) % terrainNames.length;
  const hills = generateTerrainHills(width, height, opts.seed, terrainIdx);
  const grid = heightmap(width, height, hills);

  let minElevation = 1;
  let maxElevation = 0;
  let waterCells = 0;

  const cells = grid.map((row) =>
    row.map((elevation) => ({
      elevation,
      relativeElevation: elevation - seaLevel,
      waterDepth: 0,
      isWater: false,
      biome: "plain" as TerrainBiome,
      treeDensity: 0,
      object: null as TerrainObject,
    })),
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const elevation = grid[y]?.[x] ?? 0;
      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
      const waterDepth = elevation < seaLevel ? seaLevel - elevation : 0;
      if (waterDepth > 0) waterCells += 1;

      const slope = slopeAt(grid, x, y);
      const moisture = moistureAt(grid, seaLevel, x, y);
      const fine = cellNoise(opts.seed, x, y);
      const patch = coarseNoise(opts.seed, x, y, 4);
      const cluster = coarseNoise(opts.seed + 97, x, y, 7);
      const peakExposure = clamp01((elevation - 0.7) / 0.25);
      const waterPenalty = waterDepth > 0 ? 0.9 : 0;
      const treeDensity = clamp01(
        fine * 0.22 +
          patch * 0.33 +
          cluster * 0.18 +
          moisture * 0.37 -
          slope * 0.28 -
          peakExposure * 0.24 -
          waterPenalty,
      );

      const biome = classifyBiome(elevation, seaLevel, vegetationEnabled, treeDensity, slope);
      const objectRoll = cellNoise(opts.seed + 7919, x, y);
      const object = placeObject(biome, treeDensity, objectRoll, waterDepth, elevation, seaLevel, slope);

      cells[y]![x] = {
        elevation,
        relativeElevation: elevation - seaLevel,
        waterDepth,
        isWater: waterDepth > 0,
        biome,
        treeDensity,
        object,
      };
    }
  }

  return {
    width,
    height,
    seed: opts.seed,
    terrainIdx,
    terrainName: terrainNames[terrainIdx] ?? "unknown",
    seaLevel,
    minElevation,
    maxElevation,
    waterCoverage: waterCells / Math.max(1, width * height),
    vegetationEnabled,
    hills,
    cells,
  };
}

function highestCellInBounds(
  map: TerrainMap,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  requireLand: boolean,
): TerrainPoint | null {
  let best: TerrainPoint | null = null;
  for (let y = Math.max(0, bounds.y0); y < Math.min(map.height, bounds.y1); y += 1) {
    for (let x = Math.max(0, bounds.x0); x < Math.min(map.width, bounds.x1); x += 1) {
      const cell = map.cells[y]?.[x];
      if (!cell) continue;
      if (requireLand && cell.isWater) continue;
      if (!best || cell.elevation > best.elevation) {
        best = { x, y, elevation: cell.elevation, biome: cell.biome };
      }
    }
  }
  return best;
}

function highestCellOverall(map: TerrainMap, requireLand: boolean): TerrainPoint | null {
  return highestCellInBounds(
    map,
    { x0: 0, y0: 0, x1: map.width, y1: map.height },
    requireLand,
  );
}

export function getTerrainFocusPoint(map: TerrainMap): TerrainPoint {
  const dominantHill = map.hills.reduce<Hill | null>((best, hill) => {
    if (!best) return hill;
    const bestWeight = best[2] * best[3];
    const hillWeight = hill[2] * hill[3];
    return hillWeight > bestWeight ? hill : best;
  }, null);

  if (dominantHill) {
    const [cx, cy, radius] = dominantHill;
    const hillPeak =
      highestCellInBounds(
        map,
        {
          x0: Math.floor(cx - radius * 1.2),
          y0: Math.floor(cy - radius * 1.2),
          x1: Math.ceil(cx + radius * 1.2) + 1,
          y1: Math.ceil(cy + radius * 1.2) + 1,
        },
        true,
      ) ??
      highestCellInBounds(
        map,
        {
          x0: Math.floor(cx - radius * 1.2),
          y0: Math.floor(cy - radius * 1.2),
          x1: Math.ceil(cx + radius * 1.2) + 1,
          y1: Math.ceil(cy + radius * 1.2) + 1,
        },
        false,
      );
    if (hillPeak) return hillPeak;
  }

  return (
    highestCellOverall(map, true) ??
    highestCellOverall(map, false) ?? {
      x: Math.floor(map.width / 2),
      y: Math.floor(map.height / 2),
      elevation: 0,
      biome: "plain",
    }
  );
}

export function createSavedTerrainArtifact(args: {
  map: TerrainMap;
  focus: TerrainPoint;
  renderMode: "terrain" | "contours" | "hybrid";
  levels: number;
  playerLabel: string;
  playerGlyph: string;
  playerSprite: string[];
}): SavedTerrainArtifact {
  return {
    version: 1,
    source: "wibwobworld",
    exportedAt: new Date().toISOString(),
    renderMode: args.renderMode,
    levels: args.levels,
    playerLabel: args.playerLabel,
    playerGlyph: args.playerGlyph,
    playerSprite: args.playerSprite,
    focus: args.focus,
    map: args.map,
  };
}

export function isSavedTerrainArtifact(value: unknown): value is SavedTerrainArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<SavedTerrainArtifact>;
  return (
    artifact.version === 1 &&
    artifact.source === "wibwobworld" &&
    typeof artifact.exportedAt === "string" &&
    typeof artifact.renderMode === "string" &&
    typeof artifact.levels === "number" &&
    typeof artifact.playerLabel === "string" &&
    typeof artifact.playerGlyph === "string" &&
    Array.isArray(artifact.playerSprite) &&
    !!artifact.focus &&
    typeof artifact.focus.x === "number" &&
    typeof artifact.focus.y === "number" &&
    !!artifact.map &&
    typeof artifact.map.width === "number" &&
    typeof artifact.map.height === "number" &&
    Array.isArray(artifact.map.cells)
  );
}
