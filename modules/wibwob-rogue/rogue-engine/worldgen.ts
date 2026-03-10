/**
 * World generation — ported from overworld.js
 * Generates castle, forest, and mountain biomes with entities.
 * No DOM or browser dependency.
 */

import { RNG } from "rot-js";
import type { Tile, Entity, Sprite, Bounds } from "./types.js";
import {
  HEIGHT, WIDTH, CASTLE_WIDTH, FOREST_WIDTH, MOUNTAIN_WIDTH,
  MIN_PASSAGE_WIDTH, MAIN_PATH_Y, REGION_BOUNDS,
} from "./constants.js";
import {
  createSprite, spriteWorldCells,
  SCRAMBLE_SPRITE, TITAN_SPRITE, CASTLE_SPRITE, WOBBLER_SPRITE,
  SCREAMER_SPRITE, MECH_SPRITE, SKINNY_MECH_SPRITE, TREE_SPRITE,
  GLUMFACE_SPRITES, PLAYER_SPRITE_RIGHT,
} from "./sprites.js";

// ─── helpers ──────────────────────────────────────────────

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function setTile(tiles: Map<string, Tile>, x: number, y: number, overrides: Partial<Tile>) {
  const key = tileKey(x, y);
  const prev = tiles.get(key);
  tiles.set(key, {
    x, y,
    glyph: prev?.glyph ?? "#",
    fg: prev?.fg,
    bg: prev?.bg,
    walkable: prev?.walkable ?? false,
    transparent: prev?.transparent ?? false,
    region: prev?.region ?? "castle",
    label: prev?.label ?? "",
    ...overrides,
  } as Tile);
}

function pickRandom<T>(list: T[]): T | null {
  if (!list.length) return null;
  return list[RNG.getUniformInt(0, list.length - 1)];
}

function canSpriteSitOnMap(
  tiles: Map<string, Tile>, anchorX: number, anchorY: number,
  sprite: Sprite, bounds?: Bounds, allowedRegions?: Set<string>,
): boolean {
  const cells = spriteWorldCells(sprite, anchorX, anchorY);
  for (const cell of cells) {
    if (bounds) {
      if (bounds.minX != null && cell.x < bounds.minX) return false;
      if (bounds.maxX != null && cell.x > bounds.maxX) return false;
      if (bounds.minY != null && cell.y < bounds.minY) return false;
      if (bounds.maxY != null && cell.y > bounds.maxY) return false;
    }
    const tile = tiles.get(tileKey(cell.x, cell.y));
    if (!tile || !tile.walkable) return false;
    if (allowedRegions && !allowedRegions.has(tile.region)) return false;
  }
  return true;
}

function createEntity(id: string, x: number, y: number, sprite: Sprite, color: string, extra: Record<string, any> = {}): Entity {
  return { id, x, y, sprite, color, visible: false, ...extra };
}

// ─── painting helpers ────────────────────────────────────

function paintWideFloor(
  tiles: Map<string, Tile>, bounds: Bounds, centerX: number, y: number,
  overrides: Partial<Tile>, width = MIN_PASSAGE_WIDTH,
) {
  if (y <= 0 || y >= HEIGHT - 1) return;
  let start = centerX - Math.floor((width - 1) / 2);
  let end = start + width - 1;
  if (start < bounds.minX) { end += bounds.minX - start; start = bounds.minX; }
  if (end > bounds.maxX) { start -= end - bounds.maxX; end = bounds.maxX; }
  start = Math.max(start, bounds.minX);
  end = Math.min(end, bounds.maxX);
  for (let x = start; x <= end; x++) {
    setTile(tiles, x, y, { glyph: ".", walkable: true, transparent: true, ...overrides });
  }
}

function carveWideConnector(
  tiles: Map<string, Tile>, startX: number, endX: number, y: number,
  options: { region: string; label: string; glyph?: string; extraRows?: number[]; width?: number },
) {
  const { region, label, glyph = "·", extraRows = [], width = MIN_PASSAGE_WIDTH } = options;
  const min = Math.min(startX, endX);
  const max = Math.max(startX, endX);
  const rows = [y, ...extraRows];
  const fullBounds: Bounds = { minX: 0, maxX: WIDTH - 1 };
  for (let x = min; x <= max; x++) {
    for (const row of rows) {
      paintWideFloor(tiles, fullBounds, x, row, { glyph, region, label }, width);
    }
  }
}

function carveClearing(
  tiles: Map<string, Tile>, bounds: Bounds, centerX: number, centerY: number,
  radiusX: number, radiusY: number,
  opts: { label: string; glyph: string; region?: string },
) {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
    if (y <= 1 || y >= HEIGHT - 1) continue;
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      if (x < bounds.minX || x > bounds.maxX) continue;
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        setTile(tiles, x, y, {
          glyph: opts.glyph, walkable: true, transparent: true,
          region: opts.region ?? tiles.get(tileKey(x, y))?.region ?? "forest",
          label: opts.label,
        });
      }
    }
  }
}

function carvePond(
  tiles: Map<string, Tile>, bounds: Bounds,
  centerX: number, centerY: number, radiusX: number, radiusY: number,
) {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
    if (y <= 1 || y >= HEIGHT - 1) continue;
    if (y <= MAIN_PATH_Y) continue;
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      if (x < bounds.minX || x > bounds.maxX) continue;
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        setTile(tiles, x, y, {
          glyph: "≈", walkable: false, transparent: false,
          region: "forest", label: "Reflecting Pool",
        });
      }
    }
  }
}

function scatterRidges(tiles: Map<string, Tile>, bounds: Bounds, options: { avoid?: { minX: number; maxX: number; minY: number; maxY: number } } = {}) {
  const PATH_CLEARANCE = Math.floor(MIN_PASSAGE_WIDTH / 2) + 4;
  const placements = RNG.getUniformInt(10, 16);
  const placedRidges: { x: number; y: number }[] = [];
  for (let i = 0; i < placements; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const x = RNG.getUniformInt(bounds.minX + 12, bounds.maxX - 12);
      const y = RNG.getUniformInt(2, HEIGHT - 3);
      if (Math.abs(y - MAIN_PATH_Y) < PATH_CLEARANCE) { attempts++; continue; }
      if (options.avoid) {
        const a = options.avoid;
        if (x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY) { attempts++; continue; }
      }
      if (placedRidges.some(r => Math.abs(r.x - x) < 6 && Math.abs(r.y - y) < 6)) { attempts++; continue; }
      const key = tileKey(x, y);
      if (!tiles.get(key)) { attempts++; continue; }
      placedRidges.push({ x, y });
      setTile(tiles, x, y, { glyph: "⛰", walkable: false, transparent: false, region: "mountain", label: "Jagged Ridge" });
      break;
    }
  }
}

// ─── biome generators ────────────────────────────────────

function generateCastle() {
  const tiles = new Map<string, Tile>();
  const bounds = REGION_BOUNDS.castle;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const onBorder = y === 0 || y === HEIGHT - 1 || x === bounds.minX || x === bounds.maxX;
      setTile(tiles, x, y, {
        glyph: onBorder ? "█" : "#", walkable: false, transparent: false,
        region: "castle", label: onBorder ? "Curtain Wall" : "Stone Wall",
      });
    }
  }
  // Carve rooms
  for (let y = 2; y <= MAIN_PATH_Y - 4; y++) {
    for (let x = bounds.minX + 2; x <= bounds.maxX - 2; x++) {
      setTile(tiles, x, y, { glyph: ".", walkable: true, transparent: true, region: "castle", label: "Observatory Wing" });
    }
  }
  for (let y = MAIN_PATH_Y + 2; y <= HEIGHT - 3; y++) {
    for (let x = bounds.minX + 2; x <= bounds.maxX - 2; x++) {
      setTile(tiles, x, y, { glyph: ".", walkable: true, transparent: true, region: "castle", label: "Great Hall" });
    }
  }
  // Grand corridor
  const corridorYs = [MAIN_PATH_Y - 1, MAIN_PATH_Y, MAIN_PATH_Y + 1];
  for (let x = bounds.minX + 2; x <= bounds.maxX - 1; x++) {
    for (const y of corridorYs) {
      paintWideFloor(tiles, bounds, x, y, { glyph: "·", region: "castle", label: "Grand Corridor" }, MIN_PASSAGE_WIDTH + 2);
    }
  }
  // Gatehouse exit
  const doorX = bounds.maxX;
  for (const y of corridorYs) {
    paintWideFloor(tiles, bounds, doorX, y, { glyph: "≡", region: "castle", label: "Gatehouse" }, MIN_PASSAGE_WIDTH + 2);
  }
  const spawn = { x: bounds.minX + Math.floor(MIN_PASSAGE_WIDTH * 1.5), y: MAIN_PATH_Y };
  return { tiles, spawn, doorPosition: { x: doorX, y: MAIN_PATH_Y } };
}

function generateForest() {
  const tiles = new Map<string, Tile>();
  const bounds = REGION_BOUNDS.forest;
  const scrambleRegions = new Set(["forest", "causeway", "ridge"]);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const border = y === 0 || y === HEIGHT - 1 || x === bounds.minX || x === bounds.maxX;
      setTile(tiles, x, y, {
        glyph: border ? "♣" : "·", walkable: !border, transparent: !border,
        region: "forest", label: border ? "Thick Hedge" : "Forest Floor",
      });
    }
  }
  // Main trail
  const trailYs = [MAIN_PATH_Y - 1, MAIN_PATH_Y, MAIN_PATH_Y + 1];
  for (let x = bounds.minX + 1; x <= bounds.maxX - 1; x++) {
    for (const y of trailYs) {
      paintWideFloor(tiles, bounds, x, y, { glyph: "·", region: "forest", label: "Deep Woods" }, MIN_PASSAGE_WIDTH + 2);
    }
  }
  // Clearings
  carveClearing(tiles, bounds, bounds.minX + Math.floor(FOREST_WIDTH / 4), MAIN_PATH_Y - 8, 8, 5, { label: "Moonlit Grove", glyph: "·", region: "forest" });
  const mechCenterX = bounds.minX + Math.floor((FOREST_WIDTH * 3) / 5);
  const mechCenterY = MAIN_PATH_Y + 7;
  carveClearing(tiles, bounds, mechCenterX, mechCenterY, 9, 5, { label: "Whispering Willows", glyph: "·", region: "forest" });
  carvePond(tiles, bounds, bounds.minX + Math.floor(FOREST_WIDTH / 4), MAIN_PATH_Y + 9, 6, 3);
  // Tree clusters
  const PATH_CLEARANCE = Math.floor(MIN_PASSAGE_WIDTH / 2) + 4;
  const clusters = RNG.getUniformInt(4, 8);
  const placedClusters: { x: number; y: number }[] = [];
  for (let i = 0; i < clusters; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const cx = RNG.getUniformInt(bounds.minX + 12, bounds.maxX - 12);
      const cy = RNG.getUniformInt(3, HEIGHT - 4);
      if (Math.abs(cy - MAIN_PATH_Y) < PATH_CLEARANCE) { attempts++; continue; }
      if (placedClusters.some(c => Math.abs(c.x - cx) < 8 && Math.abs(c.y - cy) < 8)) { attempts++; continue; }
      placedClusters.push({ x: cx, y: cy });
      const radius = RNG.getUniformInt(1, 2);
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (x < bounds.minX + 1 || x > bounds.maxX - 1 || y < 1 || y > HEIGHT - 2) continue;
          if (Math.abs(x - cx) + Math.abs(y - cy) > radius) continue;
          setTile(tiles, x, y, { glyph: "♣", walkable: false, transparent: false, region: "forest", label: "Ancient Pine" });
        }
      }
      break;
    }
  }
  // Find scramble spawn
  const spawnCandidates: { x: number; y: number }[] = [];
  for (let x = bounds.minX + MIN_PASSAGE_WIDTH; x <= bounds.maxX - MIN_PASSAGE_WIDTH; x++) {
    if (canSpriteSitOnMap(tiles, x, MAIN_PATH_Y, SCRAMBLE_SPRITE, bounds, scrambleRegions)) {
      spawnCandidates.push({ x, y: MAIN_PATH_Y });
    }
  }
  const forestCenterX = bounds.minX + Math.floor(FOREST_WIDTH / 2);
  const centerBiased = spawnCandidates.filter(c => Math.abs(c.x - forestCenterX) <= Math.floor(FOREST_WIDTH / 3));
  const scrambleSpawn = pickRandom(centerBiased.length ? centerBiased : spawnCandidates) || { x: forestCenterX, y: MAIN_PATH_Y };
  const mechAnchor = { x: mechCenterX, y: mechCenterY };
  return { tiles, scrambleSpawn, mechAnchor };
}

function generateMountains() {
  const tiles = new Map<string, Tile>();
  const bounds = REGION_BOUNDS.mountain;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const border = y === 0 || y === HEIGHT - 1 || x === bounds.minX || x === bounds.maxX;
      setTile(tiles, x, y, {
        glyph: border ? "▲" : "·", walkable: !border, transparent: !border,
        region: "mountain", label: border ? "Sheer Cliff" : "Wind-scoured Stone",
      });
    }
  }
  // Mountain pass
  const ridgeYs = [MAIN_PATH_Y - 1, MAIN_PATH_Y, MAIN_PATH_Y + 1, MAIN_PATH_Y + 2];
  for (let x = bounds.minX + 1; x <= bounds.maxX - 1; x++) {
    for (const y of ridgeYs) {
      paintWideFloor(tiles, bounds, x, y, { glyph: "·", region: "mountain", label: "Mountain Pass Trading Route" }, MIN_PASSAGE_WIDTH + 4);
    }
  }
  const plateauX = bounds.minX + Math.floor((MOUNTAIN_WIDTH * 2) / 3);
  carveClearing(tiles, bounds, plateauX, MAIN_PATH_Y + 2, 10, 5, { label: "Mountain Pass Trading Route", glyph: ".", region: "mountain" });
  carveClearing(tiles, bounds, bounds.minX + Math.floor(MOUNTAIN_WIDTH / 4), MAIN_PATH_Y - 6, 7, 4, { label: "Crystal Mines", glyph: ".", region: "mountain" });
  carveClearing(tiles, bounds, bounds.maxX - Math.floor(MOUNTAIN_WIDTH / 6), MAIN_PATH_Y + 7, 7, 4, { label: "Griffin Aeries", glyph: ".", region: "mountain" });
  scatterRidges(tiles, bounds, {
    avoid: { minX: plateauX - 8, maxX: plateauX + 8, minY: MAIN_PATH_Y - 4, maxY: MAIN_PATH_Y + 6 },
  });
  const titanSpawn = { x: plateauX, y: MAIN_PATH_Y + 2 };
  const titanBounds = { minX: plateauX - 6, maxX: plateauX + 6, minY: MAIN_PATH_Y - 2, maxY: MAIN_PATH_Y + 6 };
  return { tiles, titanSpawn, titanBounds };
}

// ─── full world ──────────────────────────────────────────

export function generateWorld(seed: number) {
  RNG.setSeed(seed);

  const castle = generateCastle();
  const forest = generateForest();
  const mountains = generateMountains();

  const tiles = new Map<string, Tile>();
  for (const section of [castle.tiles, forest.tiles, mountains.tiles]) {
    section.forEach((value, key) => tiles.set(key, value));
  }

  // Connectors
  carveWideConnector(tiles, castle.doorPosition.x, REGION_BOUNDS.forest.minX + Math.floor(FOREST_WIDTH / 3), MAIN_PATH_Y, {
    region: "causeway", label: "Main Drawbridge", glyph: "≡",
    extraRows: [MAIN_PATH_Y - 1, MAIN_PATH_Y + 1], width: MIN_PASSAGE_WIDTH + 4,
  });
  carveWideConnector(tiles, REGION_BOUNDS.forest.maxX - Math.floor(FOREST_WIDTH / 3), REGION_BOUNDS.mountain.minX + Math.floor(MOUNTAIN_WIDTH / 3), MAIN_PATH_Y, {
    region: "ridge", label: "Mountain Pass Trading Route", glyph: "≈",
    extraRows: [MAIN_PATH_Y - 1, MAIN_PATH_Y + 1], width: MIN_PASSAGE_WIDTH + 2,
  });

  // Entities
  const monsters: Entity[] = [];
  const structures: Entity[] = [];
  const scrambleRegions = new Set(["forest", "causeway", "ridge"]);

  // Scramble
  if (forest.scrambleSpawn) {
    monsters.push(createEntity("scramble", forest.scrambleSpawn.x, forest.scrambleSpawn.y, SCRAMBLE_SPRITE, "#f5f5f5", {
      behavior: "wander", allowedRegions: scrambleRegions, stayChance: 0.28, mood: "prowling", emotionalState: "asleep",
    }));
  }

  // Mech warden
  if (forest.mechAnchor) {
    monsters.push(createEntity("mech-warden", forest.mechAnchor.x, forest.mechAnchor.y, MECH_SPRITE, "#f5f5f5", {
      behavior: "mech-warden", allowedRegions: new Set(["forest"]),
      patrolBounds: { minX: forest.mechAnchor.x - 4, maxX: forest.mechAnchor.x + 4, minY: forest.mechAnchor.y - 2, maxY: forest.mechAnchor.y + 3 },
    }));
  }

  // Titan + companions
  if (mountains.titanSpawn) {
    monsters.push(createEntity("titan", mountains.titanSpawn.x, mountains.titanSpawn.y, TITAN_SPRITE, "#f5f5f5", {
      behavior: "sentinel", allowedRegions: new Set(["ridge", "mountain"]), patrolBounds: mountains.titanBounds,
    }));
    [-6, 6].forEach((dx, i) => {
      monsters.push(createEntity(`titan-companion-${i + 1}`, mountains.titanSpawn.x + dx, mountains.titanSpawn.y, TITAN_SPRITE, "#f5f5f5", {
        behavior: "wander", allowedRegions: new Set(["mountain"]), stayChance: 0.48,
      }));
    });
  }

  // Castle facade
  const castleAnchorX = Math.floor((REGION_BOUNDS.castle.minX + REGION_BOUNDS.castle.maxX) / 2);
  const castleAnchorY = MAIN_PATH_Y - 2;
  structures.push(createEntity("castle-facade", castleAnchorX, castleAnchorY, CASTLE_SPRITE, "#f5f5f5", { static: true, solid: true }));
  // Castle gate portal tile — squeezed player walks north onto this to enter interior
  setTile(tiles, castleAnchorX, MAIN_PATH_Y - 1, {
    glyph: '☖',
    walkable: true,
    transparent: true,
    region: 'castle',
    label: 'Tower Gate',
    portal: 'castleGate' as any,
  });

  // Wobblers in castle
  const wobblerPositions: { x: number; y: number }[] = [];
  const yMin = Math.min(HEIGHT - 10, MAIN_PATH_Y + 12);
  const yMax = Math.min(HEIGHT - 4, yMin + 8);
  for (let i = 0; i < 5; i++) {
    let attempts = 0;
    while (attempts < 60) {
      const offset = RNG.getUniformInt(-MIN_PASSAGE_WIDTH - 8, MIN_PASSAGE_WIDTH + 8);
      if (Math.abs(offset) < Math.floor(MIN_PASSAGE_WIDTH / 2) + 4) { attempts++; continue; }
      const y = RNG.getUniformInt(yMin, yMax);
      const x = Math.min(REGION_BOUNDS.castle.maxX - 3, Math.max(REGION_BOUNDS.castle.minX + 3, castleAnchorX + offset));
      if (wobblerPositions.some(p => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 3)) { attempts++; continue; }
      wobblerPositions.push({ x, y });
      break;
    }
  }
  wobblerPositions.sort((a, b) => a.y - b.y).forEach((pos, i) => {
    monsters.push(createEntity(`wibwobbler-${i + 1}`, pos.x, pos.y, WOBBLER_SPRITE, "#f5f5f5", {
      behavior: "wobbler", allowedRegions: new Set(["castle"]), stayChance: 0.35,
      patrolBounds: { minX: pos.x - 8, maxX: pos.x + 8, minY: pos.y - 5, maxY: pos.y + 5 },
    }));
  });

  // Screamers across all regions
  const screamerPositions: { x: number; y: number }[] = [];
  for (const [regionName, count] of [["castle", 7], ["forest", 12], ["mountain", 9]] as const) {
    const rb = REGION_BOUNDS[regionName];
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      while (attempts < 40) {
        const x = RNG.getUniformInt(rb.minX + 4, rb.maxX - 4);
        const y = RNG.getUniformInt(3, HEIGHT - 4);
        if (Math.abs(y - MAIN_PATH_Y) < 3) { attempts++; continue; }
        if (screamerPositions.some(p => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5)) { attempts++; continue; }
        const tile = tiles.get(tileKey(x, y));
        if (!tile || !tile.walkable) { attempts++; continue; }
        screamerPositions.push({ x, y });
        const allowedRegions = regionName === "castle"
          ? new Set(["castle", "causeway"])
          : regionName === "forest"
            ? new Set(["forest", "causeway"])
            : new Set(["mountain", "ridge"]);
        monsters.push(createEntity(`screamer-${regionName}-${i + 1}`, x, y, SCREAMER_SPRITE, "#f5f5f5", {
          behavior: "screamer", allowedRegions, material: "furry",
        }));
        break;
      }
    }
  }

  // Skinny mech in mountains
  const mechX = REGION_BOUNDS.mountain.maxX - Math.floor(MIN_PASSAGE_WIDTH / 2) - 4;
  const mechY = Math.max(8, MAIN_PATH_Y - 6);
  monsters.push(createEntity("skinny-mech", mechX, mechY, SKINNY_MECH_SPRITE, "#f5f5f5", {
    behavior: "skinny-mech", allowedRegions: new Set(["mountain"]),
    patrolBounds: { minX: mechX - 4, maxX: mechX + 4, minY: mechY - 2, maxY: mechY + 4 },
  }));

  // Trees
  const treePositions = [
    { x: REGION_BOUNDS.mountain.minX + 8, y: HEIGHT - 8, bounds: REGION_BOUNDS.mountain },
    { x: REGION_BOUNDS.mountain.minX + 18, y: HEIGHT - 10, bounds: REGION_BOUNDS.mountain },
    { x: REGION_BOUNDS.forest.minX + Math.floor(FOREST_WIDTH / 2) - 8, y: 12, bounds: REGION_BOUNDS.forest },
    { x: REGION_BOUNDS.forest.minX + Math.floor(FOREST_WIDTH / 2) + 8, y: 12, bounds: REGION_BOUNDS.forest },
    { x: REGION_BOUNDS.forest.minX + 8, y: 6, bounds: REGION_BOUNDS.forest },
    { x: REGION_BOUNDS.forest.minX + 14, y: 8, bounds: REGION_BOUNDS.forest },
    { x: REGION_BOUNDS.forest.minX + 8, y: HEIGHT - 8, bounds: REGION_BOUNDS.forest },
    { x: REGION_BOUNDS.forest.minX + 14, y: HEIGHT - 10, bounds: REGION_BOUNDS.forest },
  ];
  treePositions.forEach((pos, i) => {
    if (canSpriteSitOnMap(tiles, pos.x, pos.y, TREE_SPRITE, pos.bounds)) {
      structures.push(createEntity(`tree-${i + 1}`, pos.x, pos.y, TREE_SPRITE, "#ffffff", { static: true, solid: true }));
    }
  });

  return {
    tiles,
    playerStart: { x: castleAnchorX, y: MAIN_PATH_Y + 3 },
    monsters,
    structures,
  };
}
