import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════
// ASCIICKER — ASCII 3D world renderer
//
// Inspired by github.com/msokalski/asciicker (MIT)
// A proper 3D software renderer: heightmap terrain projected
// through a 3D camera with depth buffer, triangle rasterization,
// per-cell material/colour, directional lighting.
//
// Not a 2D tile map — a real 3D engine rendered to ASCII.
// ═══════════════════════════════════════════════════════════════

// ─── Render buffer cell ─────────────────────────────────────

interface Sample {
  depth: number;     // z-buffer
  glyph: string;
  fg: number;        // ANSI 256 colour index
  bg: number;        // ANSI 256 colour index
  flags: number;     // 0=empty, 1=terrain, 2=sprite, 4=water
}

// ─── Biome types ────────────────────────────────────────────

const enum Biome {
  DEEP_WATER = 0,
  WATER = 1,
  SAND = 2,
  GRASS = 3,
  FOREST = 4,
  ROCK = 5,
  MOUNTAIN = 6,
  SNOW = 7,
}

// Material: top face glyph set, side face glyph set, colour ramp (light→dark)
interface Material {
  topGlyphs: string[];
  sideGlyphs: string[];
  fgLight: number;     // ANSI 256 - bright
  fgMid: number;       // ANSI 256 - medium
  fgDark: number;      // ANSI 256 - shadow
  bgLight: number;
  bgDark: number;
}

// ANSI 256 colour helpers
function rgb6(r: number, g: number, b: number): number {
  return 16 + r * 36 + g * 6 + b; // 6x6x6 cube
}
function grey(n: number): number { return 232 + n; } // 0-23 greyscale

const MATERIALS: Record<Biome, Material> = {
  [Biome.DEEP_WATER]: {
    topGlyphs: ["≈", "~", "∽", "≋", "∿"],
    sideGlyphs: ["█", "▓"],
    fgLight: rgb6(1, 2, 5), fgMid: rgb6(0, 1, 4), fgDark: rgb6(0, 0, 3),
    bgLight: rgb6(0, 1, 3), bgDark: rgb6(0, 0, 2),
  },
  [Biome.WATER]: {
    topGlyphs: ["~", "∼", "≈", "˜", "∿"],
    sideGlyphs: ["▓", "▒"],
    fgLight: rgb6(1, 3, 5), fgMid: rgb6(0, 2, 5), fgDark: rgb6(0, 1, 4),
    bgLight: rgb6(0, 2, 4), bgDark: rgb6(0, 1, 3),
  },
  [Biome.SAND]: {
    topGlyphs: [".", "·", "∙", ",", "'"],
    sideGlyphs: ["▒", "░", "▓"],
    fgLight: rgb6(5, 5, 2), fgMid: rgb6(4, 4, 1), fgDark: rgb6(3, 3, 0),
    bgLight: rgb6(5, 4, 2), bgDark: rgb6(4, 3, 1),
  },
  [Biome.GRASS]: {
    topGlyphs: [".", ";", ",", "'", "\"", "`", ":", "∴"],
    sideGlyphs: ["▒", "░", "▓", "█"],
    fgLight: rgb6(1, 4, 0), fgMid: rgb6(0, 3, 0), fgDark: rgb6(0, 2, 0),
    bgLight: rgb6(0, 3, 0), bgDark: rgb6(0, 2, 0),
  },
  [Biome.FOREST]: {
    topGlyphs: ["♣", "♠", "▲", "△", "⌂", "♧", "↟", "↡"],
    sideGlyphs: ["║", "▓", "█", "▌"],
    fgLight: rgb6(0, 4, 0), fgMid: rgb6(0, 3, 0), fgDark: rgb6(0, 1, 0),
    bgLight: rgb6(0, 2, 0), bgDark: rgb6(0, 1, 0),
  },
  [Biome.ROCK]: {
    topGlyphs: ["#", "▒", "░", "▓", "∎", "▪"],
    sideGlyphs: ["█", "▓", "▒", "░"],
    fgLight: grey(14), fgMid: grey(10), fgDark: grey(6),
    bgLight: grey(8), bgDark: grey(4),
  },
  [Biome.MOUNTAIN]: {
    topGlyphs: ["▲", "△", "▴", "◮", "⏶", "∧"],
    sideGlyphs: ["█", "▓", "▌", "▐"],
    fgLight: grey(16), fgMid: grey(12), fgDark: grey(7),
    bgLight: grey(10), bgDark: grey(5),
  },
  [Biome.SNOW]: {
    topGlyphs: ["*", "·", "∘", "°", "⁎", "❄"],
    sideGlyphs: ["█", "▓"],
    fgLight: grey(23), fgMid: grey(20), fgDark: grey(16),
    bgLight: grey(22), bgDark: grey(18),
  },
};

// ─── Player sprite from asciicker (player-nude.xp, front-facing standing) ───

interface SpriteCell { ch: string; fg: [number,number,number]; bg: [number,number,number] }
const PLAYER_SPRITE = {
  w: 5, h: 8,
  cells: [
    null, null, { ch: "▄", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null, null,
    null, { ch: "▐", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "\"", fg: [0,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▌", fg: [0,0,0] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null,
    null, null, { ch: "v", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null, null,
    null, { ch: "▄", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "┬", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▄", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null,
    { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "┼", fg: [170,0,0] as [number,number,number], bg: [255,85,85] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] },
    null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, { ch: "U", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, { ch: "▌", fg: [255,85,85] as [number,number,number], bg: [255,255,85] as [number,number,number] }, null,
    null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null, { ch: "▐", fg: [255,85,85] as [number,number,number], bg: [255,85,85] as [number,number,number] }, null,
    null, { ch: "▀", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, null, { ch: "▀", fg: [255,85,85] as [number,number,number], bg: [0,0,0] as [number,number,number] }, null,
  ] as (SpriteCell | null)[],
};

function spriteRgbToAnsi(c: [number, number, number]): number {
  return 16 + Math.round(c[0]/255*5) * 36 + Math.round(c[1]/255*5) * 6 + Math.round(c[2]/255*5);
}

// ─── Noise for terrain generation ───────────────────────────

function hash2d(x: number, y: number, s: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + s * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy, s), b = hash2d(ix+1, iy, s);
  const c = hash2d(ix, iy+1, s), d = hash2d(ix+1, iy+1, s);
  return a + sx * (b-a) + sy * (c-a) + sx*sy * (a-b-c+d);
}

function fractal(x: number, y: number, s: number, oct: number): number {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < oct; i++) {
    v += smoothNoise(x*f, y*f, s+i*100) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ─── Terrain ────────────────────────────────────────────────

interface TerrainCell {
  height: number;   // 0-255
  biome: Biome;
}

interface Terrain {
  w: number;
  h: number;
  cells: TerrainCell[];
  seed: number;
}

function genTerrain(w: number, h: number, seed: number): Terrain {
  const cells: TerrainCell[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = fractal(x*0.018, y*0.018, seed, 6);
      const ridge = 1 - Math.abs(fractal(x*0.012, y*0.012, seed+500, 4) * 2 - 1);
      const combined = raw * 0.65 + ridge * 0.35;
      const height = Math.floor(Math.max(0, Math.min(255, combined * 255)));
      const moisture = fractal(x*0.025, y*0.025, seed+1000, 4);

      let biome: Biome;
      if (height < 45) biome = Biome.DEEP_WATER;
      else if (height < 60) biome = Biome.WATER;
      else if (height < 72) biome = Biome.SAND;
      else if (height < 135) biome = moisture > 0.55 ? Biome.FOREST : Biome.GRASS;
      else if (height < 180) biome = Biome.ROCK;
      else if (height < 220) biome = Biome.MOUNTAIN;
      else biome = Biome.SNOW;

      cells[y * w + x] = { height, biome };
    }
  }
  return { w, h, cells, seed };
}

function getH(t: Terrain, x: number, y: number): number {
  if (x < 0 || x >= t.w || y < 0 || y >= t.h) return 0;
  return t.cells[y * t.w + x].height;
}

function getBiome(t: Terrain, x: number, y: number): Biome {
  if (x < 0 || x >= t.w || y < 0 || y >= t.h) return Biome.DEEP_WATER;
  return t.cells[y * t.w + x].biome;
}

// ─── 3D Camera ──────────────────────────────────────────────

interface Camera {
  x: number; y: number; z: number;  // world position
  yaw: number;      // degrees (0-360)
  pitch: number;    // tilt angle (fixed ~30°)
  zoom: number;     // scale factor
}

// ─── 3D projection ─────────────────────────────────────────
// Faithful to asciicker: isometric-ish with 30° pitch,
// yaw-rotatable, architectural perspective (verticals stay vertical).

function projectPoint(
  wx: number, wy: number, wz: number,
  cam: Camera, sw: number, sh: number,
): { sx: number; sy: number; depth: number } {
  // Translate relative to camera
  const rx = wx - cam.x;
  const ry = wy - cam.y;
  const rz = wz - cam.z;

  // Rotate by yaw around Z axis
  const yr = cam.yaw * Math.PI / 180;
  const cosY = Math.cos(yr);
  const sinY = Math.sin(yr);
  const tx = rx * cosY - ry * sinY;
  const ty = rx * sinY + ry * cosY;

  // Isometric projection with ~30° pitch
  // Like asciicker: x component maps horizontally,
  // y component maps into screen (depth + vertical),
  // z maps vertically
  const sin30 = 0.5;  // sin(30°)
  const cos30 = 0.866; // cos(30°)

  const screenX = tx * cam.zoom;
  const screenY = -ty * sin30 * cam.zoom - rz * cos30 * cam.zoom;
  const depth = ty; // depth for z-sorting

  const sx = Math.round(sw / 2 + screenX);
  const sy = Math.round(sh / 2 + screenY);

  return { sx, sy, depth };
}

// ─── 3D Renderer ────────────────────────────────────────────

function renderScene(
  terrain: Terrain,
  cam: Camera,
  sw: number, sh: number,
  playerX: number, playerY: number,
  tick: number,
): Sample[] {
  // Create depth buffer
  const buf: Sample[] = new Array(sw * sh);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = { depth: -Infinity, glyph: " ", fg: 0, bg: 0, flags: 0 };
  }

  // Determine visible world range
  const viewRange = Math.floor(18 / cam.zoom) + 6;
  const cx = Math.floor(cam.x), cy = Math.floor(cam.y);

  // Fog parameters — fade to grey at distance
  const fogStart = viewRange * 0.5;
  const fogEnd = viewRange * 0.95;
  const fogColour = grey(4); // dark grey fog

  // Collect all terrain columns to render
  type Col = { wx: number; wy: number; h: number; biome: Biome; depth: number; dist: number };
  const columns: Col[] = [];

  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const wx = cx + dx, wy = cy + dy;
      const h = getH(terrain, wx, wy);
      const biome = getBiome(terrain, wx, wy);

      // Compute depth for sorting
      const rx = wx - cam.x, ry = wy - cam.y;
      const yr = cam.yaw * Math.PI / 180;
      const depth = rx * Math.sin(yr) + ry * Math.cos(yr);

      const dist = Math.sqrt(dx*dx + dy*dy);
      columns.push({ wx, wy, h, biome, depth, dist });
    }
  }

  // Sort back to front (furthest first)
  columns.sort((a, b) => b.depth - a.depth);

  // Height scale: how many world height units = 1 screen row
  const heightScale = 8;

  // Directional light — sun direction rotates slowly
  const sunAngle = (tick * 0.015) % (Math.PI * 2);
  const lightX = Math.cos(sunAngle);
  const lightY = Math.sin(sunAngle);
  const lightZ = 0.7; // sun elevation

  for (const col of columns) {
    const { wx, wy, h, biome, dist } = col;
    // Fog factor: 0 = no fog, 1 = full fog
    const fogT = dist <= fogStart ? 0 : dist >= fogEnd ? 1 : (dist - fogStart) / (fogEnd - fogStart);
    const mat = MATERIALS[biome];

    // Surface normal from height differences
    const hL = getH(terrain, wx-1, wy);
    const hR = getH(terrain, wx+1, wy);
    const hU = getH(terrain, wx, wy-1);
    const hD = getH(terrain, wx, wy+1);
    const nx = (hL - hR) / 32;
    const ny = (hU - hD) / 32;
    const nz = 1;
    const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);

    // Diffuse lighting
    const dot = (nx/nLen * lightX + ny/nLen * lightY + nz/nLen * lightZ);
    const diffuse = Math.max(0.15, Math.min(1, dot * 0.5 + 0.5));

    // Choose colour based on lighting, then apply fog
    let fg: number, bg: number;
    if (diffuse > 0.65) { fg = mat.fgLight; bg = mat.bgLight; }
    else if (diffuse > 0.35) { fg = mat.fgMid; bg = mat.bgDark; }
    else { fg = mat.fgDark; bg = mat.bgDark; }
    // Fog blend — lerp ANSI indices towards fog colour at distance
    if (fogT > 0.1) {
      fg = fogT > 0.8 ? fogColour : fg;
      bg = fogT > 0.6 ? fogColour : bg;
    }

    // Top face height in world units
    const topZ = h / heightScale;

    // Water level — flatten water surfaces
    const waterLevel = 60;
    const isWater = biome === Biome.DEEP_WATER || biome === Biome.WATER;
    const effectiveZ = isWater ? waterLevel / heightScale : topZ;

    // Project the top face of this column
    const topProj = projectPoint(wx, wy, effectiveZ, cam, sw, sh);
    if (topProj.sx >= 0 && topProj.sx < sw && topProj.sy >= 0 && topProj.sy < sh) {
      const idx = topProj.sy * sw + topProj.sx;
      if (topProj.depth > buf[idx].depth) {
        // Select glyph — animated for water, hash-based for others
        let gi: number;
        if (isWater) {
          gi = (tick + wx + wy) % mat.topGlyphs.length;
        } else {
          gi = Math.abs((wx * 7 + wy * 13) % mat.topGlyphs.length);
        }
        buf[idx] = {
          depth: topProj.depth,
          glyph: mat.topGlyphs[gi],
          fg, bg,
          flags: isWater ? 4 : 1,
        };
      }
    }

    // Draw side/cliff faces — the key to the 3D look!
    // For each column, draw vertical side from ground up to top
    if (!isWater) {
      // Check what's "in front" of this column (screen-space)
      // The 3D effect comes from rendering the vertical extent of tall cells
      const groundZ = Math.max(0, Math.min(
        getH(terrain, wx, wy + 1),
        getH(terrain, wx + 1, wy),
        getH(terrain, wx - 1, wy),
        getH(terrain, wx, wy - 1),
      )) / heightScale;

      const visibleHeight = effectiveZ - groundZ;
      if (visibleHeight > 1) {
        const sideSteps = Math.min(8, Math.ceil(visibleHeight / 1.5));
        for (let s = 1; s <= sideSteps; s++) {
          const sideZ = effectiveZ - s * (visibleHeight / sideSteps);
          const sideProj = projectPoint(wx, wy, sideZ, cam, sw, sh);
          if (sideProj.sx >= 0 && sideProj.sx < sw &&
              sideProj.sy >= 0 && sideProj.sy < sh) {
            const sideIdx = sideProj.sy * sw + sideProj.sx;
            if (sideProj.depth > buf[sideIdx].depth) {
              // Side faces are darker — they don't face the sun
              const sideDarkness = 0.4 + (s / sideSteps) * 0.3;
              const sideFg = sideDarkness > 0.5 ? mat.fgDark : mat.fgMid;
              const sideGi = s % mat.sideGlyphs.length;
              buf[sideIdx] = {
                depth: sideProj.depth,
                glyph: mat.sideGlyphs[sideGi],
                fg: sideFg, bg: mat.bgDark,
                flags: 1,
              };
            }
          }
        }
      }
    }
  }

  // Draw player sprite — multi-cell coloured character from asciicker
  const ph = getH(terrain, Math.floor(playerX), Math.floor(playerY));
  const pz = ph / heightScale + 4; // sprite floats above terrain
  const pp = projectPoint(playerX, playerY, pz, cam, sw, sh);
  if (pp.sx >= 0 && pp.sx < sw && pp.sy >= 0 && pp.sy < sh) {
    // Blit the sprite centred on the projected position
    const sprW = PLAYER_SPRITE.w, sprH = PLAYER_SPRITE.h;
    const ox = pp.sx - Math.floor(sprW / 2);
    const oy = pp.sy - Math.floor(sprH / 2);
    for (let sy = 0; sy < sprH; sy++) {
      for (let sx = 0; sx < sprW; sx++) {
        const cell = PLAYER_SPRITE.cells[sy * sprW + sx];
        if (!cell) continue;
        const bx = ox + sx, by = oy + sy;
        if (bx < 0 || bx >= sw || by < 0 || by >= sh) continue;
        const bidx = by * sw + bx;
        buf[bidx] = {
          depth: pp.depth + 100, // always on top
          glyph: cell.ch,
          fg: spriteRgbToAnsi(cell.fg),
          bg: cell.bg[0] === 0 && cell.bg[1] === 0 && cell.bg[2] === 0
            ? buf[bidx].bg // transparent black bg → keep terrain bg
            : spriteRgbToAnsi(cell.bg),
          flags: 2,
        };
      }
    }
    // Draw shadow below player
    const shadowProj = projectPoint(playerX, playerY, ph / heightScale, cam, sw, sh);
    if (shadowProj.sx >= 0 && shadowProj.sx < sw &&
        shadowProj.sy >= 0 && shadowProj.sy < sh) {
      const si = shadowProj.sy * sw + shadowProj.sx;
      if (buf[si].flags !== 2) {
        buf[si] = { ...buf[si], glyph: "◦", fg: grey(3) };
      }
    }
  }

  return buf;
}

// ─── Convert buffer to ANSI string ─────────────────────────

function bufferToAnsi(buf: Sample[], sw: number, sh: number): string {
  const lines: string[] = [];
  for (let y = 0; y < sh; y++) {
    let line = "";
    let lastFg = -1, lastBg = -1;
    for (let x = 0; x < sw; x++) {
      const s = buf[y * sw + x];
      if (s.flags === 0) {
        // Empty — reset and space
        if (lastFg !== -1 || lastBg !== -1) {
          line += "\x1b[0m";
          lastFg = -1; lastBg = -1;
        }
        line += " ";
      } else {
        // Emit ANSI colour codes only when changed
        if (s.fg !== lastFg && s.bg !== lastBg) {
          line += `\x1b[38;5;${s.fg};48;5;${s.bg}m`;
        } else if (s.fg !== lastFg) {
          line += `\x1b[38;5;${s.fg}m`;
        } else if (s.bg !== lastBg) {
          line += `\x1b[48;5;${s.bg}m`;
        }
        lastFg = s.fg;
        lastBg = s.bg;
        line += s.glyph;
      }
    }
    if (lastFg !== -1 || lastBg !== -1) line += "\x1b[0m";
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── Module setup ───────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Asciicker",
    description: "Open the ASCII 3D world explorer",
    menu: [{ category: "applications", order: 170, label: "Asciicker" }],
    palette: { order: 170, label: "Open Asciicker" },
    action: () => openAsciicker(host),
  });
}

function openAsciicker(host: MicroappHost) {
  const win = host.createWindow({ title: "Asciicker", width: 80, height: 32 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  const canvas = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 2,
    style: host.theme().body,
    tags: false,
  });

  const status = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  const sep = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    content: "",
    style: host.theme().body,
    tags: false,
  });

  // World generation
  const worldSeed = Math.floor(Math.random() * 100000);
  const terrain = genTerrain(256, 256, worldSeed);

  // Find grass starting position
  let startX = 128, startY = 128;
  outer: for (let r = 0; r < 30; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const b = getBiome(terrain, 128+dx, 128+dy);
        if (b === Biome.GRASS || b === Biome.SAND) {
          startX = 128 + dx; startY = 128 + dy;
          break outer;
        }
      }
    }
  }

  let playerX = startX, playerY = startY;
  const cam: Camera = {
    x: startX, y: startY, z: getH(terrain, startX, startY) / 8,
    yaw: 45, pitch: 30, zoom: 1.2,
  };
  let tick = 0;
  const keys = new Set<string>();

  function getContentSize() {
    return {
      w: Math.max(8, Number(canvas.width) || 60),
      h: Math.max(4, Number(canvas.height) || 24),
    };
  }

  const biomeNames = ["Deep Water", "Shallows", "Sand", "Grassland", "Forest", "Rock", "Mountain", "Snow"];

  function updateDisplay() {
    const { w, h } = getContentSize();

    // Process movement — screen-relative (W=up-on-screen, inverse-projected)
    // In isometric: screen-up maps to world (-x, -y), screen-right maps to world (+x, -y)
    // rotated by camera yaw
    const speed = 0.5;
    const yr = cam.yaw * Math.PI / 180;
    const cosY = Math.cos(yr), sinY = Math.sin(yr);
    // Screen "up" in world coords (before yaw): moves into the screen = +y in world
    // Screen "right" in world coords: moves +x in world
    // But we need to un-rotate by yaw to get world movement
    const upWX = sinY, upWY = -cosY;    // screen-up → world
    const rtWX = cosY, rtWY = sinY;     // screen-right → world

    if (keys.has("w") || keys.has("up"))    { playerX += upWX*speed; playerY += upWY*speed; }
    if (keys.has("s") || keys.has("down"))  { playerX -= upWX*speed; playerY -= upWY*speed; }
    if (keys.has("d") || keys.has("right")) { playerX += rtWX*speed; playerY += rtWY*speed; }
    if (keys.has("a") || keys.has("left"))  { playerX -= rtWX*speed; playerY -= rtWY*speed; }

    playerX = Math.max(2, Math.min(terrain.w-3, playerX));
    playerY = Math.max(2, Math.min(terrain.h-3, playerY));

    // Smooth camera follow
    const targetZ = getH(terrain, Math.floor(playerX), Math.floor(playerY)) / 8;
    cam.x += (playerX - cam.x) * 0.12;
    cam.y += (playerY - cam.y) * 0.12;
    cam.z += (targetZ - cam.z) * 0.12;

    // Render 3D scene
    const buf = renderScene(terrain, cam, w, h, playerX, playerY, tick);
    const ansi = bufferToAnsi(buf, w, h);
    canvas.setContent(ansi);

    // Separator
    sep.setContent("─".repeat(w));

    // Status bar
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    const biomeName = cell ? biomeNames[cell.biome] : "???";
    const alt = cell ? Math.floor(cell.height / 2.55) : 0;
    const yawStr = `${Math.floor(cam.yaw)}°`;
    status.setContent(
      ` ⊕${Math.floor(playerX)},${Math.floor(playerY)}  ▲${alt}m  ${biomeName}  ` +
      `◎${yawStr}  ×${cam.zoom.toFixed(1)}  ` +
      `WASD:move Q/E:rotate +/-:zoom`
    );

    host.screen.render();
    tick++;
  }

  // Key handling
  const keyHandler = (_ch: string, key: { name?: string } | undefined) => {
    if (!key || !key.name) return;
    const n = key.name.toLowerCase();
    if (n === "q") { cam.yaw = (cam.yaw + 15) % 360; }
    else if (n === "e") { cam.yaw = (cam.yaw + 345) % 360; }
    else if (n === "=") { cam.zoom = Math.min(3, cam.zoom + 0.15); }
    else if (n === "-") { cam.zoom = Math.max(0.4, cam.zoom - 0.15); }
    else if (["w", "a", "s", "d", "up", "down", "left", "right"].includes(n)) {
      keys.add(n);
      setTimeout(() => keys.delete(n), 200);
    }
  };

  host.screen.on("keypress", keyHandler);

  createTimer(() => updateDisplay(), 125, timers);

  win.onResize(() => updateDisplay());

  win.describeState(() => {
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    return {
      summary: `Asciicker — ${Math.floor(playerX)},${Math.floor(playerY)} ${cell ? biomeNames[cell.biome] : ""}`,
      position: { x: Math.floor(playerX), y: Math.floor(playerY) },
      altitude: cell ? Math.floor(cell.height / 2.55) : 0,
      biome: cell ? biomeNames[cell.biome] : "Unknown",
      yaw: Math.floor(cam.yaw),
      zoom: cam.zoom,
      worldSeed,
      worldSize: `${terrain.w}x${terrain.h}`,
      tick,
    };
  });

  win.captureText(() => {
    const cell = terrain.cells[Math.floor(playerY) * terrain.w + Math.floor(playerX)];
    return `Asciicker — pos:${Math.floor(playerX)},${Math.floor(playerY)} alt:${cell ? Math.floor(cell.height / 2.55) : 0}m\n\n${canvas.getContent()}`;
  });

  win.onRestyle(() => {
    const t = host.theme();
    canvas.style = { ...t.body };
    status.style = t.muted ? { fg: t.muted.fg, bg: t.body.bg } : { fg: "grey", bg: t.body.bg };
    sep.style = { ...t.body };
    host.screen.render();
  });

  win.onCleanup(() => {
    host.screen.removeListener("keypress", keyHandler);
    clearTimers(timers);
  });

  win.focus();
}
