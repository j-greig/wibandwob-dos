/**
 * Theme resolver — runtime theme state and cycle.
 *
 * Import `theme` to get the active token set.
 * Import `toggleTheme` to cycle variants.
 *
 * Public variants live in src/core/theme/variants/.
 * Private variants live in modules-private/wibwob-themes/variants/.
 */

import type { ThemeTokens, ThemeVariant } from "./types.js";

// ── Public themes ──
import { dark } from "./dark.js";
import { darkNord } from "./dark-nord.js";
import { darkPastel } from "./dark-pastel.js";
import { light } from "./light.js";

// ── Private themes (modules-private/wibwob-theme-*) ──
import { phosphor } from "../../../modules-private/wibwob-theme-phosphor/theme.js";

/** All built-in variants in cycle order. */
const VARIANT_CYCLE: ThemeVariant[] = [
  dark,
  darkNord,
  darkPastel,
  phosphor,
  light,
];

let activeVariant: ThemeVariant = dark;

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
  const idx = VARIANT_CYCLE.findIndex(v => v.name === activeVariant.name);
  const next = VARIANT_CYCLE[(idx + 1) % VARIANT_CYCLE.length];
  activeVariant = next;
  return next.name;
}

/** All registered variants. */
export function allVariants(): readonly ThemeVariant[] {
  return VARIANT_CYCLE;
}
