import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTextViewer,
  createHeaderBar,
  createStatusBar,
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";

// ═══════════════════════════════════════════════════════════════
// STARFIELD — 3D warp-speed star simulation
//
// Stars are distributed across a unit sphere and projected onto
// screen using perspective divide. Z advances each frame — when
// a star reaches z≥1 it wraps back to the far horizon.
//
// Depth → character density:  ·  +  *  ✦  ★
// Depth → ANSI colour:        dim → white → yellow → cyan
// Fast stars leave motion trails (─ ╌) to imply streaking.
// ═══════════════════════════════════════════════════════════════

const NUM_STARS = 280;
const BASE_SPEED = 0.006;
const FPS = 8;

// ─── ANSI primitives ─────────────────────────────────────────
const R = "\x1b[0m";          // reset
const DIM = "\x1b[90m";       // dark grey — far stars
const GRAY = "\x1b[37m";      // grey — mid distance
const WHITE = "\x1b[97m";     // bright white — near
const YELLOW = "\x1b[93m";    // yellow — very close
const CYAN = "\x1b[96m";      // cyan — streaking by
const BOLD = "\x1b[1m";

// ─── Star data ───────────────────────────────────────────────
interface Star {
  nx: number;  // normalised direction -1..1 (screen x at z=1)
  ny: number;  // normalised direction -1..1 (screen y at z=1)
  z: number;   // 0 = horizon, 1 = in-your-face
  phase: number; // flicker phase offset
  // previous projected screen pos (for trails)
  prevSx: number;
  prevSy: number;
}

function makeStar(zOverride?: number): Star {
  return {
    nx: (Math.random() * 2 - 1),
    ny: (Math.random() * 2 - 1),
    z: zOverride ?? Math.random(),
    phase: Math.random() * Math.PI * 2,
    prevSx: -1,
    prevSy: -1,
  };
}

// ─── Depth → visual ──────────────────────────────────────────
function depthChar(z: number, tick: number, phase: number): string {
  // Very close stars flicker between ✦ ★ for excitement
  if (z > 0.88) {
    return (Math.sin(tick * 1.5 + phase) > 0) ? "★" : "✦";
  }
  if (z > 0.70) return "✦";
  if (z > 0.50) return "*";
  if (z > 0.30) return "+";
  if (z > 0.12) return "·";
  return ".";
}

function depthAnsi(z: number): string {
  if (z > 0.88) return BOLD + CYAN;
  if (z > 0.70) return BOLD + YELLOW;
  if (z > 0.50) return WHITE;
  if (z > 0.30) return GRAY;
  return DIM;
}

// ─── Warp factor labels ───────────────────────────────────────
const WARP_LABEL = ["IMPULSE", "WARP 1", "WARP 2", "WARP 3", "WARP 4",
                    "WARP 5", "WARP 6", "WARP 7", "WARP 8", "WARP 9"];
const WARP_BANNER = [
  "⟨ DRIFT ⟩",
  "⟨ WARP  1 ⟩",
  "⟨ WARP  2 ⟩",
  "⟨ WARP  3 ⟩",
  "⟨ WARP  4 ⟩",
  "⟨ WARP  5 ⟩",
  "⟨ WARP  6 ⟩",
  "⟨ WARP  7 ⟩",
  "⟨ WARP  8 ⟩",
  "⟨ WARP  9 ⟩",
];

// ─── Setup ───────────────────────────────────────────────────
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Starfield",
    description: "Launch 3D warp-speed starfield. ↑↓ change speed, r reset.",
    action: () => openStarfield(),
    palette: { order: 85, label: "✦ Starfield — warp simulation" },
    menu: [{ category: "applications", order: 85, label: "✦ Starfield" }],
    direct: true,
  });

  function openStarfield() {
    const win = host.createWindow({ title: "✦ STARFIELD", width: 92, height: 36 });
    const timers = new Set<ReturnType<typeof setInterval>>();

    const header = createHeaderBar(win.body, {
      left: "✦ STARFIELD",
      right: WARP_BANNER[1],
    });
    const viewer = createTextViewer(win.body, { top: 1, bottom: 1, wrap: false });
    const status = createStatusBar(win.body, {
      left: "↑ warp+  ↓ warp-  r reset  (focus window first)",
      right: "0 ly traveled",
    });

    // ── State ──
    const stars: Star[] = Array.from({ length: NUM_STARS }, () => makeStar());
    let warp = 1;
    let speed = BASE_SPEED * warp;
    let distance = 0;
    let tick = 0;
    let paused = false;

    // ── Render ──
    const render = () => {
      const w = Math.max(20, Number(viewer.element.width) || 80);
      const h = Math.max(5, Number(viewer.element.height) || 26);
      const cx = w / 2;
      const cy = h / 2;

      // char grid — starts as spaces
      const cells: string[] = new Array(w * h).fill(" ");
      const styled: string[] = new Array(w * h).fill("");

      // Sort back-to-front so near stars paint over far ones
      const sorted = [...stars].sort((a, b) => a.z - b.z);

      for (const star of sorted) {
        if (star.z <= 0.001) continue;

        // Perspective projection
        const persp = 1 / star.z;
        const sx = Math.round(cx + star.nx * persp * cx * 0.88);
        const sy = Math.round(cy + star.ny * persp * cy * 0.85);

        // Motion trail — draw the previous position as a fade trail
        if (warp >= 4 && star.z > 0.6 && star.prevSx >= 0 && star.prevSx < w && star.prevSy >= 0 && star.prevSy < h) {
          const ti = star.prevSy * w + star.prevSx;
          if (ti >= 0 && ti < cells.length) {
            const trailChar = (warp >= 7) ? "╌" : "─";
            cells[ti] = trailChar;
            styled[ti] = DIM;
          }
        }

        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const i = sy * w + sx;
          cells[i] = depthChar(star.z, tick, star.phase);
          styled[i] = depthAnsi(star.z);
          star.prevSx = sx;
          star.prevSy = sy;
        } else {
          star.prevSx = -1;
          star.prevSy = -1;
        }
      }

      // Draw crosshair pip at exact center (navigational reference)
      const midX = Math.floor(cx);
      const midY = Math.floor(cy);
      const midI = midY * w + midX;
      if (cells[midI] === " ") {
        cells[midI] = "·";
        styled[midI] = DIM;
      }

      // Build output string — run-length compress plain spaces
      const rows: string[] = [];
      for (let y = 0; y < h; y++) {
        let row = "";
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const ch = cells[i];
          const col = styled[i];
          if (col) {
            row += col + ch + R;
          } else {
            row += ch;
          }
        }
        rows.push(row);
      }

      viewer.update({ content: rows.join("\n") });

      // ── Advance stars ──
      for (const star of stars) {
        // Accelerate as they get closer (parallax effect)
        star.z += speed * (0.6 + star.z * 1.8);

        if (star.z >= 1) {
          const ns = makeStar(0);
          star.nx = ns.nx;
          star.ny = ns.ny;
          star.z = 0;
          star.phase = ns.phase;
          star.prevSx = -1;
          star.prevSy = -1;
        }
      }

      distance += speed * 120;
      tick++;

      // Distance label
      const ly = distance > 9999
        ? `${(distance / 1000).toFixed(1)}k ly`
        : `${Math.floor(distance)} ly`;

      status.update({ right: `${ly} traveled` });
      header.update({ left: "✦ STARFIELD", right: WARP_BANNER[warp] });

      host.screen.render();
    };

    // ── Key handlers ──
    const setWarp = (w: number) => {
      warp = Math.max(0, Math.min(9, w));
      speed = BASE_SPEED * (warp === 0 ? 0.15 : warp);
      status.update({
        left: `↑ warp+  ↓ warp-  r reset  p pause${paused ? "  [PAUSED]" : ""}`,
        right: "",
      });
      host.flash(`${WARP_LABEL[warp]}`);
    };

    viewer.element.key(["up"], () => setWarp(warp + 1));
    viewer.element.key(["down"], () => setWarp(warp - 1));
    viewer.element.key(["p"], () => {
      paused = !paused;
      status.update({
        left: `↑ warp+  ↓ warp-  r reset  p pause${paused ? "  ⏸ PAUSED" : ""}`,
        right: "",
      });
      if (paused) {
        clearTimers(timers);
      } else {
        createTimer(render, Math.round(1000 / FPS), timers);
      }
      host.screen.render();
    });
    viewer.element.key(["r"], () => {
      stars.length = 0;
      for (let i = 0; i < NUM_STARS; i++) stars.push(makeStar());
      distance = 0;
      tick = 0;
      host.flash("Starfield reset — new sector");
    });

    // COAT: register commands so agents can drive warp
    host.registerCommand({
      id: "warp-up",
      label: "Starfield: Increase Warp",
      action: () => setWarp(warp + 1),
    });
    host.registerCommand({
      id: "warp-down",
      label: "Starfield: Decrease Warp",
      action: () => setWarp(warp - 1),
    });
    host.registerCommand({
      id: "reset",
      label: "Starfield: Reset Sector",
      action: () => {
        stars.length = 0;
        for (let i = 0; i < NUM_STARS; i++) stars.push(makeStar());
        distance = 0; tick = 0;
      },
    });

    // ── SDK hooks ──
    win.describeState(() => ({
      summary: `Starfield — ${WARP_LABEL[warp]}, ${Math.floor(distance)} light-years traveled`,
      warp,
      speedFactor: speed,
      distanceLy: Math.floor(distance),
      starCount: NUM_STARS,
      tick,
      paused,
    }));

    win.captureText(() =>
      viewer.getContent() ||
      `Starfield — ${NUM_STARS} stars, ${WARP_LABEL[warp]}, ${Math.floor(distance)} ly traveled`
    );

    win.onRestyle(() => {
      header.update({});
      status.update({});
      host.screen.render();
    });

    win.onCleanup(() => clearTimers(timers));

    win.setFocusTarget(viewer.element);
    win.focus();

    // Initial render + start loop
    render();
    createTimer(render, Math.round(1000 / FPS), timers);
  }
}
