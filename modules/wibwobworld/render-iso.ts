/**
 * ISO terrain renderer — SimCity 2000-inspired isometric view.
 * Renders terrain with objects (trees, houses, rocks, etc).
 */
import {
  BIOME_COLORS,
  BIOME_GLYPHS,
  type SavedTerrainArtifact,
  type TerrainBiome,
  type TerrainObject,
} from "../../src/services/microapp-sdk.js";

// Vertical exaggeration — higher = more dramatic height difference
const ISO_EXAGGERATION = 10;

// Biome top-surface colours — lusher, more varied than defaults
const ISO_BIOME_COLORS: Record<TerrainBiome, string> = {
  "deep-water": "blue",
  "shallow-water": "cyan",
  "shore": "yellow",
  "plain": "green",
  "forest": "light-green",
  "hill": "light-black",
  "ridge": "white",
  "peak": "light-white",
};

// Surface glyphs — more variety for iso view
const ISO_SURFACE: Record<TerrainBiome, string[]> = {
  "deep-water": ["≈", "~"],
  "shallow-water": ["~", "∽"],
  "shore": ["·", "."],
  "plain": [",", ".", "'"],
  "forest": ["♣", "♠", "t"],
  "hill": ["∧", "n"],
  "ridge": ["^", "△"],
  "peak": ["▲", "△"],
};

// Object rendering for iso view
const ISO_OBJ_GLYPH: Record<string, string[]> = {
  tree:   ["♣", "│"],  // canopy, trunk
  pine:   ["▲", "│"],
  house:  ["▲", "█"],  // roof, wall
  rock:   ["●"],
  flower: ["✿"],
  boat:   ["⛵"],
  bush:   ["♠"],
};
const ISO_OBJ_COLOR: Record<string, string[]> = {
  tree:   ["green", "light-black"],
  pine:   ["light-green", "light-black"],
  house:  ["red", "yellow"],
  rock:   ["white"],
  flower: ["magenta"],
  boat:   ["light-white"],
  bush:   ["light-green"],
};

function hashCell(x: number, y: number): number {
  return ((x * 31 + y * 7) & 0x7fffffff);
}

export function renderIso(artifact: SavedTerrainArtifact, width: number, height: number): string[] {
  const map = artifact.map;

  // Compute stride so the iso diamond fits within the viewport.
  const rawSpanW = (map.width + map.height) * 2;
  const rawSpanH = map.width + map.height + ISO_EXAGGERATION + 2;
  const strideW = Math.max(1, Math.ceil(rawSpanW / (width * 0.99)));
  const strideH = Math.max(1, Math.ceil(rawSpanH / (height * 0.99)));
  const stride = Math.max(strideW, strideH);

  const effectiveW = Math.ceil(map.width / stride);
  const effectiveH = Math.ceil(map.height / stride);
  const effectiveSpanW = (effectiveW + effectiveH) * 2;
  const effectiveSpanH = effectiveW + effectiveH + ISO_EXAGGERATION + 2;
  const scaleX = effectiveSpanW > 0 ? (width * 0.99) / effectiveSpanW : 1;
  const scaleY = effectiveSpanH > 0 ? (height * 0.99) / effectiveSpanH : 1;
  const scale = Math.min(scaleX, scaleY);

  const centerX = Math.floor(width / 2);
  const topPad = 2;

  const canvas: string[][] = Array.from({ length: height }, () => Array<string>(width).fill(" "));

  // Collect sampled cells — painter's algorithm (far first)
  type SampledCell = { wx: number; wy: number; depth: number };
  const sampled: SampledCell[] = [];
  for (let wy = 0; wy < map.height; wy += stride) {
    for (let wx = 0; wx < map.width; wx += stride) {
      sampled.push({ wx, wy, depth: wx + wy });
    }
  }
  sampled.sort((a, b) => a.depth - b.depth);

  for (const { wx, wy } of sampled) {
    const cell = map.cells[wy]?.[wx];
    if (!cell) continue;

    const sx = wx / stride;
    const sy = wy / stride;
    const isoX = Math.round((sx - sy) * 2 * scale + centerX);
    const elevH = Math.max(0, Math.round(Math.max(0, cell.relativeElevation) * ISO_EXAGGERATION));
    const baseY = Math.round((sx + sy) * scale) + topPad + ISO_EXAGGERATION;
    const isoY = baseY - elevH;

    const h = hashCell(wx, wy);
    const surfaceArr = ISO_SURFACE[cell.biome];
    const glyph = surfaceArr[h % surfaceArr.length];
    const color = ISO_BIOME_COLORS[cell.biome];

    // Top surface
    if (isoY >= 0 && isoY < height && isoX >= 0 && isoX < width) {
      canvas[isoY]![isoX] = `{${color}-fg}${glyph}{/${color}-fg}`;
    }

    // Vertical column below elevated land with shading
    if (!cell.isWater && elevH > 0) {
      for (let cy = isoY + 1; cy <= baseY && cy < height; cy++) {
        if (cy >= 0 && isoX >= 0 && isoX < width && canvas[cy]![isoX] === " ") {
          // South-face shading: darker at bottom
          const colFrac = (cy - isoY) / Math.max(1, elevH);
          if (colFrac < 0.4) {
            canvas[cy]![isoX] = `{${color}-fg}│{/${color}-fg}`;
          } else {
            canvas[cy]![isoX] = `{light-black-fg}│{/light-black-fg}`;
          }
        }
      }
    }

    // Render terrain objects above the surface
    if (cell.object && isoY >= 0 && isoX >= 0 && isoX < width) {
      const objGlyphs = ISO_OBJ_GLYPH[cell.object];
      const objColors = ISO_OBJ_COLOR[cell.object];
      if (objGlyphs && objColors) {
        for (let oi = 0; oi < objGlyphs.length; oi++) {
          const oy = isoY - objGlyphs.length + oi;
          if (oy >= 0 && oy < height) {
            const oColor = objColors[Math.min(oi, objColors.length - 1)];
            canvas[oy]![isoX] = `{${oColor}-fg}${objGlyphs[oi]}{/${oColor}-fg}`;
          }
        }
      }
    }
  }

  // Player / focus marker
  const fw = Math.floor(artifact.focus.x / stride) * stride;
  const fwy = Math.floor(artifact.focus.y / stride) * stride;
  const focusCell = map.cells[fwy]?.[fw];
  if (focusCell) {
    const fsx = fw / stride;
    const fsy = fwy / stride;
    const focusElevH = Math.max(0, Math.round(Math.max(0, focusCell.relativeElevation) * ISO_EXAGGERATION));
    const focusBaseY = Math.round((fsx + fsy) * scale) + topPad + ISO_EXAGGERATION;
    const focusIsoX = Math.round((fsx - fsy) * 2 * scale + centerX);
    const focusIsoY = focusBaseY - focusElevH;
    // Player sprite: 2 cells tall
    if (focusIsoY >= 0 && focusIsoY < height && focusIsoX >= 0 && focusIsoX < width) {
      canvas[focusIsoY]![focusIsoX] = "{magenta-fg}◕{/magenta-fg}";
      if (focusIsoY - 1 >= 0) {
        canvas[focusIsoY - 1]![focusIsoX] = "{magenta-fg}▼{/magenta-fg}";
      }
    }
  }

  return canvas.map((row) => row.join("").replace(/\s+$/u, ""));
}
