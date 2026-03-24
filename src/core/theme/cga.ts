import type { ThemeVariant } from "./types.js";

/**
 * Pure CGA 16-colour BIOS palette — D-Flat / Norton Commander DOS aesthetic.
 *
 * Reference: wwdos-dossy.png (D-Flat MemoPad screenshot)
 * Key insight: window BODIES are blue (#0000AA), not grey.
 * Light grey (#AAAAAA) appears in the menu bar, unfocused titles, and buttons.
 * Desktop dither = grey (#AAAAAA) pixels alternating on blue (#0000AA) bg.
 */
export const cga: ThemeVariant = {
  name: "wibwob-cga",
  tokens: {
    // Desktop — blue bg, grey dither fg (matches the 1px brick alternating pattern)
    desktop:               { fg: "#AAAAAA",  bg: "#0000AA"  },
    desktopFillChar:       "░",

    // Menu bar — light grey bg, black text, red hotkeys via accent
    menuBar:               { fg: "#000000",  bg: "#AAAAAA"  },
    statusLine:            { fg: "#000000",  bg: "#00AAAA"  },

    // Window chrome
    windowFrame:           { fg: "#AAAAAA",  bg: "#0000AA"  },
    windowBorderFocused:   { fg: "#00AAAA",  bg: "#0000AA"  },
    windowBorderUnfocused: { fg: "#AAAAAA",  bg: "#0000AA"  },
    titleBarFocused:       { fg: "#0000AA",  bg: "#00AAAA"  },  // blue text on cyan
    titleBarUnfocused:     { fg: "#000000",  bg: "#AAAAAA"  },  // black text on grey
    closeButton:           { fg: "#AAAAAA",  bg: "#AA0000"  },  // dark red, not light red
    resizeGrip:            { fg: "#00AAAA",  bg: "#0000AA"  },
    windowShadow:          { fg: "#000000",  bg: "#000000",  char: "░" },

    // Content — bodies are BLUE, text is light grey
    body:                  { fg: "#AAAAAA",  bg: "#0000AA"  },
    bodyAlt:               { fg: "#AAAAAA",  bg: "#0000AA"  },
    agentBg:               { fg: "#55FFFF",  bg: "#0000AA"  },  // light cyan on blue
    header:                { fg: "#0000AA",  bg: "#00AAAA"  },  // blue on cyan
    footer:                { fg: "#0000AA",  bg: "#00AAAA"  },

    // Interactive — buttons/selections use grey (the "light" surface)
    selected:              { fg: "#000000",  bg: "#AAAAAA"  },  // black on grey (button style)
    input:                 { fg: "#AAAAAA",  bg: "#0000AA"  },
    scrollbar:             { fg: "#00AAAA",  bg: "#0000AA",  track: "#000055" },

    // Semantic
    accent:                { fg: "#AA0000",  bg: "#AAAAAA"  },  // dark red — menu hotkeys
    highlight:             { fg: "#FFFF55",  bg: "#0000AA"  },  // yellow on blue
    warning:               { fg: "#FFFF55",  bg: "#0000AA"  },
    error:                 { fg: "#FF5555",  bg: "#0000AA"  },  // light red on blue
    success:               { fg: "#55FF55",  bg: "#0000AA"  },
    muted:                 { fg: "#555555",  bg: "#0000AA"  },
  }
};
