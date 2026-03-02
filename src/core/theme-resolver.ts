/**
 * Compiles semantic theme tokens into concrete blessed-ready styles.
 *
 * Import `theme` from here to get the active token set.
 * Windows and services should use `theme.body`, `theme.header`, etc.
 * instead of inline { fg: "white", bg: "black" } literals.
 */

import type { ThemeTokens, ThemeVariant } from "./theme-types.js";

const WIBWOB_LIGHT: ThemeVariant = {
  name: "wibwob-light",
  tokens: {
    desktop:              { fg: "grey",   bg: "#e0e0e0" },  // light grey desktop
    menuBar:              { fg: "black",  bg: "white"   },  // white bar on grey desktop = visible
    statusLine:           { fg: "black",  bg: "white"   },

    windowFrame:          { fg: "black",  bg: "white"   },
    windowBorderFocused:  { fg: "blue",   bg: "white"   },
    windowBorderUnfocused:{ fg: "grey",   bg: "white"   },
    titleBarFocused:      { fg: "white",  bg: "blue"    },
    titleBarUnfocused:    { fg: "black",  bg: "white"   },
    closeButton:          { fg: "white",  bg: "red"     },
    resizeGrip:           { fg: "blue",   bg: "white"   },

    body:                 { fg: "black",  bg: "white"   },
    bodyAlt:              { fg: "black",  bg: "white"   },
    header:               { fg: "white",  bg: "blue"    },
    footer:               { fg: "white",  bg: "blue"    },

    selected:             { fg: "white",  bg: "blue"    },
    input:                { fg: "white",  bg: "blue"    },
    scrollbar:            { fg: "blue",   bg: "white",  track: "grey" },

    accent:               { fg: "blue",   bg: "white"   },
    warning:              { fg: "red",    bg: "white"   },
    error:                { fg: "red",    bg: "white"   },
    success:              { fg: "green",  bg: "white"   },
    muted:                { fg: "grey",   bg: "white"   },
  }
};

const WIBWOB_DARK: ThemeVariant = {
  name: "wibwob-dark",
  tokens: {
    desktop:              { fg: "#444444", bg: "black"  },  // pure black desktop
    menuBar:              { fg: "white",  bg: "#333333" },  // dark grey bar on black desktop = visible
    statusLine:           { fg: "white",  bg: "#333333" },

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

const WIBWOB_DARK_PASTEL: ThemeVariant = {
  name: "wibwob-dark-pastel",
  tokens: {
    // Dark grey base (Catppuccin Mocha-inspired)
    desktop:              { fg: "#6c7086",  bg: "#1e1e2e"  },  // surface0 on base
    menuBar:              { fg: "#cdd6f4",  bg: "#313244"  },  // text on surface0
    statusLine:           { fg: "#a6adc8",  bg: "#313244"  },  // subtext0 on surface0

    windowFrame:          { fg: "#cdd6f4",  bg: "#1e1e2e"  },
    windowBorderFocused:  { fg: "#cba6f7",  bg: "#1e1e2e"  },  // mauve
    windowBorderUnfocused:{ fg: "#585b70",  bg: "#1e1e2e"  },  // surface2
    titleBarFocused:      { fg: "#1e1e2e",  bg: "#cba6f7"  },  // base on mauve
    titleBarUnfocused:    { fg: "#a6adc8",  bg: "#313244"  },  // subtext0 on surface0
    closeButton:          { fg: "#1e1e2e",  bg: "#f38ba8"  },  // base on red
    resizeGrip:           { fg: "#f9e2af",  bg: "#1e1e2e"  },  // yellow on base

    body:                 { fg: "#cdd6f4",  bg: "#1e1e2e"  },  // text on base
    bodyAlt:              { fg: "#cdd6f4",  bg: "#313244"  },  // text on surface0
    header:               { fg: "#1e1e2e",  bg: "#89b4fa"  },  // base on blue
    footer:               { fg: "#1e1e2e",  bg: "#a6adc8"  },  // base on subtext0

    selected:             { fg: "#1e1e2e",  bg: "#cba6f7"  },  // base on mauve
    input:                { fg: "#cdd6f4",  bg: "#45475a"  },  // text on surface1
    scrollbar:            { fg: "#cba6f7",  bg: "#313244",  track: "#45475a" },

    accent:               { fg: "#89b4fa",  bg: "#1e1e2e"  },  // blue
    warning:              { fg: "#f9e2af",  bg: "#1e1e2e"  },  // yellow
    error:                { fg: "#f38ba8",  bg: "#1e1e2e"  },  // red
    success:              { fg: "#a6e3a1",  bg: "#1e1e2e"  },  // green
    muted:                { fg: "#6c7086",  bg: "#1e1e2e"  },  // overlay0
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

/** Get the built-in dark variant. */
export function builtinDarkVariant(): ThemeVariant {
  return WIBWOB_DARK;
}

/** Get the built-in light variant. */
export function builtinLightVariant(): ThemeVariant {
  return WIBWOB_LIGHT;
}

/** All built-in variants in cycle order. */
const VARIANT_CYCLE: ThemeVariant[] = [WIBWOB_DARK, WIBWOB_DARK_PASTEL, WIBWOB_LIGHT];

/** Cycle to the next theme variant. Returns the new variant name. */
export function toggleTheme(): string {
  const idx = VARIANT_CYCLE.findIndex(v => v.name === activeVariant.name);
  const next = VARIANT_CYCLE[(idx + 1) % VARIANT_CYCLE.length];
  activeVariant = next;
  return next.name;
}

/** Get the built-in dark-pastel variant. */
export function builtinDarkPastelVariant(): ThemeVariant {
  return WIBWOB_DARK_PASTEL;
}
