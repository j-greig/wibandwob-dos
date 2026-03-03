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

import type { ThemeTokens, ThemeVariant } from "./types.js";

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
export function theme(): ThemeTokens {
  return activeVariant.tokens;
}

/** The current variant name. */
export function themeName(): string {
  return activeVariant.name;
}

/** Switch to a specific variant. */
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
export function allVariants(): readonly ThemeVariant[] {
  return [...BUILTIN_VARIANTS, ...externalVariants];
}

/**
 * Register an external theme variant from a module.
 * Called by module-loader.ts during startup, before workspace restore.
 */
export function registerExternalTheme(variant: ThemeVariant): void {
  // Prevent duplicates — a module reloading should not double-register
  if (externalVariants.some(v => v.name === variant.name)) return;
  externalVariants.push(variant);
}
