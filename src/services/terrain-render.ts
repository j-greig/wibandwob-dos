import { renderContourFromHills } from "./contour-engine.js";
import type { TerrainBiome, TerrainMap, TerrainObject } from "./terrain-model.js";

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

// Object glyphs and colours for 2D map views
const OBJECT_GLYPHS: Record<string, string> = {
  tree: "♣", pine: "▲", house: "⌂", rock: "●", flower: "*", boat: "⛵", bush: "♠",
};
const OBJECT_COLORS: Record<string, string> = {
  tree: "green", pine: "light-green", house: "yellow", rock: "white",
  flower: "magenta", boat: "light-white", bush: "light-green",
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
  // Show terrain objects if present
  if (cell.object) {
    const glyph = OBJECT_GLYPHS[cell.object];
    const color = OBJECT_COLORS[cell.object];
    if (glyph && color) return colorize(glyph, color, tags);
  }
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

export function findTerrainPeak(map: TerrainMap): { x: number; y: number; elevation: number } {
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

// Object glyph/colour for first-person rendering
const FP_OBJECT_GLYPHS: Record<string, string> = {
  tree: "♣", pine: "▲", house: "⌂", rock: "●", flower: "*", boat: "⛵", bush: "♠",
};
const FP_OBJECT_COLORS: Record<string, string> = {
  tree: "green", pine: "light-green", house: "yellow", rock: "white",
  flower: "magenta", boat: "light-white", bush: "light-green",
};
const FP_OBJECT_COLORS_FAR: Record<string, string> = {
  tree: "light-black", pine: "light-black", house: "light-black", rock: "light-black",
  flower: "light-black", boat: "light-black", bush: "light-black",
};

function renderFirstPerson(
  map: TerrainMap,
  camOpt: TerrainRenderOptions["firstPersonCamera"],
  width: number,
  height: number,
  tags: boolean,
): string[] {
  const peak = findTerrainPeak(map);
  const cam = camOpt ?? fpAutoCamera(map, peak);
  const camCell = map.cells[Math.round(cam.y)]?.[Math.round(cam.x)];
  const camElev = camCell?.elevation ?? map.seaLevel;
  const yaw = cam.yaw ?? Math.atan2(peak.y - cam.y, peak.x - cam.x);

  const SW = width;
  const SH = height;
  const sea = map.seaLevel;
  const FOV = Math.PI / 2.2;
  const HORIZON = Math.floor(SH * 0.42);
  // Stronger elevation scaling for dramatic relief
  const isElevated = camElev > sea + 0.05;
  const ELEV_SC = SH * (isElevated ? 0.55 : 0.35);
  const FAR = Math.max(
    Math.sqrt((peak.x - cam.x) ** 2 + (peak.y - cam.y) ** 2) * 1.5,
    Math.max(map.width, map.height) * 0.8,
  );
  const STEPS = 800;

  const tag = (color: string, ch: string) =>
    tags ? `{${color}-fg}${ch}{/${color}-fg}` : ch;

  const canvas: (string | null)[][] = Array.from({ length: SH }, () =>
    Array<string | null>(SW).fill(null),
  );
  const yBuf = Array<number>(SW).fill(SH); // start from bottom, not horizon
  const distBuf = Array<number>(SW).fill(FAR + 1); // track distance per column

  // Depth-fogged biome colours
  const BIOME_COLORS_MID: Record<TerrainBiome, string> = {
    "deep-water": "blue", "shallow-water": "cyan", "shore": "yellow",
    "plain": "green", "forest": "light-green", "hill": "light-black",
    "ridge": "white", "peak": "light-white",
  };
  const BIOME_COLORS_FAR: Record<TerrainBiome, string> = {
    "deep-water": "blue", "shallow-water": "blue", "shore": "light-black",
    "plain": "light-black", "forest": "light-black", "hill": "light-black",
    "ridge": "light-black", "peak": "light-black",
  };

  // Richer ground surface glyphs varying by biome and distance
  const SURFACE_NEAR: Record<TerrainBiome, string[]> = {
    "deep-water": ["≈", "~", "≈"], "shallow-water": ["~", "∽", "~"],
    "shore": [".", "·", ",", "."], "plain": [",", ".", "'", ",", ";"],
    "forest": ["♣", "♠", ",", "t", "♣"], "hill": ["∧", "n", "^", "∧"],
    "ridge": ["▲", "^", "△", "▲"], "peak": ["▲", "△", "▲"],
  };
  const SURFACE_MID: Record<TerrainBiome, string[]> = {
    "deep-water": ["~", "~"], "shallow-water": ["~", "~"],
    "shore": [".", "."], "plain": [",", "."],
    "forest": ["♣", "t"], "hill": ["^", "n"],
    "ridge": ["^", "△"], "peak": ["▲", "△"],
  };
  const SURFACE_FAR: Record<TerrainBiome, string> = {
    "deep-water": "~", "shallow-water": "~", "shore": ".",
    "plain": ".", "forest": ":", "hill": "^",
    "ridge": "^", "peak": "▲",
  };

  // Raycast far-to-near
  for (let step = STEPS; step >= 1; step--) {
    const dist = (FAR * step) / STEPS;
    const distFrac = dist / FAR; // 0=near, 1=far
    for (let col = 0; col < SW; col++) {
      if (yBuf[col]! <= 0) continue;
      const ang = yaw + FOV * (col / (SW - 1) - 0.5);
      const wx = cam.x + Math.cos(ang) * dist;
      const wy = cam.y + Math.sin(ang) * dist;
      if (wx < 0 || wx >= map.width || wy < 0 || wy >= map.height) continue;
      const iy = Math.floor(wy);
      const ix = Math.floor(wx);
      const cell = map.cells[iy]?.[ix];
      if (!cell) continue;

      const proj = Math.max(0, Math.min(SH - 1,
        HORIZON - Math.round((cell.elevation - camElev) * ELEV_SC / (1 + distFrac * 0.3)),
      ));

      if (proj < yBuf[col]!) {
        // Choose surface glyph and colour based on distance
        let surfaceGlyph: string;
        let surfaceColor: string;
        const hash = ((ix * 31 + iy * 7) & 0x7fffffff);
        if (distFrac < 0.25) {
          const arr = SURFACE_NEAR[cell.biome];
          surfaceGlyph = arr[hash % arr.length];
          surfaceColor = BIOME_COLORS[cell.biome];
        } else if (distFrac < 0.55) {
          const arr = SURFACE_MID[cell.biome];
          surfaceGlyph = arr[hash % arr.length];
          surfaceColor = BIOME_COLORS_MID[cell.biome];
        } else {
          surfaceGlyph = SURFACE_FAR[cell.biome];
          surfaceColor = BIOME_COLORS_FAR[cell.biome];
        }

        canvas[proj]![col] = tag(surfaceColor, surfaceGlyph);
        distBuf[col] = dist;

        // Fill column below with shaded terrain
        for (let r = proj + 1; r < yBuf[col]!; r++) {
          if (canvas[r]![col] === null) {
            // Gradient: near terrain gets biome colour, far gets muted
            const fillFrac = (r - proj) / Math.max(1, yBuf[col]! - proj);
            if (cell.isWater) {
              canvas[r]![col] = tag(distFrac > 0.5 ? "blue" : "cyan", "~");
            } else if (fillFrac < 0.3) {
              canvas[r]![col] = tag(surfaceColor, distFrac < 0.3 ? ":" : ".");
            } else {
              canvas[r]![col] = tag("light-black", distFrac < 0.4 ? "│" : ".");
            }
          }
        }
        yBuf[col] = proj;

        // Render terrain objects as vertical elements above the surface
        if (cell.object && distFrac < 0.6 && proj > 0) {
          const objGlyph = FP_OBJECT_GLYPHS[cell.object] || "?";
          const objColor = distFrac < 0.3
            ? (FP_OBJECT_COLORS[cell.object] || "white")
            : (FP_OBJECT_COLORS_FAR[cell.object] || "light-black");
          // Object height: 1-3 rows depending on distance and type
          const objH = cell.object === "house" || cell.object === "tree" || cell.object === "pine"
            ? (distFrac < 0.15 ? 3 : distFrac < 0.35 ? 2 : 1)
            : 1;
          for (let oh = 0; oh < objH && proj - 1 - oh >= 0; oh++) {
            const or = proj - 1 - oh;
            if (oh === objH - 1) {
              canvas[or]![col] = tag(objColor, objGlyph);
            } else if (cell.object === "tree" || cell.object === "pine") {
              canvas[or]![col] = tag(objColor, oh === 0 ? "│" : objGlyph);
            } else if (cell.object === "house") {
              canvas[or]![col] = tag(objColor, oh === 0 ? "█" : "▲");
            }
          }
        }
      }
    }
  }

  // Below-horizon fill: foreground ground
  for (let col = 0; col < SW; col++) {
    const groundStart = Math.max(HORIZON, yBuf[col]!);
    for (let r = groundStart; r < SH; r++) {
      if (canvas[r]![col] !== null) continue;
      const frac = (r - HORIZON) / Math.max(1, SH - HORIZON);
      if (camElev < sea + 0.08) {
        // Near water: waves
        const wave = ((col + r) % 3 === 0) ? "≈" : "~";
        canvas[r]![col] = tag(frac < 0.3 ? "cyan" : "blue", wave);
      } else {
        // Ground beneath viewer
        if (frac < 0.2) canvas[r]![col] = tag("green", ",");
        else if (frac < 0.5) canvas[r]![col] = tag("green", ".");
        else canvas[r]![col] = tag("light-green", "'");
      }
    }
  }

  // Sky: rich gradient from deep blue at top → cyan → light near horizon
  // with occasional cloud wisps
  for (let r = 0; r < SH; r++) {
    for (let col = 0; col < SW; col++) {
      if (canvas[r]![col] !== null) continue;
      const frac = HORIZON > 0 ? r / HORIZON : 0;
      if (frac > 0.85) {
        // Near horizon: light haze
        canvas[r]![col] = tag("light-cyan", "·");
      } else if (frac > 0.65) {
        canvas[r]![col] = tag("cyan", "·");
      } else if (frac > 0.4) {
        // Mid sky — occasional cloud wisps
        const cloudNoise = Math.sin(col * 0.15 + r * 0.3) * Math.cos(col * 0.08 - r * 0.2);
        if (cloudNoise > 0.7) {
          canvas[r]![col] = tag("light-white", "░");
        } else {
          canvas[r]![col] = tag("blue", "·");
        }
      } else {
        // Upper sky: deep blue, very sparse
        const starRoll = Math.sin(col * 7.3 + r * 13.1) * 0.5 + 0.5;
        if (frac < 0.1 && starRoll > 0.97) {
          canvas[r]![col] = tag("light-white", "·");
        } else {
          canvas[r]![col] = tag("blue", frac < 0.15 ? " " : "·");
        }
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
