import { renderContourFromHills } from "./contour-engine.js";
import type { TerrainBiome, TerrainMap } from "./terrain-model.js";

export type TerrainRenderMode = "terrain" | "contours" | "hybrid" | "firstperson";

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
  /** Camera for first-person mode. Auto-placed opposite the highest peak if omitted. */
  firstPersonCamera?: {
    x: number;
    y: number;
    yaw?: number; // radians; auto-computed toward highest peak if omitted
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

export const BIOME_GLYPHS: Record<TerrainBiome, string> = {
  "deep-water": "~",
  "shallow-water": "~",
  "shore": ".",
  "plain": ",",
  "forest": "t",
  "hill": "n",
  "ridge": "^",
  "peak": "A",
};

export const BIOME_COLORS: Record<TerrainBiome, string> = {
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

// ---------------------------------------------------------------------------
// First-person voxel renderer (y-buffer, far-to-near, fixed horizon)
// Ported from scratch/iso_view.py — see that file for algorithm notes.
// ---------------------------------------------------------------------------

function fpFindPeak(map: TerrainMap): { x: number; y: number; elevation: number } {
  let best = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2), elevation: 0 };
  for (let y = 0; y < map.height; y += 4) {
    for (let x = 0; x < map.width; x += 4) {
      const cell = map.cells[y]?.[x];
      if (cell && !cell.isWater && cell.elevation > best.elevation) {
        best = { x, y, elevation: cell.elevation };
      }
    }
  }
  return best;
}

function fpAutoCamera(map: TerrainMap, peak: { x: number; y: number }): { x: number; y: number; yaw?: number } {
  let cx = Math.max(2, Math.min(map.width - 3, map.width - 1 - peak.x));
  let cy = Math.max(2, Math.min(map.height - 3, map.height - 1 - peak.y));
  outer: for (let r = 0; r <= 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = Math.round(cx) + dx;
        const ty = Math.round(cy) + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        const cell = map.cells[ty]?.[tx];
        if (cell && cell.biome !== "deep-water") { cx = tx; cy = ty; break outer; }
      }
    }
  }
  return { x: cx, y: cy };
}

function renderFirstPerson(
  map: TerrainMap,
  camOpt: TerrainRenderOptions["firstPersonCamera"],
  width: number,
  height: number,
  tags: boolean,
): string[] {
  const peak = fpFindPeak(map);
  const cam = camOpt ?? fpAutoCamera(map, peak);
  const camCell = map.cells[Math.round(cam.y)]?.[Math.round(cam.x)];
  const camElev = camCell?.elevation ?? map.seaLevel;
  const yaw = cam.yaw ?? Math.atan2(peak.y - cam.y, peak.x - cam.x);

  const SW = width;
  const SH = height;
  const sea = map.seaLevel;
  const FOV = Math.PI / 2;
  const HORIZON = Math.floor(SH * 0.52);
  const ELEV_SC = SH * (camElev > sea + 0.05 ? 0.38 : 0.22);
  const FAR = Math.sqrt((peak.x - cam.x) ** 2 + (peak.y - cam.y) ** 2) * 1.4;
  const STEPS = 600;

  const tag = (color: string, ch: string) =>
    tags ? `{${color}-fg}${ch}{/${color}-fg}` : ch;

  const canvas: (string | null)[][] = Array.from({ length: SH }, () =>
    Array<string | null>(SW).fill(null),
  );
  const yBuf = Array<number>(SW).fill(HORIZON);

  for (let step = STEPS; step >= 1; step--) {
    const dist = (FAR * step) / STEPS;
    for (let col = 0; col < SW; col++) {
      if (yBuf[col]! <= 0) continue;
      const ang = yaw + FOV * (col / (SW - 1) - 0.5);
      const wx = cam.x + Math.cos(ang) * dist;
      const wy = cam.y + Math.sin(ang) * dist;
      if (wx < 0 || wx >= map.width || wy < 0 || wy >= map.height) continue;
      const cell = map.cells[Math.floor(wy)]?.[Math.floor(wx)];
      if (!cell) continue;
      const proj = Math.max(0, Math.min(SH - 1,
        HORIZON - Math.round((cell.elevation - camElev) * ELEV_SC),
      ));
      if (proj < yBuf[col]!) {
        canvas[proj]![col] = tag(BIOME_COLORS[cell.biome], BIOME_GLYPHS[cell.biome]);
        for (let r = proj + 1; r < yBuf[col]!; r++) {
          if (canvas[r]![col] === null) canvas[r]![col] = tag("light-black", "|");
        }
        yBuf[col] = proj;
      }
    }
  }

  // Below-horizon fill: water near sea level, ground otherwise
  const fillBelow = camElev < sea + 0.08 ? tag("blue", "~") : tag("green", "_");
  for (let col = 0; col < SW; col++) {
    for (let r = Math.max(HORIZON, yBuf[col]!); r < SH; r++) {
      if (canvas[r]![col] === null) canvas[r]![col] = fillBelow;
    }
  }

  // Sky gradient (dark navy → mid blue toward horizon)
  const SKY = ["blue", "blue", "blue", "cyan"];
  for (let r = 0; r < SH; r++) {
    for (let col = 0; col < SW; col++) {
      if (canvas[r]![col] === null) {
        const frac = HORIZON > 0 ? r / HORIZON : 0;
        const idx = Math.min(SKY.length - 1, Math.floor(frac * SKY.length));
        canvas[r]![col] = tag(SKY[idx]!, "\u00b7"); // ·
      }
    }
  }

  return canvas.map((row) => row.map((cell) => cell ?? " ").join(""));
}

// ---------------------------------------------------------------------------

export function renderTerrainMap(map: TerrainMap, opts: TerrainRenderOptions): string[] {
  if (opts.mode === "firstperson") {
    const vpW = opts.camera?.width ?? map.width;
    const vpH = opts.camera?.height ?? map.height;
    return renderFirstPerson(map, opts.firstPersonCamera, Math.max(8, vpW), Math.max(4, vpH), opts.tags === true);
  }

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
