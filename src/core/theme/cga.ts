import type { ThemeVariant } from "./types.js";

/** Pure CGA 16-colour BIOS palette — classic DOS blue desktop vibes. */
export const cga: ThemeVariant = {
  name: "wibwob-cga",
  tokens: {
    desktop:               { fg: "#55FFFF",  bg: "#0000AA"  },
    desktopFillChar:       "░",
    menuBar:               { fg: "#000000",  bg: "#AAAAAA"  },
    statusLine:            { fg: "#000000",  bg: "#AAAAAA"  },

    windowFrame:           { fg: "#000000",  bg: "#AAAAAA"  },
    windowBorderFocused:   { fg: "#000000",  bg: "#AAAAAA"  },
    windowBorderUnfocused: { fg: "#0000AA",  bg: "#AAAAAA"  },
    titleBarFocused:       { fg: "#000000",  bg: "#00AAAA"  },
    titleBarUnfocused:     { fg: "#AAAAAA",  bg: "#0000AA"  },
    closeButton:           { fg: "#000000",  bg: "#FF5555"  },
    resizeGrip:            { fg: "#555555",  bg: "#AAAAAA"  },
    windowShadow:          { fg: "#555555",  bg: "#000000",  char: "░" },

    body:                  { fg: "#000000",  bg: "#AAAAAA"  },
    bodyAlt:               { fg: "#000000",  bg: "#AAAAAA"  },
    agentBg:               { fg: "#000000",  bg: "#999999"  },
    header:                { fg: "#000000",  bg: "#00AAAA"  },
    footer:                { fg: "#000000",  bg: "#00AAAA"  },

    selected:              { fg: "#FFFFFF",  bg: "#0000AA"  },
    input:                 { fg: "#FFFFFF",  bg: "#0000AA"  },
    scrollbar:             { fg: "#000000",  bg: "#AAAAAA",  track: "#555555" },

    accent:                { fg: "#00AAAA",  bg: "#AAAAAA"  },
    highlight:             { fg: "#AA0000",  bg: "#AAAAAA"  },
    warning:               { fg: "#FFFF55",  bg: "#AAAAAA"  },
    error:                 { fg: "#FF5555",  bg: "#AAAAAA"  },
    success:               { fg: "#55FF55",  bg: "#AAAAAA"  },
    muted:                 { fg: "#555555",  bg: "#AAAAAA"  },
  }
};
