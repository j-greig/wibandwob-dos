/**
 * Visualiser modes for the music player window.
 *
 * Each mode implements VizMode — tick() receives audio data,
 * render() produces blessed-tagged text. Add new modes by
 * writing a factory and adding it to VIZ_MODES.
 */

import { clamp } from "../core/ui-parts.js";

export const VIZ_BANDS = 24;

export interface VizColors {
  accent:    string;
  muted:     string;
  highlight: string;
}

export interface VizMode {
  readonly name: string;
  tick(bands: Float32Array, rms: number, playing: boolean): void;
  render(nW: number, nH: number, colors: VizColors): string;
  reset(): void;
}

function fg(color: string, char: string): string {
  return `{${color}-fg}${char}{/${color}-fg}`;
}

// ── Mode 0: BARS — vertical frequency bars ────────────────────────────────

export function createBarsViz(): VizMode {
  const MAX  = VIZ_BANDS;
  const h    = new Float32Array(MAX).fill(0);
  const peak = new Float32Array(MAX).fill(0);
  const PDECAY = 0.025;

  return {
    name: "BARS",
    reset() { h.fill(0); peak.fill(0); },

    tick(bands, _rms, playing) {
      for (let i = 0; i < MAX; i++) {
        if (playing) {
          h[i] = clamp(bands[i]!, 0, 1);
        } else {
          const t = Date.now() / 1200;
          const phase = (t + i * 0.3) % (Math.PI * 2);
          const wave2 = Math.sin(t * 0.7 + i * 0.15);
          h[i] = clamp(Math.sin(phase) * 0.35 + wave2 * 0.15 + 0.35, 0.05, 0.85);
        }
        peak[i] = h[i] > peak[i] ? h[i] : Math.max(0, peak[i] - PDECAY);
      }
    },

    render(nW, nH, c) {
      const nBands = Math.max(4, nW - 1);
      const nRows  = Math.max(1, nH);

      const shadeAt = (rFromBot: number): string => {
        const t = rFromBot / Math.max(1, nRows - 1);
        if (t >= 0.75) return "█";
        if (t >= 0.50) return "▓";
        if (t >= 0.25) return "▒";
        return "░";
      };

      const lines: string[] = [];
      for (let row = 0; row < nRows; row++) {
        const rFromBot  = nRows - 1 - row;
        const threshold = rFromBot / nRows;
        let line = " ";
        for (let b = 0; b < nBands; b++) {
          const bIdx = Math.floor((b / nBands) * MAX);
          const bh   = h[bIdx]!;
          const bp   = peak[bIdx]!;
          const peakRow = nRows - 1 - Math.round(bp * (nRows - 1));
          if (bh > threshold && bh > 0) {
            line += fg(c.accent, shadeAt(rFromBot));
          } else if (row === peakRow && bp > 0.04) {
            line += fg(c.highlight, "▔");
          } else {
            line += " ";
          }
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
  };
}

// ── Mode 1: RINGS — expanding concentric rings ───────────────────────────

export function createRingsViz(): VizMode {
  const rings: { r: number; intensity: number; speed: number }[] = [];
  let prevRms = 0;
  let beatCool = 0;

  return {
    name: "RINGS",
    reset() { rings.length = 0; prevRms = 0; beatCool = 0; },

    tick(_bands, rms, playing) {
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]!;
        ring.r += ring.speed;
        ring.intensity *= 0.96;
        if (ring.intensity < 0.02) rings.splice(i, 1);
      }

      if (playing) {
        const delta = rms - prevRms;
        prevRms = rms;
        beatCool = Math.max(0, beatCool - 1);
        if (delta > 0.08 && rms > 0.15 && beatCool === 0) {
          beatCool = 3;
          rings.push({ r: 0.5, intensity: 0.6 + rms * 0.4, speed: 0.4 + rms * 0.3 });
        } else if (rms > 0.05 && Math.random() < 0.1) {
          rings.push({ r: 0.3, intensity: rms * 0.4, speed: 0.2 });
        }
      } else {
        if (Math.random() < 0.04) {
          rings.push({ r: 0.3, intensity: 0.35 + Math.random() * 0.2, speed: 0.15 + Math.random() * 0.1 });
        }
      }
    },

    render(nW, nH, c) {
      const w = Math.max(4, nW - 1);
      const h = Math.max(2, nH);
      const cx = w / 2, cy = h / 2;
      const aspect = 2.0;
      const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(" "));
      const RING_CHARS = ["·", "∘", "○", "◎", "●"] as const;

      for (const ring of rings) {
        const maxR = Math.max(w, h * aspect);
        if (ring.r > maxR) continue;
        const circumf = Math.max(16, Math.round(ring.r * aspect * 6));
        for (let p = 0; p < circumf; p++) {
          const angle = (p / circumf) * Math.PI * 2;
          const px = Math.round(cx + Math.cos(angle) * ring.r * aspect);
          const py = Math.round(cy + Math.sin(angle) * ring.r);
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          const ci = Math.min(RING_CHARS.length - 1, Math.floor(ring.intensity * RING_CHARS.length));
          const ch = RING_CHARS[ci]!;
          const col = ring.intensity > 0.4 ? c.accent : c.muted;
          grid[py]![px] = fg(col, ch);
        }
      }

      const mcx = Math.round(cx), mcy = Math.round(cy);
      if (mcx >= 0 && mcx < w && mcy >= 0 && mcy < h) {
        grid[mcy]![mcx] = fg(c.highlight, "✦");
      }

      return grid.map(row => " " + row.join("")).join("\n");
    },
  };
}

// ── Mode 2: GRID — pulse field ───────────────────────────────────────────

export function createGridViz(): VizMode {
  let grid: Float32Array | null = null;
  let gW = 0, gH = 0;
  let prevRms    = 0;
  let beatCooldown = 0;

  const HEAT_CHARS = [" ", "·", "░", "▒", "▓", "█"] as const;

  function ensureGrid(w: number, h: number) {
    if (w === gW && h === gH && grid) return;
    gW = w; gH = h;
    grid = new Float32Array(gW * gH).fill(0);
  }

  function spawnCluster(cx: number, cy: number, radius: number, intensity: number) {
    if (!grid) return;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= gW || y < 0 || y >= gH) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const add  = Math.max(0, 1 - dist / radius) * intensity;
        grid[y * gW + x] = Math.min(1, (grid[y * gW + x] ?? 0) + add);
      }
    }
  }

  return {
    name: "GRID",
    reset() { grid = null; gW = 0; gH = 0; prevRms = 0; beatCooldown = 0; },

    tick(bands, rms, playing) {
      if (!grid || gW === 0) return;

      const next = new Float32Array(grid.length);
      for (let y = 0; y < gH; y++) {
        for (let x = 0; x < gW; x++) {
          const i = y * gW + x;
          let sum = 0, n = 0;
          for (const [dy, dx] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < gW && ny >= 0 && ny < gH) { sum += grid[ny * gW + nx]!; n++; }
          }
          next[i] = clamp((grid[i] ?? 0) * 0.84 + (n > 0 ? (sum / n) * 0.08 : 0), 0, 1);
        }
      }
      grid.set(next);

      if (!playing) {
        beatCooldown = Math.max(0, beatCooldown - 1);
        if (Math.random() < 0.08) {
          const cx = 1 + Math.floor(Math.random() * (gW - 2));
          const cy = 1 + Math.floor(Math.random() * (gH - 2));
          spawnCluster(cx, cy, 2 + Math.floor(Math.random() * 3), 0.3 + Math.random() * 0.3);
        }
        return;
      }

      beatCooldown = Math.max(0, beatCooldown - 1);
      const rmsDelta = rms - prevRms;
      prevRms = rms;
      const isBeat = rmsDelta > 0.08 && rms > 0.15 && beatCooldown === 0;

      if (isBeat) {
        beatCooldown = 4;
        const cx = 1 + Math.floor(Math.random() * (gW - 2));
        const cy = 1 + Math.floor(Math.random() * (gH - 2));
        const lowEnergy  = (bands[0]! + bands[1]! + bands[2]!) / 3;
        const highEnergy = (bands[VIZ_BANDS - 3]! + bands[VIZ_BANDS - 2]! + bands[VIZ_BANDS - 1]!) / 3;
        const radius    = 2 + Math.round(lowEnergy * 4);
        const intensity = 0.6 + highEnergy * 0.4;
        spawnCluster(cx, cy, radius, intensity);
      } else if (rms > 0.05 && Math.random() < rms * 0.3) {
        const cx = 1 + Math.floor(Math.random() * (gW - 2));
        const cy = 1 + Math.floor(Math.random() * (gH - 2));
        spawnCluster(cx, cy, 1, rms * 0.5);
      }
    },

    render(nW, nH, c) {
      const w = Math.max(2, nW - 1);
      const h = Math.max(1, nH);
      ensureGrid(w, h);
      if (!grid) return "";

      const lines: string[] = [];
      for (let y = 0; y < h; y++) {
        let line = " ";
        for (let x = 0; x < w; x++) {
          const v  = grid[y * w + x] ?? 0;
          const ci = Math.min(HEAT_CHARS.length - 1, Math.floor(v * HEAT_CHARS.length));
          const ch = HEAT_CHARS[ci]!;
          if      (v < 0.05) line += " ";
          else if (v < 0.35) line += fg(c.muted, ch);
          else               line += fg(c.accent, ch);
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
  };
}

// ── Mode 3: RAIN — ASCII rain / matrix-style ────────────────────────────

export function createRainViz(): VizMode {
  const GLYPHS = "♫♪♬◆◇○●∘∙·:;|!¦╎╏┃┆┇┊┋".split("");
  let drops: { y: number; speed: number; char: string; bright: boolean }[] = [];
  let gW = 0;

  function ensureDrops(w: number) {
    if (w === gW && drops.length > 0) return;
    gW = w;
    drops = Array.from({ length: w }, () => ({
      y: Math.random() * 40,
      speed: 0.2 + Math.random() * 0.3,
      char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!,
      bright: Math.random() < 0.3,
    }));
  }

  return {
    name: "RAIN",
    reset() { drops = []; gW = 0; },

    tick(bands, rms, playing) {
      if (drops.length === 0) return;
      const energy = playing ? rms * 2 + 0.3 : 0.15;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]!;
        const bandIdx = Math.floor((i / drops.length) * VIZ_BANDS);
        const bandE = playing ? (bands[bandIdx] ?? 0) : Math.sin(Date.now() / 1500 + i * 0.2) * 0.3 + 0.3;
        d.speed = 0.1 + bandE * 0.8 + energy * 0.3;
        d.y += d.speed;
        if (Math.random() < 0.02) {
          d.char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
          d.bright = Math.random() < (playing ? rms : 0.2);
        }
      }
    },

    render(nW, nH, c) {
      const w = Math.max(2, nW - 1);
      const h = Math.max(1, nH);
      ensureDrops(w);

      const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(" "));

      for (let col = 0; col < Math.min(w, drops.length); col++) {
        const d = drops[col]!;
        const headY = Math.floor(d.y) % (h + 8);
        const trailLen = 4 + Math.floor(d.speed * 3);
        for (let t = 0; t < trailLen; t++) {
          const row = headY - t;
          if (row < 0 || row >= h) continue;
          if (t === 0) {
            grid[row]![col] = fg(d.bright ? c.highlight : c.accent, d.char);
          } else if (t < 2) {
            grid[row]![col] = fg(c.accent, d.char);
          } else {
            grid[row]![col] = fg(c.muted, t < trailLen - 1 ? "·" : " ");
          }
        }
      }

      return grid.map(row => " " + row.join("")).join("\n");
    },
  };
}

// ── Registry ─────────────────────────────────────────────────────────────

export const VIZ_MODES: VizMode[] = [
  createBarsViz(),
  createRingsViz(),
  createGridViz(),
  createRainViz(),
];
