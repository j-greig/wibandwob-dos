#!/usr/bin/env bun
/**
 * Layout Composer — generate explicit batch_layout ops from vibe + content.
 *
 * Replaces static layout tokens with content-aware, compositionally-driven
 * window placement. Three axes: density, temperature, font-scale.
 *
 * Usage (standalone test):
 *   bun run scripts/layout-composer.ts --density 3 --primers starry-sky.txt,synth-face.txt
 *
 * Usage (from timeline):
 *   import { composeLayout } from "./layout-composer.js"
 */

import path from "node:path";

const API = process.env.WIBWOB_API ?? "http://127.0.0.1:8099";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Density  = 0 | 1 | 2 | 3 | 4 | 5;
export type Temperature = "cold" | "warming" | "hot" | "dissolving";
export type FontScale = "none" | "whisper" | "speak" | "shout";

export interface PrimerSpec {
  file: string;       // filename only — resolved via primer-info
  role: string;       // "hero" | "supporting" | "texture" | "corner"
}

export interface FigletSpec {
  text: string;
  scale: FontScale;
  font?: string;
}

export interface LayoutInput {
  density: Density;
  temperature: Temperature;
  primers: PrimerSpec[];
  figlet?: FigletSpec;
  desktop: { w: number; h: number };
}

export interface WindowPlacement {
  type: "primer" | "figlet";
  file?: string;
  text?: string;
  font?: string;
  role: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ComposedLayout {
  theme: string;
  placements: WindowPlacement[];
}

// ---------------------------------------------------------------------------
// Theme from temperature
// ---------------------------------------------------------------------------

const THEME_MAP: Record<Temperature, string> = {
  cold:       "wibwob-dark",
  warming:    "wibwob-dark-nord",
  hot:        "wibwob-dark-pastel",
  dissolving: "wibwob-dark",
};

// ---------------------------------------------------------------------------
// Figlet font + size from scale
// ---------------------------------------------------------------------------

const FIGLET_FONTS: Record<FontScale, { font: string; approxW: number; approxH: number }> = {
  none:    { font: "",        approxW: 0,  approxH: 0 },
  whisper: { font: "small",   approxW: 24, approxH: 5 },
  speak:   { font: "standard",approxW: 48, approxH: 8 },
  shout:   { font: "banner",  approxW: 96, approxH: 8 },
};

// ---------------------------------------------------------------------------
// Primer info from API
// ---------------------------------------------------------------------------

async function getPrimerInfo(filename: string): Promise<{
  w: number; h: number; path: string
}> {
  try {
    const resp = await fetch(`${API}/content/primer-info?path=${encodeURIComponent(filename)}`);
    const data = await resp.json() as Record<string, unknown>;
    return {
      w: (data.recommended_w as number) ?? 60,
      h: (data.recommended_h as number) ?? 20,
      path: (data.path as string) ?? filename,
    };
  } catch {
    return { w: 60, h: 20, path: filename };
  }
}

// ---------------------------------------------------------------------------
// Composition engine
// ---------------------------------------------------------------------------

/**
 * Golden ratio split of available width.
 * Returns [largeW, smallW] where large ≈ 61.8% of total.
 */
function goldenSplit(total: number): [number, number] {
  const large = Math.round(total * 0.618);
  return [large, total - large];
}

/**
 * Compose window placements for the given layout input.
 * All coordinates are content-sized and explicitly positioned.
 * No layout tokens — every pixel is intentional.
 */
export async function composeLayout(input: LayoutInput): Promise<ComposedLayout> {
  const { density, temperature, primers, figlet, desktop } = input;
  const theme = THEME_MAP[temperature];
  const placements: WindowPlacement[] = [];

  // Usable desktop area (inset menu bar + status bar)
  const TOP = 1;
  const BOTTOM = 1;
  const usableH = desktop.h - TOP - BOTTOM;
  const usableW = desktop.w;

  if (density === 0) {
    // Silence. Nothing.
    return { theme, placements: [] };
  }

  // Resolve primer dimensions from API
  const resolved = await Promise.all(
    primers.slice(0, density).map(async (p) => {
      const info = await getPrimerInfo(p.file);
      return { ...p, ...info };
    })
  );

  // ── density 1: single hero, off-centre, breathing room ──────────────────

  if (density === 1 && resolved[0]) {
    const p = resolved[0];
    const w = Math.min(p.w, usableW - 4);
    const h = Math.min(p.h, usableH - 2);
    // Off-centre: 38% from left (inverse golden)
    const x = Math.round(usableW * 0.38) - Math.round(w / 2);
    const y = TOP + Math.round((usableH - h) * 0.38);
    placements.push({ type: "primer", file: p.path, role: p.role, x, y, w, h });
  }

  // ── density 2: hero + supporting, asymmetric pair ───────────────────────

  else if (density === 2 && resolved.length >= 1) {
    const hero = resolved[0];
    const support = resolved[1];

    const [heroW] = goldenSplit(usableW - 2);
    const hW = Math.min(hero.w, heroW);
    const hH = Math.min(hero.h, usableH - 2);
    placements.push({
      type: "primer", file: hero.path, role: "hero",
      x: 2, y: TOP + 1, w: hW, h: hH,
    });

    if (support) {
      const sW = Math.min(support.w, usableW - hW - 4);
      const sH = Math.min(support.h, Math.round(usableH * 0.55));
      // Stagger: support sits lower, not top-aligned
      const sY = TOP + Math.round(usableH * 0.3);
      placements.push({
        type: "primer", file: support.path, role: "supporting",
        x: hW + 4, y: sY, w: sW, h: sH,
      });
    }
  }

  // ── density 3: hero + two smaller, triangular composition ───────────────

  else if (density === 3 && resolved.length >= 1) {
    const hero = resolved[0];
    const [heroW] = goldenSplit(usableW - 2);
    const hW = Math.min(hero.w, heroW);
    const hH = Math.min(hero.h, usableH - 2);
    placements.push({
      type: "primer", file: hero.path, role: "hero",
      x: 2, y: TOP + 1, w: hW, h: hH,
    });

    const rightX = hW + 4;
    const rightW = usableW - hW - 6;

    if (resolved[1]) {
      const p = resolved[1];
      const w = Math.min(p.w, rightW);
      const h = Math.min(p.h, Math.round(usableH * 0.4));
      placements.push({
        type: "primer", file: p.path, role: "supporting",
        x: rightX, y: TOP + 2, w, h,
      });
    }

    if (resolved[2]) {
      const p = resolved[2];
      const w = Math.min(p.w, rightW);
      const h = Math.min(p.h, Math.round(usableH * 0.4));
      // Stagger vertically — not aligned with the one above
      const yOffset = TOP + Math.round(usableH * 0.45);
      placements.push({
        type: "primer", file: p.path, role: "corner",
        x: rightX + Math.round(rightW * 0.1), y: yOffset, w, h,
      });
    }
  }

  // ── density 4-5: complex stack, deliberate chaos ─────────────────────────

  else if (density >= 4) {
    const hero = resolved[0];
    const [heroW] = goldenSplit(usableW - 2);
    const hW = Math.min(hero.w, heroW);
    const hH = Math.min(hero.h, usableH - 4);
    placements.push({
      type: "primer", file: hero.path, role: "hero",
      x: 2, y: TOP + 1, w: hW, h: hH,
    });

    // Scatter supporting windows with deliberate offsets
    const offsets = [
      { xFrac: 0.62, yFrac: 0.05 },
      { xFrac: 0.68, yFrac: 0.42 },
      { xFrac: 0.42, yFrac: 0.58 },
      { xFrac: 0.75, yFrac: 0.25 },
    ];

    resolved.slice(1, density).forEach((p, i) => {
      const off = offsets[i % offsets.length];
      const w = Math.min(p.w, Math.round(usableW * 0.32));
      const h = Math.min(p.h, Math.round(usableH * 0.38));
      const x = Math.min(Math.round(usableW * off.xFrac), usableW - w - 2);
      const y = TOP + Math.min(Math.round(usableH * off.yFrac), usableH - h - 2);
      placements.push({
        type: "primer", file: p.path, role: i === 0 ? "supporting" : "texture",
        x, y, w, h,
      });
    });
  }

  // ── figlet overlay ────────────────────────────────────────────────────────

  if (figlet && figlet.scale !== "none") {
    const spec = FIGLET_FONTS[figlet.scale];
    const w = Math.min(spec.approxW + 4, usableW - 4);
    const h = spec.approxH + 4;
    const font = figlet.font ?? spec.font;

    // Position: shout = top-centre, speak = top-right, whisper = bottom-left
    let x: number, y: number;
    if (figlet.scale === "shout") {
      x = Math.round((usableW - w) / 2);
      y = TOP + 1;
    } else if (figlet.scale === "speak") {
      x = usableW - w - 3;
      y = TOP + 2;
    } else {
      x = 3;
      y = TOP + usableH - h - 2;
    }

    placements.push({ type: "figlet", text: figlet.text, font, role: "figlet", x, y, w, h });
  }

  return { theme, placements };
}

// ---------------------------------------------------------------------------
// CLI test mode
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  // Get desktop size from running app
  let desktopW = 362, desktopH = 80;
  try {
    const resp = await fetch(`${API}/state`);
    const state = await resp.json() as Record<string, unknown>;
    const app = state.app as Record<string, number>;
    desktopW = app.desktopWidth ?? desktopW;
    desktopH = app.desktopHeight ?? desktopH;
  } catch { /* use defaults */ }

  const density = parseInt(getArg("--density") ?? "2") as Density;
  const temp = (getArg("--temperature") ?? "cold") as Temperature;
  const primerFiles = (getArg("--primers") ?? "starry-sky.txt").split(",");
  const figletText = getArg("--figlet");
  const figletScale = (getArg("--scale") ?? "none") as FontScale;

  const input: LayoutInput = {
    density,
    temperature: temp,
    desktop: { w: desktopW, h: desktopH },
    primers: primerFiles.map((f, i) => ({
      file: f.trim(),
      role: i === 0 ? "hero" : i === 1 ? "supporting" : "texture",
    })),
    figlet: figletText ? { text: figletText, scale: figletScale } : undefined,
  };

  console.log(`\nLayout Composer — desktop:${desktopW}x${desktopH} density:${density} temp:${temp}`);
  const layout = await composeLayout(input);
  console.log(`\nTheme: ${layout.theme}`);
  console.log("\nPlacements:");
  for (const p of layout.placements) {
    console.log(`  [${p.role}] ${p.type === "primer" ? p.file : `figlet:"${p.text}"`}`);
    console.log(`    ${p.w}x${p.h} @ ${p.x},${p.y}`);
  }

  // Optionally apply to running app
  if (args.includes("--apply")) {
    console.log("\nApplying to running app...");

    // Set theme
    await fetch(`${API}/commands/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "theme.set", args: { name: layout.theme } }),
    });

    // Close non-agent windows
    const stateResp = await fetch(`${API}/state`);
    const state = await stateResp.json() as Record<string, unknown>;
    const windows = (state.windows as Array<Record<string, unknown>>) ?? [];
    for (const w of windows) {
      if (w.appType !== "wibwob-agent") {
        await fetch(`${API}/windows/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: w.id }),
        });
      }
    }

    // Open and position each placement
    const opened: Array<{ id: number; placement: WindowPlacement }> = [];
    for (const p of layout.placements) {
      let newId: number | undefined;
      if (p.type === "primer") {
        const r = await fetch(`${API}/view/primer/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: p.file }),
        });
        const data = await r.json() as Record<string, unknown>;
        newId = data.id as number;
      } else if (p.type === "figlet") {
        const r = await fetch(`${API}/commands/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "figlet.open", args: { text: p.text, font: p.font } }),
        });
        const data = await r.json() as Record<string, unknown>;
        newId = data.id as number;
      }
      if (newId) {
        opened.push({ id: newId, placement: p });
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Batch move/resize all at once
    if (opened.length > 0) {
      await fetch(`${API}/windows/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ops: opened.map(({ id, placement: p }) => ({
            id, x: p.x, y: p.y, w: p.w, h: p.h,
          })),
        }),
      });
      console.log(`Applied ${opened.length} windows.`);
    }
  }
}
