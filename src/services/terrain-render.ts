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

// ── First-person object rendering data ──────────────────────────────────

// Multi-row sprites for near objects (bottom row first = base)
const FP_OBJ_SPRITE_NEAR: Record<string, string[][]> = {
  // Each sub-array: [glyph, colour] pairs from TOP to BOTTOM
  tree:   [["♣", "green"], ["♣", "green"], ["♣", "light-green"], ["│", "yellow"], ["│", "yellow"]],
  pine:   [["▲", "light-green"], ["▲", "green"], ["▲", "green"], ["│", "yellow"], ["│", "yellow"]],
  house:  [["▲", "red"], ["█", "yellow"], ["█", "yellow"], ["█", "yellow"]],
  rock:   [["●", "white"], ["▓", "light-black"]],
  flower: [["✿", "magenta"]],
  boat:   [["⛵", "light-white"]],
  bush:   [["♠", "light-green"], ["♠", "green"]],
};
const FP_OBJ_SPRITE_MID: Record<string, string[][]> = {
  tree:   [["♣", "green"], ["│", "light-black"]],
  pine:   [["▲", "green"], ["│", "light-black"]],
  house:  [["▲", "light-black"], ["█", "light-black"]],
  rock:   [["●", "light-black"]],
  flower: [["*", "light-black"]],
  boat:   [["⛵", "light-black"]],
  bush:   [["♠", "light-black"]],
};
const FP_OBJ_SPRITE_FAR: Record<string, string[][]> = {
  tree:   [[":", "light-black"]],
  pine:   [["^", "light-black"]],
  house:  [[".", "light-black"]],
  rock:   [[".", "light-black"]],
  flower: [],
  boat:   [],
  bush:   [],
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
  const FOV = Math.PI / 2.4; // slightly narrower for more depth
  const HORIZON = Math.floor(SH * 0.38); // lower horizon = more sky = more dramatic
  const isElevated = camElev > sea + 0.05;
  // Much stronger elevation scaling for dramatic hills
  const ELEV_SC = SH * (isElevated ? 0.75 : 0.45);
  const FAR = Math.max(
    Math.sqrt((peak.x - cam.x) ** 2 + (peak.y - cam.y) ** 2) * 1.6,
    Math.max(map.width, map.height) * 0.9,
  );
  const STEPS = 1000;
  // Sun position (fixed right-of-centre for lighting)
  const sunCol = Math.floor(SW * 0.7);
  const sunRow = Math.floor(HORIZON * 0.15);

  const tag = (color: string, ch: string) =>
    tags ? `{${color}-fg}${ch}{/${color}-fg}` : ch;

  const canvas: (string | null)[][] = Array.from({ length: SH }, () =>
    Array<string | null>(SW).fill(null),
  );
  const yBuf = Array<number>(SW).fill(SH);

  // Biome colours at 3 depth bands
  const COL_NEAR: Record<TerrainBiome, string> = {
    "deep-water": "blue", "shallow-water": "cyan", "shore": "yellow",
    "plain": "green", "forest": "light-green", "hill": "white",
    "ridge": "light-white", "peak": "light-white",
  };
  const COL_MID: Record<TerrainBiome, string> = {
    "deep-water": "blue", "shallow-water": "cyan", "shore": "yellow",
    "plain": "green", "forest": "green", "hill": "light-black",
    "ridge": "white", "peak": "light-white",
  };
  const COL_FAR: Record<TerrainBiome, string> = {
    "deep-water": "blue", "shallow-water": "blue", "shore": "light-black",
    "plain": "light-black", "forest": "light-black", "hill": "light-black",
    "ridge": "light-black", "peak": "light-black",
  };

  // Surface glyphs by distance band
  const SURF_NEAR: Record<TerrainBiome, string[]> = {
    "deep-water": ["≈", "~", "≈", "∽"],
    "shallow-water": ["~", "∽", "~", "·"],
    "shore": ["·", ".", ",", "·", "°"],
    "plain": [",", ".", "'", ";", ",", "·"],
    "forest": ["♣", "♠", "t", "♣", ","],
    "hill": ["∧", "n", "^", "∧", "."],
    "ridge": ["▲", "^", "△", "▲"],
    "peak": ["▲", "△", "▲", "^"],
  };
  const SURF_MID: Record<TerrainBiome, string[]> = {
    "deep-water": ["~", "~"], "shallow-water": ["~", "∽"],
    "shore": [".", "·"], "plain": [",", "."],
    "forest": [":", "♣"], "hill": ["^", "n"],
    "ridge": ["^", "△"], "peak": ["▲", "△"],
  };
  const SURF_FAR: Record<TerrainBiome, string> = {
    "deep-water": "~", "shallow-water": "~", "shore": "·",
    "plain": "·", "forest": "·", "hill": "·",
    "ridge": "·", "peak": "·",
  };

  // Column fill glyphs (the vertical face of terrain slopes)
  const CLIFF_NEAR: Record<TerrainBiome, string[]> = {
    "deep-water": ["~"], "shallow-water": ["~"],
    "shore": ["░", "."], "plain": ["▒", "░", ":"],
    "forest": ["▓", "▒", "│"], "hill": ["▓", "▒", "░"],
    "ridge": ["█", "▓", "▒"], "peak": ["█", "▓"],
  };
  const CLIFF_FAR: string[] = ["│", ":", "."];

  // ── Raycast ──
  for (let step = STEPS; step >= 1; step--) {
    const dist = (FAR * step) / STEPS;
    const d = dist / FAR; // 0=near, 1=far
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

      // Perspective projection with distance attenuation
      const proj = Math.max(0, Math.min(SH - 1,
        HORIZON - Math.round((cell.elevation - camElev) * ELEV_SC / (1 + d * 0.5)),
      ));

      if (proj < yBuf[col]!) {
        const hash = ((ix * 31 + iy * 7) & 0x7fffffff);

        // Surface glyph + colour by distance
        let sg: string;
        let sc: string;
        if (d < 0.2) {
          const arr = SURF_NEAR[cell.biome];
          sg = arr[hash % arr.length];
          sc = COL_NEAR[cell.biome];
        } else if (d < 0.5) {
          const arr = SURF_MID[cell.biome];
          sg = arr[hash % arr.length];
          sc = COL_MID[cell.biome];
        } else {
          sg = SURF_FAR[cell.biome];
          sc = COL_FAR[cell.biome];
        }

        canvas[proj]![col] = tag(sc, sg);

        // ── Column fill (cliff faces) ──
        const colHeight = yBuf[col]! - proj;
        for (let r = proj + 1; r < yBuf[col]!; r++) {
          if (canvas[r]![col] !== null) continue;
          const fillFrac = (r - proj) / Math.max(1, colHeight);

          if (cell.isWater) {
            // Water columns: wave animation feel
            const waveChar = ((col + r) & 1) ? "~" : "≈";
            canvas[r]![col] = tag(d < 0.4 ? "cyan" : "blue", waveChar);
          } else if (d < 0.35) {
            // Near: rich cliff textures
            const cliffArr = CLIFF_NEAR[cell.biome];
            const ci = Math.min(cliffArr.length - 1, Math.floor(fillFrac * cliffArr.length));
            const cliffColor = fillFrac < 0.5 ? sc : "light-black";
            canvas[r]![col] = tag(cliffColor, cliffArr[ci]);
          } else if (d < 0.6) {
            // Mid: simpler cliff
            const ci = Math.min(CLIFF_FAR.length - 1, Math.floor(fillFrac * CLIFF_FAR.length));
            canvas[r]![col] = tag("light-black", CLIFF_FAR[ci]);
          } else {
            // Far: just dots fading out
            canvas[r]![col] = tag("light-black", fillFrac < 0.5 ? ":" : ".");
          }
        }
        yBuf[col] = proj;

        // ── Object rendering ──
        if (cell.object && proj > 0) {
          const spriteSet = d < 0.18 ? FP_OBJ_SPRITE_NEAR
            : d < 0.45 ? FP_OBJ_SPRITE_MID
            : FP_OBJ_SPRITE_FAR;
          const sprite = spriteSet[cell.object];
          if (sprite && sprite.length > 0) {
            for (let si = 0; si < sprite.length; si++) {
              const row = proj - sprite.length + si;
              if (row >= 0 && row < SH) {
                canvas[row]![col] = tag(sprite[si][1], sprite[si][0]);
              }
            }
          }
        }
      }
    }
  }

  // ── Foreground fill (ground at viewer's feet) ──
  for (let col = 0; col < SW; col++) {
    const groundStart = Math.max(HORIZON, yBuf[col]!);
    for (let r = groundStart; r < SH; r++) {
      if (canvas[r]![col] !== null) continue;
      const frac = (r - HORIZON) / Math.max(1, SH - HORIZON);
      // Perspective distance: bottom row = nearest, horizon = farthest
      const perspDist = 1 - frac; // 0=very near, 1=at horizon
      if (camElev < sea + 0.08) {
        // Standing in/near water — rich depth-graded ocean
        if (perspDist > 0.8) {
          // Near horizon: calm deep water
          canvas[r]![col] = tag("blue", ((col + r) & 3) === 0 ? "~" : " ");
        } else if (perspDist > 0.6) {
          // Mid distance: gentle swells
          const swell = Math.sin(col * 0.3 + r * 0.15);
          canvas[r]![col] = tag("blue", swell > 0.3 ? "~" : swell > -0.3 ? "∽" : " ");
        } else if (perspDist > 0.35) {
          // Closer: visible waves
          const wave = Math.sin(col * 0.5 + r * 0.2) * Math.cos(col * 0.15);
          if (wave > 0.4) canvas[r]![col] = tag("cyan", "≈");
          else if (wave > 0) canvas[r]![col] = tag("cyan", "~");
          else if (wave > -0.3) canvas[r]![col] = tag("blue", "∽");
          else canvas[r]![col] = tag("blue", " ");
        } else {
          // Very near: detailed choppy water with foam
          const chop = Math.sin(col * 0.8 + r * 0.4) + Math.cos(col * 0.3 - r * 0.6) * 0.5;
          if (chop > 0.8) canvas[r]![col] = tag("light-white", "~");
          else if (chop > 0.3) canvas[r]![col] = tag("light-cyan", "≈");
          else if (chop > -0.2) canvas[r]![col] = tag("cyan", "~");
          else canvas[r]![col] = tag("blue", "∽");
        }
      } else {
        // Solid ground with perspective texture
        const camBiome = camCell?.biome ?? "plain";
        if (frac > 0.85) {
          // Very close: detailed with objects
          const nearGlyphs = camBiome === "forest" ? ["♣", ",", "♠", "'", "t", ","]
            : camBiome === "shore" ? [".", "·", ",", "°", ".", " "]
            : camBiome === "hill" ? ["^", "n", ".", "∧", "'", "."]
            : camBiome === "peak" ? ["▲", "^", "△", ".", "^"]
            : [",", ".", "'", ";", "·", ","];
          canvas[r]![col] = tag(COL_NEAR[camBiome], nearGlyphs[(col * 3 + r * 2) % nearGlyphs.length]);
        } else if (frac > 0.6) {
          const midGlyphs = camBiome === "forest" ? [",", "♣", ".", "'"]
            : [",", ".", "'", ";"];
          canvas[r]![col] = tag("green", midGlyphs[(col + r) % midGlyphs.length]);
        } else if (frac > 0.3) {
          canvas[r]![col] = tag("green", ((col + r) & 1) ? "," : ".");
        } else {
          canvas[r]![col] = tag("light-black", ((col + r) & 3) === 0 ? "." : " ");
        }
      }
    }
  }

  // ── Sky rendering ──
  // Sun glow
  for (let r = 0; r < SH; r++) {
    for (let col = 0; col < SW; col++) {
      if (canvas[r]![col] !== null) continue;
      const frac = HORIZON > 0 ? r / HORIZON : 0;

      // Sun and sun glow
      const dSunC = Math.abs(col - sunCol);
      const dSunR = Math.abs(r - sunRow);
      const dSun = Math.sqrt(dSunC * dSunC + dSunR * dSunR * 4); // stretch vertically
      if (dSun < 2) {
        canvas[r]![col] = tag("light-yellow", "☀");
        continue;
      }
      if (dSun < 5) {
        canvas[r]![col] = tag("light-yellow", "·");
        continue;
      }
      if (dSun < 10) {
        canvas[r]![col] = tag("yellow", "·");
        continue;
      }

      // Horizon glow band
      if (frac > 0.88) {
        // Warm horizon glow
        const glowIntensity = (frac - 0.88) / 0.12;
        if (dSun < 25) {
          canvas[r]![col] = tag("light-yellow", glowIntensity > 0.5 ? "░" : "·");
        } else {
          canvas[r]![col] = tag("light-cyan", "░");
        }
        continue;
      }
      if (frac > 0.75) {
        canvas[r]![col] = tag("light-cyan", "·");
        continue;
      }
      if (frac > 0.55) {
        canvas[r]![col] = tag("cyan", "·");
        continue;
      }

      // Mid sky: clouds
      if (frac > 0.3) {
        const cx = col * 0.12;
        const cy = r * 0.25;
        const cn1 = Math.sin(cx + cy * 0.7) * Math.cos(cx * 0.5 - cy);
        const cn2 = Math.sin(cx * 0.3 + cy * 1.2) * 0.5;
        const cloud = cn1 + cn2;
        if (cloud > 0.85) {
          canvas[r]![col] = tag("light-white", "█");
        } else if (cloud > 0.65) {
          canvas[r]![col] = tag("light-white", "▓");
        } else if (cloud > 0.5) {
          canvas[r]![col] = tag("light-white", "░");
        } else {
          canvas[r]![col] = tag("blue", "·");
        }
        continue;
      }

      // Upper sky: deep blue with occasional stars
      if (frac < 0.08) {
        const starRoll = Math.sin(col * 7.3 + r * 13.1) * 0.5 + 0.5;
        if (starRoll > 0.96) {
          canvas[r]![col] = tag("light-white", "✦");
        } else if (starRoll > 0.93) {
          canvas[r]![col] = tag("light-white", "·");
        } else {
          canvas[r]![col] = tag("blue", " ");
        }
      } else {
        canvas[r]![col] = tag("blue", "·");
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
