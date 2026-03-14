// ─── Isometric renderer ─────────────────────────────────────
// Projects city grid into screen space with depth sorting.
import { type Camera, rgb6, grey, hash2d } from "./types.js";
import { type City, type CityCell, Tile, getCell } from "./city.js";
import type { NPC } from "./npcs.js";

interface RCell {
  depth: number; ch: string; fg: number; bg: number; flags: number;
}

const SIN30 = 0.5, COS30 = 0.866;

function proj(
  wx: number, wy: number, wz: number,
  cam: Camera, sw: number, sh: number,
): { sx: number; sy: number; depth: number } {
  const rx = wx - cam.x, ry = wy - cam.y, rz = wz - cam.z;
  const yr = cam.yaw * Math.PI / 180;
  const cosY = Math.cos(yr), sinY = Math.sin(yr);
  const tx = rx * cosY - ry * sinY;
  const ty = rx * sinY + ry * cosY;
  const s = cam.zoom * 2;
  return {
    sx: Math.round(sw / 2 + tx * s),
    sy: Math.round(sh / 2 - ty * SIN30 * s - rz * COS30 * s),
    depth: ty,
  };
}

// Tile visuals — Glasgow palette
const NIGHT_SKY = rgb6(0, 0, 1);
const SODIUM_FG = rgb6(5, 4, 1);  // streetlight orange
const SODIUM_BG = rgb6(3, 2, 0);
const CHIP_GLOW = rgb6(5, 5, 2);

function tileVisual(
  cell: CityCell, wx: number, wy: number, tick: number, isNight: boolean,
): { ch: string; fg: number; bg: number } {
  const r = hash2d(wx * 7, wy * 13, 42);
  const litFactor = cell.lit && isNight;

  switch (cell.tile) {
    case Tile.STREET:
      return { ch: r < 0.3 ? "·" : " ", fg: grey(6), bg: grey(2) };
    case Tile.PAVEMENT:
      return {
        ch: r < 0.2 ? "░" : "·",
        fg: litFactor ? SODIUM_FG : grey(10),
        bg: litFactor ? rgb6(2, 1, 0) : grey(4),
      };
    case Tile.CLOSE:
      return { ch: "▒", fg: grey(6), bg: grey(2) };
    case Tile.BACK_COURT:
      return { ch: r < 0.3 ? "," : ".", fg: rgb6(0, 2, 0), bg: rgb6(0, 1, 0) };
    case Tile.TENEMENT: {
      const windowRow = (wy % 2 === 0);
      const hasWindow = windowRow && r > 0.4;
      const windowLit = hasWindow && hash2d(wx, wy, 99) > 0.5;
      if (hasWindow) {
        return {
          ch: "▪", fg: windowLit ? rgb6(5, 4, 1) : grey(4),
          bg: rgb6(2, 1, 1),
        };
      }
      return {
        ch: r < 0.3 ? "▓" : "█",
        fg: rgb6(3, 2, 1), bg: rgb6(2, 1, 1),
      };
    }
    case Tile.CHIP_SHOP:
      return {
        ch: (tick % 4 < 2) ? "░" : "▒",
        fg: CHIP_GLOW, bg: rgb6(4, 3, 0),
      };
    case Tile.WALL:
      return { ch: "█", fg: grey(8), bg: grey(4) };
    case Tile.BIN:
      return { ch: "▣", fg: grey(6), bg: grey(3) };
    case Tile.PUDDLE: {
      const ripple = (tick + wx + wy) % 6;
      return {
        ch: ripple < 2 ? "~" : ripple < 4 ? "∼" : "≈",
        fg: litFactor ? rgb6(3, 3, 1) : rgb6(1, 1, 3),
        bg: litFactor ? rgb6(1, 1, 0) : rgb6(0, 0, 2),
      };
    }
    case Tile.GRASS_PATCH:
      return { ch: r < 0.5 ? ";" : ",", fg: rgb6(0, 3, 0), bg: rgb6(0, 1, 0) };
    case Tile.ROOF:
      return { ch: "▬", fg: grey(8), bg: grey(5) };
    default:
      return { ch: " ", fg: 0, bg: 0 };
  }
}

export function renderCity(
  city: City, cam: Camera, sw: number, sh: number,
  playerX: number, playerY: number, playerZ: number,
  tick: number, isNight: boolean, npcs: NPC[], raining: boolean,
): string {
  // Create buffer
  const buf: RCell[] = new Array(sw * sh);
  const skyBg = isNight ? NIGHT_SKY : rgb6(2, 3, 4);
  const skyFg = isNight ? grey(8) : rgb6(3, 4, 5);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = { depth: -Infinity, ch: " ", fg: skyFg, bg: skyBg, flags: 0 };
  }

  const viewRange = Math.floor(16 / cam.zoom) + 8;
  const cx = Math.floor(cam.x), cy = Math.floor(cam.y);

  // Collect and depth-sort columns
  type Col = { wx: number; wy: number; cell: CityCell; depth: number };
  const cols: Col[] = [];
  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const wx = cx + dx, wy = cy + dy;
      const cell = getCell(city, wx, wy);
      const yr = cam.yaw * Math.PI / 180;
      const d = (wx - cam.x) * Math.sin(yr) + (wy - cam.y) * Math.cos(yr);
      cols.push({ wx, wy, cell, depth: d });
    }
  }
  cols.sort((a, b) => b.depth - a.depth);

  // Render terrain + buildings
  for (const { wx, wy, cell, depth } of cols) {
    const vis = tileVisual(cell, wx, wy, tick, isNight);
    const topZ = cell.height * 1.5;
    const p = proj(wx, wy, topZ, cam, sw, sh);

    // Top face — 2-wide block
    for (let px = 0; px < 2; px++) {
      const bx = p.sx + px;
      if (bx < 0 || bx >= sw || p.sy < 0 || p.sy >= sh) continue;
      const idx = p.sy * sw + bx;
      if (depth > buf[idx].depth) {
        buf[idx] = { depth, ch: vis.ch, fg: vis.fg, bg: vis.bg, flags: 1 };
      }
    }

    // Side faces for buildings — vertical extent
    if (cell.height > 0) {
      const steps = Math.min(8, cell.height);
      for (let s = 1; s <= steps; s++) {
        const sz = topZ - s * 1.5;
        const sp = proj(wx, wy, sz, cam, sw, sh);
        const darkness = 0.3 + (s / steps) * 0.4;
        const sideFg = darkness > 0.5 ? grey(4) : grey(7);
        const sideBg = grey(2);
        for (let px = 0; px < 2; px++) {
          const bx = sp.sx + px;
          if (bx < 0 || bx >= sw || sp.sy < 0 || sp.sy >= sh) continue;
          const idx = sp.sy * sw + bx;
          if (depth > buf[idx].depth) {
            buf[idx] = {
              depth, ch: s % 2 === 0 ? "▓" : "█",
              fg: sideFg, bg: sideBg, flags: 1,
            };
          }
        }
      }
    }
  }

  // Streetlights — tall posts with glow
  if (isNight) {
    for (const lt of city.lights) {
      const dx = lt.x - cam.x, dy = lt.y - cam.y;
      if (Math.sqrt(dx * dx + dy * dy) > viewRange) continue;
      const lp = proj(lt.x, lt.y, 4, cam, sw, sh);
      if (lp.sx >= 0 && lp.sx < sw && lp.sy >= 0 && lp.sy < sh) {
        buf[lp.sy * sw + lp.sx] = {
          depth: lp.depth + 50, ch: "☼", fg: SODIUM_FG, bg: SODIUM_BG, flags: 2,
        };
      }
      // Post
      for (let pz = 0; pz < 3; pz++) {
        const pp = proj(lt.x, lt.y, pz + 0.5, cam, sw, sh);
        if (pp.sx >= 0 && pp.sx < sw && pp.sy >= 0 && pp.sy < sh) {
          const pi = pp.sy * sw + pp.sx;
          if (lp.depth > buf[pi].depth) {
            buf[pi] = { depth: lp.depth, ch: "│", fg: grey(10), bg: buf[pi].bg, flags: 2 };
          }
        }
      }
    }
  }

  // NPCs
  for (const npc of npcs) {
    const ndx = npc.x - cam.x, ndy = npc.y - cam.y;
    if (Math.sqrt(ndx * ndx + ndy * ndy) > viewRange) continue;
    const ch = getCell(city, Math.floor(npc.x), Math.floor(npc.y));
    const nz = ch.height * 1.5 + 1;
    const np = proj(npc.x, npc.y, nz, cam, sw, sh);
    const yr = cam.yaw * Math.PI / 180;
    const nd = ndx * Math.sin(yr) + ndy * Math.cos(yr);
    for (let px = 0; px < 2; px++) {
      const bx = np.sx + px;
      if (bx < 0 || bx >= sw || np.sy < 0 || np.sy >= sh) continue;
      const idx = np.sy * sw + bx;
      if (nd > buf[idx].depth) {
        buf[idx] = { depth: nd, ch: npc.ch, fg: npc.fg, bg: buf[idx].bg, flags: 2 };
      }
    }
  }

  // Cat (player) — always on top
  const ph = getCell(city, Math.floor(playerX), Math.floor(playerY)).height;
  const pz = ph * 1.5 + 1;
  const pp = proj(playerX, playerY, pz, cam, sw, sh);
  if (pp.sx >= 1 && pp.sx < sw - 1 && pp.sy >= 0 && pp.sy < sh) {
    // 3-char cat sprite: ears, body, tail
    const catParts = [
      { dx: -1, ch: "/", fg: grey(18) },
      { dx: 0, ch: "ᓚ", fg: grey(20) },
      { dx: 1, ch: "~", fg: grey(16) },
    ];
    for (const part of catParts) {
      const bx = pp.sx + part.dx;
      if (bx >= 0 && bx < sw) {
        buf[pp.sy * sw + bx] = {
          depth: pp.depth + 100, ch: part.ch, fg: part.fg,
          bg: buf[pp.sy * sw + bx].bg, flags: 2,
        };
      }
    }
  }

  // Rain overlay
  if (raining) {
    const drops = isNight ? 30 : 20;
    for (let i = 0; i < drops; i++) {
      const rx = Math.floor(hash2d(tick * 5 + i, i * 19, 33) * sw);
      const ry = Math.floor(hash2d(i * 23, tick * 3, 44) * sh);
      if (rx >= 0 && rx < sw && ry >= 0 && ry < sh) {
        const idx = ry * sw + rx;
        buf[idx] = { ...buf[idx], ch: "│", fg: rgb6(2, 3, 5) };
      }
    }
  }

  // Stars at night in empty sky
  if (isNight) {
    for (let y = 0; y < sh * 0.3; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = y * sw + x;
        if (buf[idx].flags === 0 && hash2d(x * 17, y * 31, 77) < 0.008) {
          buf[idx] = { ...buf[idx], ch: "✦", fg: grey(20) };
        }
      }
    }
  }

  return bufToAnsi(buf, sw, sh);
}

function bufToAnsi(buf: RCell[], sw: number, sh: number): string {
  const lines: string[] = [];
  for (let y = 0; y < sh; y++) {
    let line = "", lastFg = -1, lastBg = -1;
    for (let x = 0; x < sw; x++) {
      const c = buf[y * sw + x];
      if (c.fg !== lastFg && c.bg !== lastBg) {
        line += `\x1b[38;5;${c.fg};48;5;${c.bg}m`;
      } else if (c.fg !== lastFg) {
        line += `\x1b[38;5;${c.fg}m`;
      } else if (c.bg !== lastBg) {
        line += `\x1b[48;5;${c.bg}m`;
      }
      lastFg = c.fg; lastBg = c.bg;
      line += c.ch;
    }
    lines.push(line);
  }
  return lines.join("\n") + "\x1b[0m";
}
