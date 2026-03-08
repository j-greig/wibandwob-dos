/**
 * Design Tokens — semantic values derived from the active theme.
 *
 * All SDK components should use these tokens instead of hardcoding colors.
 * Call getTokens(theme) to resolve current values.
 */

import type { ThemeTokens } from "../theme/types.js";

export interface DesignTokens {
  color: {
    fg: string;
    bg: string;
    accent: string;
    muted: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  timing: {
    fast: number;
    normal: number;
    slow: number;
  };
}

export function getTokens(t: ThemeTokens): DesignTokens {
  return {
    color: {
      fg: t.body.fg,
      bg: t.body.bg,
      accent: t.accent.fg,
      muted: t.muted.fg,
      border: t.muted.fg,
      error: t.error.fg,
      success: t.success.fg,
      warning: t.warning.fg,
      info: t.accent.fg,
    },
    spacing: {
      xs: 1,
      sm: 2,
      md: 4,
      lg: 8,
      xl: 16,
    },
    timing: {
      fast: 100,
      normal: 250,
      slow: 500,
    },
  };
}
