// ─── Glasgow city generation ────────────────────────────────
// Procedural tenement blocks, closes, back courts, streets.
import { hash2d, fractal } from "./types.js";

export const enum Tile {
  STREET = 0, PAVEMENT = 1, CLOSE = 2, BACK_COURT = 3,
  TENEMENT = 4, TENEMENT_HIGH = 5, WALL = 6, BIN = 7,
  CHIP_SHOP = 8, PUDDLE = 9, GRASS_PATCH = 10, ROOF = 11,
}

export interface CityCell {
  tile: Tile;
  height: number;    // 0 = ground, higher = buildings
  lit: boolean;      // near a streetlight?
}

export interface City {
  w: number; h: number;
  cells: CityCell[];
  seed: number;
  lights: { x: number; y: number }[];
}

export function genCity(w: number, h: number, seed: number): City {
  const cells: CityCell[] = new Array(w * h);
  const lights: { x: number; y: number }[] = [];

  // Base: everything is street
  for (let i = 0; i < w * h; i++) {
    cells[i] = { tile: Tile.STREET, height: 0, lit: false };
  }

  // Grid of tenement blocks with streets between
  const blockW = 12, blockH = 10;
  const streetW = 3;

  for (let by = 0; by < Math.floor(h / (blockH + streetW)); by++) {
    for (let bx = 0; bx < Math.floor(w / (blockW + streetW)); bx++) {
      const ox = bx * (blockW + streetW) + streetW;
      const oy = by * (blockH + streetW) + streetW;
      const bldgHeight = 3 + Math.floor(hash2d(bx * 13, by * 7, seed) * 4);
      const hasClose = hash2d(bx, by, seed + 50) > 0.3;
      const closeX = Math.floor(blockW / 2);
      const isChipShop = hash2d(bx * 3, by * 5, seed + 99) < 0.12;

      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const cx = ox + dx, cy = oy + dy;
          if (cx >= w || cy >= h) continue;

          // Close through the middle
          if (hasClose && dx === closeX && dy > 0 && dy < blockH - 1) {
            cells[cy * w + cx] = { tile: Tile.CLOSE, height: bldgHeight - 1, lit: false };
            continue;
          }

          // Perimeter = tenement walls
          const isPerimeter = dx === 0 || dx === blockW - 1 || dy === 0 || dy === blockH - 1;
          // Back court interior
          const isInterior = dx > 1 && dx < blockW - 2 && dy > 1 && dy < blockH - 2;

          if (isPerimeter) {
            const t = dy === 0 && isChipShop && dx > 1 && dx < 5
              ? Tile.CHIP_SHOP : Tile.TENEMENT;
            cells[cy * w + cx] = { tile: t, height: bldgHeight, lit: false };
          } else if (isInterior) {
            // Back court — grass, bins, washing lines
            const r = hash2d(cx * 11, cy * 17, seed + 200);
            const t = r < 0.08 ? Tile.BIN : r < 0.3 ? Tile.GRASS_PATCH : Tile.BACK_COURT;
            cells[cy * w + cx] = { tile: t, height: 0, lit: false };
          } else {
            cells[cy * w + cx] = { tile: Tile.TENEMENT, height: bldgHeight, lit: false };
          }
        }
      }

      // Rooftops — top row of high buildings
      if (bldgHeight >= 5) {
        for (let dx = 1; dx < blockW - 1; dx++) {
          const cx = ox + dx, cy = oy;
          if (cx < w && cy < h) {
            cells[cy * w + cx] = { tile: Tile.ROOF, height: bldgHeight + 1, lit: false };
          }
        }
      }
    }
  }

  // Pavements along streets
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = cells[y * w + x];
      if (c.tile !== Tile.STREET) continue;
      // Check if adjacent to a building
      let adjBuilding = false;
      for (let d = -1; d <= 1; d += 2) {
        if (x + d >= 0 && x + d < w && cells[y * w + x + d].tile >= Tile.TENEMENT &&
            cells[y * w + x + d].tile <= Tile.CHIP_SHOP) adjBuilding = true;
        if (y + d >= 0 && y + d < h && cells[(y + d) * w + x].tile >= Tile.TENEMENT &&
            cells[(y + d) * w + x].tile <= Tile.CHIP_SHOP) adjBuilding = true;
      }
      if (adjBuilding) c.tile = Tile.PAVEMENT;
    }
  }

  // Puddles on streets (it's Glasgow)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = cells[y * w + x];
      if (c.tile === Tile.STREET && hash2d(x * 3, y * 7, seed + 300) < 0.08) {
        c.tile = Tile.PUDDLE;
      }
    }
  }

  // Streetlights along pavements
  for (let y = 2; y < h - 2; y += 5) {
    for (let x = 2; x < w - 2; x += 7) {
      const c = cells[y * w + x];
      if (c.tile === Tile.PAVEMENT || c.tile === Tile.STREET) {
        lights.push({ x, y });
        // Mark nearby cells as lit
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              if (dx * dx + dy * dy <= 9) cells[ny * w + nx].lit = true;
            }
          }
        }
      }
    }
  }

  return { w, h, cells, seed, lights };
}

export function getCell(c: City, x: number, y: number): CityCell {
  if (x < 0 || x >= c.w || y < 0 || y >= c.h) {
    return { tile: Tile.STREET, height: 0, lit: false };
  }
  return c.cells[y * c.w + x];
}

export function isWalkable(tile: Tile): boolean {
  return tile === Tile.STREET || tile === Tile.PAVEMENT ||
    tile === Tile.CLOSE || tile === Tile.BACK_COURT ||
    tile === Tile.PUDDLE || tile === Tile.GRASS_PATCH ||
    tile === Tile.BIN || tile === Tile.ROOF;
}
