/**
 * ISO terrain renderer — extracted from wibwobworld-iso module.
 * Moved here when wibwobworld-iso was merged into wibwobworld (S05 migration).
 */
import type { SavedTerrainArtifact, TerrainBiome } from "../../src/services/terrain-model.js";
import { BIOME_COLORS, BIOME_GLYPHS } from "../../src/services/terrain-render.js";

// Vertical exaggeration — higher = more dramatic height difference between water and peaks
const ISO_EXAGGERATION = 8;

function biomeColor(biome: TerrainBiome): string {
  return BIOME_COLORS[biome] ?? "green";
}

function topGlyph(biome: TerrainBiome): string {
  return BIOME_GLYPHS[biome] ?? ".";
}

export function renderIso(artifact: SavedTerrainArtifact, width: number, height: number): string[] {
  const map = artifact.map;

  // Compute stride so the iso diamond fits within the viewport.
  // Without striding: iso span = (mapW+mapH)*2 chars wide, (mapW+mapH) rows tall.
  const rawSpanW = (map.width + map.height) * 2;
  const rawSpanH = map.width + map.height + ISO_EXAGGERATION + 2;
  const strideW = Math.max(1, Math.ceil(rawSpanW / (width * 0.99)));
  const strideH = Math.max(1, Math.ceil(rawSpanH / (height * 0.99)));
  const stride = Math.max(strideW, strideH);

  // After striding, recompute effective span and derive a uniform scale factor.
  const effectiveW = Math.ceil(map.width / stride);
  const effectiveH = Math.ceil(map.height / stride);
  const effectiveSpanW = (effectiveW + effectiveH) * 2;
  const effectiveSpanH = effectiveW + effectiveH + ISO_EXAGGERATION + 2;
  const scaleX = effectiveSpanW > 0 ? (width * 0.99) / effectiveSpanW : 1;
  const scaleY = effectiveSpanH > 0 ? (height * 0.99) / effectiveSpanH : 1;
  const scale = Math.min(scaleX, scaleY);

  const centerX = Math.floor(width / 2);
  const topPad = 2; // margin rows above the highest possible peak

  const canvas: string[][] = Array.from({ length: height }, () => Array<string>(width).fill(" "));

  // Collect sampled cells and sort by depth (x+y) ascending so farther tiles
  // are drawn first — painter's algorithm for correct occlusion.
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

    // Map world coords to sampled-grid coords, then to iso screen coords.
    const sx = wx / stride;
    const sy = wy / stride;
    const isoX = Math.round((sx - sy) * 2 * scale + centerX);
    const elevH = Math.max(0, Math.round(Math.max(0, cell.relativeElevation) * ISO_EXAGGERATION));
    const baseY = Math.round((sx + sy) * scale) + topPad + ISO_EXAGGERATION;
    const isoY = baseY - elevH;

    const color = biomeColor(cell.biome);
    const glyph = topGlyph(cell.biome);

    // Top surface — overwrites whatever is there (closer tiles rendered later will
    // overwrite farther tiles' top glyphs, giving correct depth order).
    if (isoY >= 0 && isoY < height && isoX >= 0 && isoX < width) {
      canvas[isoY]![isoX] = `{${color}-fg}${glyph}{/${color}-fg}`;
    }

    // Vertical column below elevated land — only paint on blank cells so that
    // later closer tiles can overwrite column segments with their own surfaces.
    if (!cell.isWater && elevH > 0) {
      for (let cy = isoY + 1; cy <= baseY && cy < height; cy++) {
        if (cy >= 0 && isoX >= 0 && isoX < width && canvas[cy]![isoX] === " ") {
          canvas[cy]![isoX] = `{light-black-fg}|{/light-black-fg}`;
        }
      }
    }
  }

  // Player / focus marker — always on top of everything.
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
    if (focusIsoY >= 0 && focusIsoY < height && focusIsoX >= 0 && focusIsoX < width) {
      canvas[focusIsoY]![focusIsoX] = "{magenta-fg}@{/magenta-fg}";
    }
  }

  return canvas.map((row) => row.join("").replace(/\s+$/u, ""));
}
