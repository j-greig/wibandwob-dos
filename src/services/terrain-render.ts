import { renderContourFromHills } from "./contour-engine.js";
import type { TerrainBiome, TerrainMap } from "./terrain-model.js";

export type TerrainRenderMode = "terrain" | "contours" | "hybrid";

export interface TerrainRenderOptions {
  mode: TerrainRenderMode;
  levels: number;
  tags?: boolean;
  camera?: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  player?: {
    x: number;
    y: number;
    glyph?: string;
    color?: string;
    sprite?: string[];
  };
  markers?: {
    x: number;
    y: number;
    glyph: string;
    color?: string;
  }[];
}

const BIOME_GLYPHS: Record<TerrainBiome, string> = {
  "deep-water": "~",
  "shallow-water": "~",
  "shore": ".",
  "plain": ",",
  "forest": "t",
  "hill": "n",
  "ridge": "^",
  "peak": "A",
};

const BIOME_COLORS: Record<TerrainBiome, string> = {
  "deep-water": "blue",
  "shallow-water": "cyan",
  "shore": "yellow",
  "plain": "green",
  "forest": "light-green",
  "hill": "light-black",
  "ridge": "white",
  "peak": "light-white",
};

function colorize(text: string, color: string, tags: boolean): string {
  return tags ? `{${color}-fg}${text}{/${color}-fg}` : text;
}

function renderBaseCell(map: TerrainMap, x: number, y: number, tags: boolean): string {
  const cell = map.cells[y]?.[x];
  if (!cell) return " ";
  return colorize(BIOME_GLYPHS[cell.biome], BIOME_COLORS[cell.biome], tags);
}

function renderContourCell(char: string, map: TerrainMap, x: number, y: number, tags: boolean): string {
  if (char === " ") {
    return " ";
  }
  const biome = map.cells[y]?.[x]?.biome ?? "plain";
  const contourColor =
    biome === "deep-water" || biome === "shallow-water"
      ? "light-cyan"
      : biome === "shore"
        ? "yellow"
        : "light-white";
  return colorize(char, contourColor, tags);
}

export function renderTerrainMap(map: TerrainMap, opts: TerrainRenderOptions): string[] {
  const fullWidth = Math.max(1, map.width - 1);
  const fullHeight = Math.max(1, map.height - 1);
  const contourRows = renderContourFromHills(map.width, map.height, {
    mode: "chaos",
    seed: map.seed,
    terrainIdx: map.terrainIdx,
    nLevels: Math.max(1, opts.levels),
    hills: map.hills,
  });

  const viewWidth = Math.max(1, opts.camera?.width ?? fullWidth);
  const viewHeight = Math.max(1, opts.camera?.height ?? fullHeight);
  const startX = Math.max(
    0,
    Math.min(
      fullWidth - viewWidth,
      Math.floor((opts.camera?.centerX ?? Math.floor(fullWidth / 2)) - viewWidth / 2),
    ),
  );
  const startY = Math.max(
    0,
    Math.min(
      fullHeight - viewHeight,
      Math.floor((opts.camera?.centerY ?? Math.floor(fullHeight / 2)) - viewHeight / 2),
    ),
  );

  const canvas: string[][] = [];
  for (let y = 0; y < viewHeight; y += 1) {
    const line: string[] = [];
    for (let x = 0; x < viewWidth; x += 1) {
      const sourceX = startX + x;
      const sourceY = startY + y;
      const contourChar = contourRows[sourceY]?.[sourceX] ?? " ";
      const base = renderBaseCell(map, sourceX, sourceY, opts.tags === true);
      const contour = renderContourCell(contourChar, map, sourceX, sourceY, opts.tags === true);
      if (opts.mode === "terrain") {
        line.push(base);
      } else if (opts.mode === "contours") {
        line.push(contourChar === " " ? base : contour);
      } else {
        const isWater = map.cells[sourceY]?.[sourceX]?.isWater === true;
        line.push(contourChar !== " " && !isWater ? contour : base);
      }
    }
    canvas.push(line);
  }

  if (opts.player) {
    const sprite = opts.player.sprite ?? [opts.player.glyph ?? "@"];
    const color = opts.player.color ?? "magenta";
    const anchorX = opts.player.x - startX;
    const anchorY = opts.player.y - startY;
    const spriteHeight = sprite.length;
    const spriteWidth = Math.max(0, ...sprite.map((row) => row.length));
    const originX = anchorX - Math.floor(spriteWidth / 2);
    const originY = anchorY - Math.floor(spriteHeight / 2);

    for (let sy = 0; sy < spriteHeight; sy += 1) {
      const row = sprite[sy] ?? "";
      for (let sx = 0; sx < row.length; sx += 1) {
        const ch = row[sx] ?? " ";
        if (ch === " ") continue;
        const targetX = originX + sx;
        const targetY = originY + sy;
        if (targetX < 0 || targetY < 0 || targetX >= viewWidth || targetY >= viewHeight) continue;
        canvas[targetY]![targetX] = colorize(ch, color, opts.tags === true);
      }
    }
  }

  for (const marker of opts.markers ?? []) {
    const targetX = marker.x - startX;
    const targetY = marker.y - startY;
    if (targetX < 0 || targetY < 0 || targetX >= viewWidth || targetY >= viewHeight) continue;
    canvas[targetY]![targetX] = colorize(marker.glyph, marker.color ?? "yellow", opts.tags === true);
  }

  return canvas.map((row) => row.join(""));
}
