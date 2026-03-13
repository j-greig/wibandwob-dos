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
// Reimplemented in TypeScript for WibWob-DOS blessed TUI.
//
// Heightmap terrain rendered with isometric projection.
// Back-to-front painter's algorithm with height offset.
// Procedural terrain with biomes, water, vegetation.
// WASD movement, Q/E yaw rotation, +/- zoom.
// ═══════════════════════════════════════════════════════════════

// ─── Terrain biome types ────────────────────────────────────

const enum Biome {
  DEEP_WATER = 0,
  SHALLOW_WATER = 1,
  SAND = 2,
  GRASS = 3,
  FOREST = 4,
  STONE = 5,
  MOUNTAIN = 6,
  SNOW = 7,
}

// ─── Biome visual definitions ───────────────────────────────

interface BiomeStyle {
  glyphs: string[];       // characters to use
  topFg: string;          // top face colour
  sideFg: string;         // side face colour
  darkFg: string;         // shadow colour
  animated?: boolean;     // cycles glyphs over time
}

const BIOME_STYLES: Record<Biome, BiomeStyle> = {
  [Biome.DEEP_WATER]: {
    glyphs: ["≈", "~", "∽", "≋"],
    topFg: "#1565c0", sideFg: "#0d47a1", darkFg: "#0a2e6b",
    animated: true,
  },
  [Biome.SHALLOW_WATER]: {
    glyphs: ["~", "∼", "≈", "˜"],
    topFg: "#42a5f5", sideFg: "#1e88e5", darkFg: "#1565c0",
    animated: true,
  },
  [Biome.SAND]: {
    glyphs: [".", "·", "∙", ","],
    topFg: "#fdd835", sideFg: "#f9a825", darkFg: "#c6a700",
  },
  [Biome.GRASS]: {
    glyphs: [".", ";", ",", "'", "\"", "`"],
    topFg: "#66bb6a", sideFg: "#43a047", darkFg: "#2e7d32",
  },
  [Biome.FOREST]: {
    glyphs: ["♣", "♠", "▲", "△", "⌂", "♧"],
    topFg: "#2e7d32", sideFg: "#1b5e20", darkFg: "#0d3b0f",
  },
  [Biome.STONE]: {
    glyphs: ["#", "▒", "░", "▓", "∎"],
    topFg: "#9e9e9e", sideFg: "#757575", darkFg: "#424242",
  },
  [Biome.MOUNTAIN]: {
    glyphs: ["▲", "△", "▴", "◮", "⏶"],
    topFg: "#78909c", sideFg: "#546e7a", darkFg: "#37474f",
  },
  [Biome.SNOW]: {
    glyphs: ["*", "·", "∘", "°", "⁎"],
    topFg: "#eceff1", sideFg: "#cfd8dc", darkFg: "#b0bec5",
  },
};

// Side/cliff face glyphs
const SIDE_GLYPHS = ["▌", "▐", "█", "▓", "▒"];
// Player character
const PLAYER_CHAR = "@";
const PLAYER_FG = "#ffeb3b";

// ─── Noise function ─────────────────────────────────────────

// Simple value noise with cubic interpolation
function hash2d(x: number, y: number, seed: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  // Cubic interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = hash2d(ix, iy, seed);
  const b = hash2d(ix + 1, iy, seed);
  const c = hash2d(ix, iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);

  return a + sx * (b - a) + sy * (c - a) + sx * sy * (a - b - c + d);
}

function fractalNoise(x: number, y: number, seed: number, octaves: number): number {
  let val = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 100) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxAmp;
}

// ─── Terrain generation ─────────────────────────────────────

interface TerrainCell {
  height: number;   // 0-255
  biome: Biome;
  moisture: number;  // 0-1
}

interface Terrain {
  width: number;
  height: number;
  cells: TerrainCell[];
  seed: number;
}

function generateTerrain(w: number, h: number, seed: number): Terrain {
  const cells: TerrainCell[] = new Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Height from fractal noise
      const rawHeight = fractalNoise(x * 0.02, y * 0.02, seed, 6);
      // Add some ridges
      const ridge = 1 - Math.abs(fractalNoise(x * 0.015, y * 0.015, seed + 500, 4) * 2 - 1);
      const combined = rawHeight * 0.7 + ridge * 0.3;
      const height = Math.floor(combined * 255);

      // Moisture from separate noise field
      const moisture = fractalNoise(x * 0.025, y * 0.025, seed + 1000, 4);

      // Biome based on height + moisture
      let biome: Biome;
      if (height < 50) biome = Biome.DEEP_WATER;
      else if (height < 65) biome = Biome.SHALLOW_WATER;
      else if (height < 75) biome = Biome.SAND;
      else if (height < 140) {
        biome = moisture > 0.55 ? Biome.FOREST : Biome.GRASS;
      }
      else if (height < 190) biome = Biome.STONE;
      else if (height < 220) biome = Biome.MOUNTAIN;
      else biome = Biome.SNOW;

      cells[y * w + x] = { height, biome, moisture };
    }
  }

  return { width: w, height: h, cells, seed };
}

function getCell(t: Terrain, x: number, y: number): TerrainCell | null {
  if (x < 0 || x >= t.width || y < 0 || y >= t.height) return null;
  return t.cells[y * t.width + x];
}

// ─── Camera and projection ──────────────────────────────────

interface Camera {
  x: number;  // world position
  y: number;
  yaw: number;  // 0-3 (4 directions: N, E, S, W)
  zoom: number; // 1-4
}

// Project world (wx, wy, wz) to screen (sx, sy) given camera
function project(
  wx: number, wy: number, wz: number,
  cam: Camera, screenW: number, screenH: number,
): { sx: number; sy: number } | null {
  // Relative to camera
  let rx = wx - cam.x;
  let ry = wy - cam.y;

  // Rotate by yaw
  const yawRad = (cam.yaw * Math.PI) / 2;
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  const rotX = rx * cos - ry * sin;
  const rotY = rx * sin + ry * cos;

  // Isometric projection
  // x maps to screen x, y maps to screen y (with depth)
  const isoX = (rotX - rotY) * cam.zoom;
  const isoY = (rotX + rotY) * 0.5 * cam.zoom - wz * 0.15 * cam.zoom;

  const sx = Math.round(screenW / 2 + isoX);
  const sy = Math.round(screenH / 2 + isoY);

  if (sx < 0 || sx >= screenW || sy < 0 || sy >= screenH) return null;
  return { sx, sy };
}

// ─── Renderer ───────────────────────────────────────────────

interface RenderCell {
  char: string;
  fg: string;
  depth: number;  // for z-sorting
}

function renderScene(
  terrain: Terrain,
  cam: Camera,
  screenW: number,
  screenH: number,
  playerX: number,
  playerY: number,
  tick: number,
): string {
  // Screen buffer — each cell tracks char + depth
  const buf: (RenderCell | null)[] = new Array(screenW * screenH).fill(null);

  // Determine visible range based on camera zoom
  const viewRange = Math.floor(20 / cam.zoom) + 8;

  // Collect cells to render with their depth
  const renderList: {
    wx: number; wy: number;
    cell: TerrainCell;
  }[] = [];

  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const wx = Math.floor(cam.x) + dx;
      const wy = Math.floor(cam.y) + dy;
      const cell = getCell(terrain, wx, wy);
      if (!cell) continue;
      renderList.push({ wx, wy, cell });
    }
  }

  // Sort back-to-front based on camera yaw
  // Depth = distance from camera in the "into screen" direction
  const yawRad = (cam.yaw * Math.PI) / 2;
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);

  renderList.sort((a, b) => {
    const da = (a.wx - cam.x) * sinY + (a.wy - cam.y) * cosY;
    const db = (b.wx - cam.x) * sinY + (b.wy - cam.y) * cosY;
    return db - da; // back to front
  });

  // Render each cell
  for (const { wx, wy, cell } of renderList) {
    const worldZ = cell.height / 16; // scale height to visual units
    const biomeStyle = BIOME_STYLES[cell.biome];

    // Project top face
    const topProj = project(wx, wy, worldZ, cam, screenW, screenH);
    if (!topProj) continue;

    // Check neighbours for side face rendering
    const heightScale = cell.height / 16;

    // Determine glyph
    let glyph: string;
    if (biomeStyle.animated) {
      glyph = biomeStyle.glyphs[(tick + wx + wy) % biomeStyle.glyphs.length];
    } else {
      // Use position-based hash for stable variety
      const gi = Math.abs((wx * 7 + wy * 13 + cell.height) % biomeStyle.glyphs.length);
      glyph = biomeStyle.glyphs[gi];
    }

    // Light direction based on time (simple sun angle)
    const sunAngle = (tick * 0.02) % (Math.PI * 2);
    const lightX = Math.cos(sunAngle);
    const lightY = Math.sin(sunAngle);

    // Surface normal approximation — check height differences
    const leftCell = getCell(terrain, wx - 1, wy);
    const rightCell = getCell(terrain, wx + 1, wy);
    const upCell = getCell(terrain, wx, wy - 1);
    const downCell = getCell(terrain, wx, wy + 1);

    const dzdx = ((rightCell?.height ?? cell.height) - (leftCell?.height ?? cell.height)) / 2;
    const dzdy = ((downCell?.height ?? cell.height) - (upCell?.height ?? cell.height)) / 2;

    // Simple diffuse lighting
    const normalDot = -(dzdx * lightX + dzdy * lightY) * 0.01;
    const lightLevel = Math.max(0, Math.min(1, 0.5 + normalDot));

    // Choose colour based on light level
    let fg: string;
    if (lightLevel > 0.6) fg = biomeStyle.topFg;
    else if (lightLevel > 0.3) fg = biomeStyle.sideFg;
    else fg = biomeStyle.darkFg;

    // Depth for this cell
    const depth = (wx - cam.x) * sinY + (wy - cam.y) * cosY + heightScale * 0.1;

    // Draw top face
    const idx = topProj.sy * screenW + topProj.sx;
    const existing = buf[idx];
    if (!existing || depth <= existing.depth) {
      buf[idx] = { char: glyph, fg, depth };
    }

    // Draw side/cliff faces — render cells below the top
    // If this cell is significantly higher than what's in front,
    // draw vertical side faces
    const frontCell = getCell(terrain, wx, wy + 1);
    const heightDiff = cell.height - (frontCell?.height ?? 0);
    if (heightDiff > 20) {
      const sideSteps = Math.min(3, Math.floor(heightDiff / 30));
      for (let s = 1; s <= sideSteps; s++) {
        const sideZ = worldZ - s * 0.8;
        const sideProj = project(wx, wy, sideZ, cam, screenW, screenH);
        if (sideProj) {
          const sideIdx = sideProj.sy * screenW + sideProj.sx;
          const sideExisting = buf[sideIdx];
          const sideDepth = depth - s * 0.01;
          if (!sideExisting || sideDepth <= sideExisting.depth) {
            const sideGlyph = SIDE_GLYPHS[s % SIDE_GLYPHS.length];
            buf[sideIdx] = { char: sideGlyph, fg: biomeStyle.sideFg, depth: sideDepth };
          }
        }
      }
    }
  }

  // Draw player
  const playerCell = getCell(terrain, Math.floor(playerX), Math.floor(playerY));
  const playerZ = (playerCell?.height ?? 0) / 16 + 0.5;
  const playerProj = project(playerX, playerY, playerZ, cam, screenW, screenH);
  if (playerProj) {
    const pidx = playerProj.sy * screenW + playerProj.sx;
    buf[pidx] = { char: PLAYER_CHAR, fg: PLAYER_FG, depth: -Infinity };
  }

  // Convert buffer to string — single colour mode (blessed limitation)
  // We use the most common fg colour for the overall style
  const lines: string[] = [];
  for (let y = 0; y < screenH; y++) {
    let line = "";
    for (let x = 0; x < screenW; x++) {
      const cell = buf[y * screenW + x];
      line += cell ? cell.char : " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── Dominant colour extraction ─────────────────────────────

function getDominantColour(
  terrain: Terrain, cam: Camera, screenW: number, screenH: number,
): string {
  // Sample a few cells near camera to determine dominant biome colour
  const cx = Math.floor(cam.x), cy = Math.floor(cam.y);
  const counts = new Map<Biome, number>();
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const cell = getCell(terrain, cx + dx, cy + dy);
      if (cell) counts.set(cell.biome, (counts.get(cell.biome) ?? 0) + 1);
    }
  }
  let maxBiome = Biome.GRASS, maxCount = 0;
  for (const [b, c] of counts) {
    if (c > maxCount) { maxBiome = b; maxCount = c; }
  }
  return BIOME_STYLES[maxBiome].topFg;
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

  // Canvas for the 3D view
  const canvas = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 2,
    style: host.theme().body,
    tags: false,
  });

  // Status bar
  const status = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });

  // Separator
  const sep = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    content: "",
    style: host.theme().body,
    tags: false,
  });

  // Generate world
  const worldSeed = Math.floor(Math.random() * 100000);
  const terrain = generateTerrain(256, 256, worldSeed);

  // Find a good starting position (on grass, not water)
  let startX = 128, startY = 128;
  for (let r = 0; r < 30; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const cell = getCell(terrain, 128 + dx, 128 + dy);
        if (cell && (cell.biome === Biome.GRASS || cell.biome === Biome.SAND)) {
          startX = 128 + dx;
          startY = 128 + dy;
          r = 30; // break outer
          break;
        }
      }
    }
  }

  // Player and camera state
  let playerX = startX;
  let playerY = startY;
  const cam: Camera = { x: startX, y: startY, yaw: 0, zoom: 1.5 };
  let tick = 0;

  // Movement state
  const keys = new Set<string>();

  function getContentSize() {
    return {
      w: Math.max(8, Number(canvas.width) || 60),
      h: Math.max(4, Number(canvas.height) || 24),
    };
  }

  function getBiomeName(b: Biome): string {
    const names = ["Deep Water", "Shallows", "Sand", "Grassland", "Forest", "Stone", "Mountain", "Snow"];
    return names[b] ?? "Unknown";
  }

  function updateDisplay() {
    const { w, h } = getContentSize();

    // Process movement
    const speed = 0.5;
    const yawRad = (cam.yaw * Math.PI) / 2;
    const fwdX = Math.sin(yawRad);
    const fwdY = Math.cos(yawRad);

    if (keys.has("w") || keys.has("up")) {
      playerX += fwdX * speed;
      playerY += fwdY * speed;
    }
    if (keys.has("s") || keys.has("down")) {
      playerX -= fwdX * speed;
      playerY -= fwdY * speed;
    }
    if (keys.has("a") || keys.has("left")) {
      playerX -= fwdY * speed;
      playerY += fwdX * speed;
    }
    if (keys.has("d") || keys.has("right")) {
      playerX += fwdY * speed;
      playerY -= fwdX * speed;
    }

    // Clamp to world
    playerX = Math.max(2, Math.min(terrain.width - 3, playerX));
    playerY = Math.max(2, Math.min(terrain.height - 3, playerY));

    // Smooth camera follow
    cam.x += (playerX - cam.x) * 0.15;
    cam.y += (playerY - cam.y) * 0.15;

    // Render scene
    const rendered = renderScene(terrain, cam, w, h, playerX, playerY, tick);
    const colour = getDominantColour(terrain, cam, w, h);

    canvas.setContent(rendered);
    canvas.style = { fg: colour, bg: host.theme().body.bg };

    // Separator
    sep.setContent("─".repeat(w));
    sep.style = { fg: colour, bg: host.theme().body.bg };

    // Status bar
    const cell = getCell(terrain, Math.floor(playerX), Math.floor(playerY));
    const biomeName = cell ? getBiomeName(cell.biome) : "???";
    const alt = cell ? Math.floor(cell.height / 2.55) : 0;
    const yawNames = ["N", "E", "S", "W"];
    status.setContent(
      ` ${Math.floor(playerX)},${Math.floor(playerY)}  alt:${alt}m  ${biomeName}  ` +
      `yaw:${yawNames[cam.yaw % 4]}  zoom:${cam.zoom.toFixed(1)}  ` +
      `seed:${worldSeed}  WASD:move Q/E:rotate +/-:zoom`
    );

    host.screen.render();
    tick++;
  }

  // Key handling
  const keyHandler = (_ch: string, key: { name: string }) => {
    if (!key) return;
    const n = key.name.toLowerCase();

    if (n === "q") {
      cam.yaw = (cam.yaw + 3) % 4; // rotate left
    } else if (n === "e") {
      cam.yaw = (cam.yaw + 1) % 4; // rotate right
    } else if (n === "=") {
      cam.zoom = Math.min(4, cam.zoom + 0.25);
    } else if (n === "-") {
      cam.zoom = Math.max(0.5, cam.zoom - 0.25);
    } else if (["w", "a", "s", "d", "up", "down", "left", "right"].includes(n)) {
      keys.add(n);
      // Auto-release after 200ms (blessed doesn't always fire keyup)
      setTimeout(() => keys.delete(n), 200);
    }
  };

  // Use screen-level key handler since blessed box doesn't have reliable keypress
  host.screen.on("keypress", keyHandler);

  // Animation loop — 8fps
  createTimer(() => updateDisplay(), 125, timers);

  win.onResize(() => updateDisplay());

  win.describeState(() => {
    const cell = getCell(terrain, Math.floor(playerX), Math.floor(playerY));
    return {
      summary: `Asciicker — ${Math.floor(playerX)},${Math.floor(playerY)} ${cell ? getBiomeName(cell.biome) : ""}`,
      position: { x: Math.floor(playerX), y: Math.floor(playerY) },
      altitude: cell ? Math.floor(cell.height / 2.55) : 0,
      biome: cell ? getBiomeName(cell.biome) : "Unknown",
      yaw: ["North", "East", "South", "West"][cam.yaw % 4],
      zoom: cam.zoom,
      worldSeed: worldSeed,
      worldSize: `${terrain.width}x${terrain.height}`,
      generation: tick,
    };
  });

  win.captureText(() => {
    const cell = getCell(terrain, Math.floor(playerX), Math.floor(playerY));
    const header = `Asciicker — pos:${Math.floor(playerX)},${Math.floor(playerY)} alt:${cell ? Math.floor(cell.height / 2.55) : 0}m ${cell ? getBiomeName(cell.biome) : ""}`;
    return `${header}\n\n${canvas.getContent()}`;
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
