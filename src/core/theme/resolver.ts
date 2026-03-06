/**
 * Theme resolver — runtime theme state and cycle.
 *
 * Import `theme` to get the active token set.
 * Import `toggleTheme` to cycle variants.
 *
 * Built-in variants are statically imported below.
 * External variants (from modules/ and modules-private/) are registered
 * at startup via registerExternalTheme(), called by module-loader.ts.
 */

import type { StylePair, ThemeTokens, ThemeVariant } from "./types.js";

// ── Built-in themes ──
import { dark } from "./dark.js";
import { darkNord } from "./dark-nord.js";
import { darkPastel } from "./dark-pastel.js";
import { light } from "./light.js";

/** Built-in variants in cycle order. External variants append after these. */
const BUILTIN_VARIANTS: readonly ThemeVariant[] = [
  dark,
  darkNord,
  darkPastel,
  light,
];

/** External variants registered by module-loader.ts at startup. */
const externalVariants: ThemeVariant[] = [];

let activeVariant: ThemeVariant = dark;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The current active theme tokens. */
/** @primitive */
export function theme(): ThemeTokens {
  return activeVariant.tokens;
}

/** The current variant name. */
/** @primitive */
export function themeName(): string {
  return activeVariant.name;
}

/** Switch to a specific variant. */
/** @primitive */
export function setThemeVariant(variant: ThemeVariant): void {
  activeVariant = variant;
}

/** Cycle to the next theme variant. Returns the new variant name. */
export function toggleTheme(): string {
  const all = allVariants();
  const idx = all.findIndex(v => v.name === activeVariant.name);
  const next = all[(idx + 1) % all.length];
  activeVariant = next;
  return next.name;
}

/** All registered variants (built-in + external). */
/** @primitive */
export function allVariants(): readonly ThemeVariant[] {
  return [...BUILTIN_VARIANTS, ...externalVariants];
}

/**
 * Fill any missing tokens in a theme variant using the dark baseline,
 * with ultimate fallback to plain black/white StylePairs.
 *
 * This makes external/module themes safe to use even if they are incomplete.
 * Missing StylePair tokens fall back to the dark theme value; if dark is also
 * missing for some reason the final fallback is { fg: "white", bg: "black" }.
 */
export function fillThemeTokens(variant: ThemeVariant): ThemeVariant {
  const base = dark.tokens as unknown as Record<string, unknown>;
  const src  = variant.tokens as unknown as Record<string, unknown>;
  const last: StylePair = { fg: "white", bg: "black" };

  const filled: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(src)) {
    if (val !== undefined && val !== null) {
      filled[key] = val;
    }
  }

  // For any key that is a StylePair in the baseline, ensure fg and bg are present.
  for (const key of Object.keys(base)) {
    const baseVal = base[key];
    if (typeof baseVal !== "object" || baseVal === null) continue;
    const bv = baseVal as Record<string, unknown>;
    if (!("fg" in bv && "bg" in bv)) continue;                    // not a StylePair
    const existing = (filled[key] ?? {}) as Record<string, unknown>;
    filled[key] = {
      ...existing,
      fg: typeof existing.fg === "string" ? existing.fg : (typeof bv.fg === "string" ? bv.fg : last.fg),
      bg: typeof existing.bg === "string" ? existing.bg : (typeof bv.bg === "string" ? bv.bg : last.bg),
    };
  }

  return { ...variant, tokens: filled as unknown as ThemeTokens };
}

/**
 * Register an external theme variant from a module.
 * Called by module-loader.ts during startup, before workspace restore.
 * Missing tokens are filled from the dark baseline so incomplete themes
 * never cause runtime errors.
 * @primitive
 */
export function registerExternalTheme(variant: ThemeVariant): void {
  // Prevent duplicates — a module reloading should not double-register
  if (externalVariants.some(v => v.name === variant.name)) return;
  externalVariants.push(fillThemeTokens(variant));
}
