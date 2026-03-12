import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { REPO_ROOT } from "../core/config.js";
import { measurePlainTextContent, type ContentMeasurement } from "./content-measurement.js";

export interface FigletFontMeta {
  height: number;
  width: number;
}

export interface FigletFontCategory {
  id: string;
  name: string;
  description: string;
  fonts: string[];
}

export interface FigletCatalogue {
  categories: FigletFontCategory[];
  favourites: string[];
  fontMetadata: Record<string, FigletFontMeta>;
  allFontsSorted: string[];
}

let catalogueCache: FigletCatalogue | undefined;
let figletAvailableCache: boolean | undefined;
let figletFontDirCache: string | undefined;

const FALLBACK_FONT = "standard";

function resolveFontJsonPath(): string {
  for (const candidate of [
    path.join(REPO_ROOT, "modules-private", "wibwob-figlet-fonts", "fonts.json"),
    path.join(REPO_ROOT, "modules", "wibwob-figlet-fonts", "fonts.json")
  ]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(REPO_ROOT, "modules", "wibwob-figlet-fonts", "fonts.json");
}

export function getFigletCatalogue(): FigletCatalogue {
  if (catalogueCache) {
    return catalogueCache;
  }

  const raw = fs.readFileSync(resolveFontJsonPath(), "utf8");
  const parsed = JSON.parse(raw) as {
    categories?: Array<{ id?: string; name?: string; description?: string; fonts?: string[] }>;
    favourites?: string[];
    font_metadata?: Record<string, { height?: number; width?: number }>;
  };

  const fontMetadata = Object.fromEntries(
    Object.entries(parsed.font_metadata ?? {}).map(([name, meta]) => [
      name,
      {
        height: Number(meta.height ?? 0),
        width: Number(meta.width ?? 0)
      }
    ])
  );

  catalogueCache = {
    categories: (parsed.categories ?? []).map((category) => ({
      id: category.id ?? "",
      name: category.name ?? "",
      description: category.description ?? "",
      fonts: Array.isArray(category.fonts) ? [...category.fonts] : []
    })),
    favourites: Array.isArray(parsed.favourites) ? [...parsed.favourites] : [],
    fontMetadata,
    allFontsSorted: Object.keys(fontMetadata).sort((a, b) => a.localeCompare(b))
  };

  return catalogueCache;
}

export function getFigletFontChoices(): Array<{ value: string; label: string }> {
  const catalogue = getFigletCatalogue();
  return catalogue.allFontsSorted.map((font) => {
    const meta = catalogue.fontMetadata[font];
    const favourite = catalogue.favourites.includes(font) ? " *" : "";
    return {
      value: font,
      label: `${font}${favourite} (${meta?.height ?? 0}h x ${meta?.width ?? 0}w)`
    };
  });
}

export function getDefaultFigletFont(): string {
  const catalogue = getFigletCatalogue();
  return catalogue.favourites[0] ?? FALLBACK_FONT;
}

export function getFigletFontHeight(font: string): number {
  return getFigletCatalogue().fontMetadata[font]?.height ?? 0;
}

export function isFigletAvailable(): boolean {
  if (typeof figletAvailableCache === "boolean") {
    return figletAvailableCache;
  }
  const result = spawnSync("figlet", ["-v"], { encoding: "utf8" });
  figletAvailableCache = result.status === 0;
  return figletAvailableCache;
}

function getFigletFontDir(): string | undefined {
  if (figletFontDirCache !== undefined) {
    return figletFontDirCache;
  }
  const result = spawnSync("figlet", ["-I2"], { encoding: "utf8" });
  figletFontDirCache = result.status === 0 ? result.stdout.trim() || undefined : undefined;
  return figletFontDirCache;
}

export function renderFiglet(text: string, font = FALLBACK_FONT, width = 0): string {
  if (!text.trim()) {
    return "";
  }
  if (!isFigletAvailable()) {
    return `${text}\n\n(figlet CLI not available on PATH)`;
  }

  const args = [] as string[];
  const fontDir = getFigletFontDir();
  if (fontDir) {
    args.push("-d", fontDir);
  }
  args.push("-f", font);
  if (width > 0) {
    args.push("-w", String(width));
  }
  args.push(text);

  const result = spawnSync("figlet", args, { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    const stderr = result.stderr?.trim();
    return `${text}\n\n(figlet render failed${stderr ? `: ${stderr}` : ""})`;
  }
  return result.stdout.replace(/\s+$/u, "");
}

export function renderFigletLines(text: string, font = FALLBACK_FONT, width = 0): string[] {
  const rendered = renderFiglet(text, font, width);
  return rendered ? rendered.split("\n") : [];
}

export interface FigletMeasurement {
  rendered: string;
  lines: string[];
  measurement: ContentMeasurement;
  fontHeight: number;
}

// ── Width-aware rendering + responsive font cascade ──────────────────────────

const tryFigletCache = new Map<string, string | null>();

/**
 * Render figlet text constrained to a width. Returns null if the output
 * overflows (any line exceeds width) or if the font/CLI fails.
 * Results are cached by (font, width, text) triple.
 */
export function tryFiglet(text: string, font: string, width: number): string | null {
  if (!font || !isFigletAvailable()) return null;
  const key = `${font}\0${width}\0${text}`;
  const cached = tryFigletCache.get(key);
  if (cached !== undefined) return cached;
  const result = spawnSync("figlet", ["-f", font, "-w", String(width), text], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    tryFigletCache.set(key, null);
    return null;
  }
  const output = result.stdout;
  const lines = output.split("\n");
  // Reject if any line exceeds the requested width
  if (lines.some(l => l.replace(/\s+$/, "").length > width)) {
    tryFigletCache.set(key, null);
    return null;
  }
  tryFigletCache.set(key, output);
  return output;
}

/** One tier in a responsive font cascade. */
export interface FontCascadeTier {
  /** Figlet font name. Empty string means plain-text fallback. */
  font: string;
  /** Minimum available width (columns) to attempt this font. */
  minWidth: number;
}

/** Standard cascade: XL -> L -> M -> S -> XS. */
export const DEFAULT_FONT_CASCADE: FontCascadeTier[] = [
  { font: "larry3d",    minWidth: 50 },
  { font: "slant",      minWidth: 42 },
  { font: "small",      minWidth: 30 },
  { font: "smslant",    minWidth: 30 },
  { font: "digital",    minWidth: 24 },
];

/**
 * Pick the best figlet font for the available width and render the text.
 * Tries each tier in the cascade where minWidth <= width. Falls through
 * to plain CAPS + underline if nothing fits.
 */
export function responsiveFiglet(
  text: string,
  width: number,
  cascade: FontCascadeTier[] = DEFAULT_FONT_CASCADE,
): string {
  for (const tier of cascade) {
    if (width >= tier.minWidth && tier.font) {
      const result = tryFiglet(text, tier.font, width);
      if (result) return result;
    }
  }
  // Plain CAPS fallback
  const caps = text.toUpperCase();
  const underline = "=".repeat(Math.min(caps.length, Math.max(1, width)));
  return `\n  ${caps}\n  ${underline}\n`;
}

// ── Measurement ──────────────────────────────────────────────────────────────

export function measureFiglet(text: string, font = FALLBACK_FONT, width = 0): FigletMeasurement {
  const rendered = renderFiglet(text, font, width);
  const lines = rendered ? rendered.split("\n") : [];
  const measurement = measurePlainTextContent(rendered).measurement;
  return {
    rendered,
    lines,
    measurement,
    fontHeight: getFigletFontHeight(font)
  };
}
