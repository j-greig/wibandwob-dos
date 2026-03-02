/**
 * Compiles semantic theme tokens into concrete blessed-ready styles.
 *
 * Import `theme` from here to get the active token set.
 * Windows and services should use `theme.body`, `theme.header`, etc.
 * instead of inline { fg: "white", bg: "black" } literals.
 */

import type { ThemeTokens, ThemeVariant } from "./theme-types.js";

const WIBWOB_DARK: ThemeVariant = {
  name: "wibwob-dark",
  tokens: {
    desktop:              { fg: "black",  bg: "white"   },
    menuBar:              { fg: "black",  bg: "white"   },
    statusLine:           { fg: "black",  bg: "white"   },

    windowFrame:          { fg: "white",  bg: "black"   },
    windowBorderFocused:  { fg: "cyan",   bg: "black"   },
    windowBorderUnfocused:{ fg: "white",  bg: "black"   },
    titleBarFocused:      { fg: "black",  bg: "white"   },
    titleBarUnfocused:    { fg: "white",  bg: "black"   },
    closeButton:          { fg: "white",  bg: "red"     },
    resizeGrip:           { fg: "yellow", bg: "black"   },

    body:                 { fg: "white",  bg: "black"   },
    bodyAlt:              { fg: "white",  bg: "blue"    },
    header:               { fg: "black",  bg: "cyan"    },
    footer:               { fg: "black",  bg: "white"   },

    selected:             { fg: "black",  bg: "white"   },
    input:                { fg: "white",  bg: "blue"    },
    scrollbar:            { fg: "white",  bg: "black",  track: "grey" },

    accent:               { fg: "cyan",   bg: "black"   },
    warning:              { fg: "yellow", bg: "black"   },
    error:                { fg: "red",    bg: "black"   },
    success:              { fg: "green",  bg: "black"   },
    muted:                { fg: "grey",   bg: "black"   },
  }
};

let activeVariant: ThemeVariant = WIBWOB_DARK;

/** The current active theme tokens. */
export function theme(): ThemeTokens {
  return activeVariant.tokens;
}

/** The current variant name. */
export function themeName(): string {
  return activeVariant.name;
}

/** Switch to a different variant. */
export function setThemeVariant(variant: ThemeVariant): void {
  activeVariant = variant;
}

/** Get the built-in dark variant (useful as a reset). */
export function builtinDarkVariant(): ThemeVariant {
  return WIBWOB_DARK;
}
