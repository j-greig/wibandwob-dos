/**
 * Global appearance mode selection.
 *
 * Supports system/light/dark modes. Currently resolves to dark always
 * (light variant not yet defined). Future: detect system preference,
 * broadcast changes so open windows can restyle.
 */

import type { AppearanceMode } from "./theme/types.js";
import { setThemeVariant } from "./theme/resolver.js";
import { dark } from "./theme/dark.js";

let currentMode: AppearanceMode = "dark";

export function getAppearanceMode(): AppearanceMode {
  return currentMode;
}

export function setAppearanceMode(mode: AppearanceMode): void {
  currentMode = mode;
  // Future: resolve system preference, select light/dark variant, broadcast
  // For now, always use dark
  setThemeVariant(dark);
}
