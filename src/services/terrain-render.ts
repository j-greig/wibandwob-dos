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

  // ── Precompute per-column ray directions (cos/sin only needed once per column) ──
  const rayDX = new Float64Array(SW);
  const rayDY = new Float64Array(SW);
  const SW1 = SW - 1;
  for (let col = 0; col < SW; col++) {
    const ang = yaw + FOV * (col / SW1 - 0.5);
    rayDX[col] = Math.cos(ang);
    rayDY[col] = Math.sin(ang);
  }

  // ── Raycast ──
  let activeCols = SW; // track filled columns for early exit
  for (let step = STEPS; step >= 1; step--) {
    if (activeCols <= 0) break; // all columns filled — no more work to do
    const dist = (FAR * step) / STEPS;
    const d = dist / FAR; // 0=near, 1=far
    for (let col = 0; col < SW; col++) {
      if (yBuf[col]! <= 0) continue;
      const wx = cam.x + rayDX[col]! * dist;
      const wy = cam.y + rayDY[col]! * dist;
      if (wx < 0 || wx >= map.width || wy < 0 || wy >= map.height) continue;
      const iy = Math.floor(wy);
      const ix = Math.floor(wx);
      const cell = map.cells[iy]![ix]; // bounds already checked above
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
        if (proj <= 0) activeCols--; // column fully filled from top
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
        // Standing in/near water — rich depth-graded ocean with reflections
        const wave1 = Math.sin(col * 0.5 + r * 0.2) * Math.cos(col * 0.15);
        const wave2 = Math.sin(col * 0.3 + r * 0.15);
        const chop = Math.sin(col * 0.8 + r * 0.4) + Math.cos(col * 0.3 - r * 0.6) * 0.5;
        // Sun reflection on water
        const sunReflDist = Math.abs(col - sunCol);
        const isSunRefl = sunReflDist < 8 + frac * 15 && perspDist > 0.3;

        if (perspDist > 0.85) {
          // Near horizon: sky reflection, calm
          if (isSunRefl && sunReflDist < 4) {
            canvas[r]![col] = tag("light-yellow", "~");
          } else {
            canvas[r]![col] = tag("blue", ((col + r) & 5) === 0 ? "~" : " ");
          }
        } else if (perspDist > 0.6) {
          // Mid distance: gentle swells with colour variation
          if (isSunRefl) {
            canvas[r]![col] = tag("yellow", wave2 > 0 ? "≈" : "~");
          } else if (wave2 > 0.3) {
            canvas[r]![col] = tag("cyan", "~");
          } else if (wave2 > -0.3) {
            canvas[r]![col] = tag("blue", "∽");
          } else {
            canvas[r]![col] = tag("blue", " ");
          }
        } else if (perspDist > 0.3) {
          // Closer: visible waves with foam caps
          if (wave1 > 0.6) canvas[r]![col] = tag("light-white", "~");
          else if (wave1 > 0.3) canvas[r]![col] = tag("light-cyan", "≈");
          else if (wave1 > 0) canvas[r]![col] = tag("cyan", "~");
          else if (wave1 > -0.3) canvas[r]![col] = tag("blue", "∽");
          else canvas[r]![col] = tag("blue", " ");
        } else {
          // Very near: detailed choppy water with foam spray
          if (chop > 0.9) canvas[r]![col] = tag("light-white", "≈");
          else if (chop > 0.5) canvas[r]![col] = tag("light-white", "~");
          else if (chop > 0.2) canvas[r]![col] = tag("light-cyan", "≈");
          else if (chop > -0.1) canvas[r]![col] = tag("cyan", "~");
          else if (chop > -0.4) canvas[r]![col] = tag("blue", "∽");
          else canvas[r]![col] = tag("blue", " ");
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

  // ── Sky rendering — layered atmosphere ──
  // Noise helper for cloud generation
  const noise2d = (x: number, y: number, sx: number, sy: number) =>
    Math.sin(x * sx + y * sy * 0.7) * Math.cos(x * sx * 0.5 - y * sy) +
    Math.sin(x * sx * 0.3 + y * sy * 1.2) * 0.5;

  for (let r = 0; r < SH; r++) {
    for (let col = 0; col < SW; col++) {
      if (canvas[r]![col] !== null) continue;
      const frac = HORIZON > 0 ? r / HORIZON : 0; // 0=top, 1=horizon

      // Sun and sun glow — large, warm, radiating
      const dSunC = Math.abs(col - sunCol);
      const dSunR = Math.abs(r - sunRow);
      const dSun = Math.sqrt(dSunC * dSunC + dSunR * dSunR * 4);
      if (dSun < 2) { canvas[r]![col] = tag("light-yellow", "☀"); continue; }
      if (dSun < 6) { canvas[r]![col] = tag("light-yellow", "◌"); continue; }
      if (dSun < 12) { canvas[r]![col] = tag("yellow", "·"); continue; }

      // ── Layer 1: Zenith (frac 0–0.12) — deep space, stars ──
      if (frac < 0.12) {
        const starHash = Math.sin(col * 7.3 + r * 13.1) * 0.5 + 0.5;
        const starHash2 = Math.sin(col * 11.7 + r * 5.3) * 0.5 + 0.5;
        if (starHash > 0.96) {
          canvas[r]![col] = tag("light-white", "✦");
        } else if (starHash > 0.93) {
          canvas[r]![col] = tag("light-white", "·");
        } else if (starHash2 > 0.97) {
          canvas[r]![col] = tag("cyan", "·");
        } else {
          // Deep blue gradient — darker at very top
          canvas[r]![col] = frac < 0.04
            ? tag("blue", " ")
            : tag("blue", ((col + r) & 7) === 0 ? "·" : " ");
        }
        continue;
      }

      // ── Layer 2: Upper sky (frac 0.12–0.35) — high cirrus clouds ──
      if (frac < 0.35) {
        // Wispy high-altitude clouds
        const cirrus = noise2d(col, r, 0.06, 0.15);
        const cirrus2 = Math.sin(col * 0.04 + r * 0.08) * 0.4;
        const combined = cirrus + cirrus2;
        if (combined > 1.0) {
          canvas[r]![col] = tag("light-white", "░");
        } else if (combined > 0.75) {
          canvas[r]![col] = tag("light-cyan", "·");
        } else {
          // Blue sky with subtle gradient
          const skyDensity = frac < 0.2 ? 5 : 3;
          canvas[r]![col] = ((col + r * 2) % skyDensity === 0)
            ? tag("blue", "·")
            : tag("blue", " ");
        }
        continue;
      }

      // ── Layer 3: Mid sky (frac 0.35–0.6) — cumulus cloud band ──
      if (frac < 0.6) {
        const cx = col * 0.09;
        const cy = r * 0.2;
        const cloud1 = noise2d(col, r, 0.09, 0.2);
        const cloud2 = Math.sin(cx * 1.7 + cy * 0.5) * Math.cos(cx * 0.8 + cy * 1.3) * 0.6;
        const cloud3 = Math.sin(col * 0.02 + r * 0.05) * 0.3; // large-scale patches
        const cloud = cloud1 + cloud2 + cloud3;

        // Cloud shadow effect — slightly darker below dense clouds
        const cloudBrightness = frac < 0.48 ? 0 : 0.15; // upper clouds brighter

        if (cloud > 1.1 - cloudBrightness) {
          canvas[r]![col] = tag("light-white", "█");
        } else if (cloud > 0.85 - cloudBrightness) {
          canvas[r]![col] = tag("light-white", "▓");
        } else if (cloud > 0.6 - cloudBrightness) {
          canvas[r]![col] = tag("light-white", "░");
        } else if (cloud > 0.4) {
          canvas[r]![col] = tag("light-cyan", "░");
        } else {
          // Sky between clouds — cyan gradient
          canvas[r]![col] = ((col + r) & 3) === 0
            ? tag("cyan", "·")
            : tag("cyan", " ");
        }
        continue;
      }

      // ── Layer 4: Low sky (frac 0.6–0.8) — atmospheric haze ──
      if (frac < 0.8) {
        // Low scattered clouds + haze building toward horizon
        const haze = noise2d(col, r, 0.07, 0.12);
        const hazeFrac = (frac - 0.6) / 0.2; // 0=top of band, 1=bottom

        // Sun pillar effect near sun column
        const sunDist = Math.abs(col - sunCol);
        if (sunDist < 15 && dSun < 40) {
          const pillarStrength = (1 - sunDist / 15) * (1 - hazeFrac * 0.5);
          if (pillarStrength > 0.5) {
            canvas[r]![col] = tag("yellow", "░");
            continue;
          }
        }

        if (haze > 0.7) {
          canvas[r]![col] = tag("light-white", hazeFrac > 0.5 ? "▓" : "░");
        } else if (haze > 0.3) {
          canvas[r]![col] = tag("light-cyan", hazeFrac > 0.6 ? "░" : "·");
        } else {
          canvas[r]![col] = hazeFrac > 0.7
            ? tag("light-cyan", "·")
            : tag("cyan", " ");
        }
        continue;
      }

      // ── Layer 5: Horizon glow (frac 0.8–1.0) — warm atmospheric band ──
      {
        const horizFrac = (frac - 0.8) / 0.2;
        const sunDist = Math.abs(col - sunCol);
        const nearSun = sunDist < 30;

        if (horizFrac > 0.7) {
          // Very near horizon — bright glow
          if (nearSun) {
            const glow = 1 - sunDist / 30;
            canvas[r]![col] = glow > 0.5
              ? tag("light-yellow", "▓")
              : tag("yellow", "░");
          } else {
            canvas[r]![col] = tag("light-cyan", "░");
          }
        } else if (horizFrac > 0.4) {
          if (nearSun) {
            canvas[r]![col] = tag("yellow", "░");
          } else {
            canvas[r]![col] = tag("light-cyan", "·");
          }
        } else {
          // Upper horizon glow
          const haze = noise2d(col, r, 0.05, 0.1);
          if (haze > 0.5) {
            canvas[r]![col] = tag("light-white", "░");
          } else {
            canvas[r]![col] = nearSun
              ? tag("yellow", "·")
              : tag("light-cyan", " ");
          }
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
