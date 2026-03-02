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

// ── Nord-inspired: muted steel blues, calm and professional ──
const WIBWOB_DARK_NORD: ThemeVariant = {
  name: "wibwob-dark-nord",
  tokens: {
    desktop:              { fg: "#4c566a",  bg: "#2e3440"  },  // nord1 on nord0
    menuBar:              { fg: "#d8dee9",  bg: "#3b4252"  },  // nord4 on nord1
    statusLine:           { fg: "#d8dee9",  bg: "#3b4252"  },

    windowFrame:          { fg: "#d8dee9",  bg: "#2e3440"  },
    windowBorderFocused:  { fg: "#88c0d0",  bg: "#2e3440"  },  // nord8 frost
    windowBorderUnfocused:{ fg: "#4c566a",  bg: "#2e3440"  },  // nord3
    titleBarFocused:      { fg: "#2e3440",  bg: "#88c0d0"  },  // nord0 on frost
    titleBarUnfocused:    { fg: "#d8dee9",  bg: "#3b4252"  },
    closeButton:          { fg: "#2e3440",  bg: "#bf616a"  },  // nord11 red
    resizeGrip:           { fg: "#ebcb8b",  bg: "#2e3440"  },  // nord13 yellow

    body:                 { fg: "#d8dee9",  bg: "#2e3440"  },
    bodyAlt:              { fg: "#d8dee9",  bg: "#3b4252"  },
    header:               { fg: "#2e3440",  bg: "#5e81ac"  },  // nord0 on nord10
    footer:               { fg: "#2e3440",  bg: "#4c566a"  },  // nord0 on nord3

    selected:             { fg: "#2e3440",  bg: "#88c0d0"  },  // nord0 on frost
    input:                { fg: "#eceff4",  bg: "#434c5e"  },  // nord6 on nord2
    scrollbar:            { fg: "#88c0d0",  bg: "#3b4252",  track: "#434c5e" },

    accent:               { fg: "#88c0d0",  bg: "#2e3440"  },  // nord8
    warning:              { fg: "#ebcb8b",  bg: "#2e3440"  },  // nord13
    error:                { fg: "#bf616a",  bg: "#2e3440"  },  // nord11
    success:              { fg: "#a3be8c",  bg: "#2e3440"  },  // nord14
    muted:                { fg: "#4c566a",  bg: "#2e3440"  },  // nord3
  }
};

// ── CRT Phosphor: retro amber/green terminal, maximum nostalgia ──
const WIBWOB_PHOSPHOR: ThemeVariant = {
  name: "wibwob-phosphor",
  tokens: {
    desktop:              { fg: "#1a1100",  bg: "#0a0800"  },  // near-black warm
    menuBar:              { fg: "#ffb000",  bg: "#1a1100"  },  // amber on dark
    statusLine:           { fg: "#ffb000",  bg: "#1a1100"  },

    windowFrame:          { fg: "#ffb000",  bg: "#0a0800"  },
    windowBorderFocused:  { fg: "#ffdd00",  bg: "#0a0800"  },  // bright amber
    windowBorderUnfocused:{ fg: "#664400",  bg: "#0a0800"  },  // dim amber
    titleBarFocused:      { fg: "#0a0800",  bg: "#ffb000"  },  // black on amber
    titleBarUnfocused:    { fg: "#ffb000",  bg: "#1a1100"  },
    closeButton:          { fg: "#0a0800",  bg: "#ff4400"  },  // black on hot orange
    resizeGrip:           { fg: "#ffdd00",  bg: "#0a0800"  },

    body:                 { fg: "#ffb000",  bg: "#0a0800"  },  // amber on black
    bodyAlt:              { fg: "#ffb000",  bg: "#1a1100"  },
    header:               { fg: "#0a0800",  bg: "#ff8800"  },  // black on orange
    footer:               { fg: "#0a0800",  bg: "#996600"  },  // black on brown

    selected:             { fg: "#0a0800",  bg: "#ffdd00"  },  // black on bright
    input:                { fg: "#ffdd00",  bg: "#1a1100"  },  // bright on dark
    scrollbar:            { fg: "#ffb000",  bg: "#1a1100",  track: "#332200" },

    accent:               { fg: "#ffdd00",  bg: "#0a0800"  },
    warning:              { fg: "#ff8800",  bg: "#0a0800"  },
    error:                { fg: "#ff4400",  bg: "#0a0800"  },
    success:              { fg: "#44ff00",  bg: "#0a0800"  },  // phosphor green!
    muted:                { fg: "#664400",  bg: "#0a0800"  },
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
const VARIANT_CYCLE: ThemeVariant[] = [
  WIBWOB_DARK,
  WIBWOB_DARK_NORD,
  WIBWOB_DARK_PASTEL,
  WIBWOB_PHOSPHOR,
  WIBWOB_LIGHT,
];

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
