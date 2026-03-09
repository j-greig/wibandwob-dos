import type { ThemeVariant } from "./types.js";

export const dark: ThemeVariant = {
  name: "wibwob-dark",
  tokens: {
    desktop:              { fg: "#422c76", bg: "black" },
    desktopFillChar:      "▒",
    menuBar:              { fg: "white",  bg: "#333333" },
    statusLine:           { fg: "white",  bg: "#333333" },

    windowFrame:          { fg: "white",  bg: "black"   },
    windowBorderFocused:  { fg: "cyan",   bg: "black"   },
    windowBorderUnfocused:{ fg: "white",  bg: "black"   },
    titleBarFocused:      { fg: "black",  bg: "white"   },
    titleBarUnfocused:    { fg: "white",  bg: "#1a1a1a" },
    closeButton:          { fg: "white",  bg: "red"     },
    resizeGrip:           { fg: "yellow", bg: "black"   },
    windowShadow:         { fg: "black", bg: "#333", char: "▒" },

    body:                 { fg: "white",  bg: "black"   },
    bodyAlt:              { fg: "white",  bg: "blue"    },
    agentBg:              { fg: "#c8c8ff", bg: "#0d0d2b" },
    header:               { fg: "black",  bg: "cyan"    },
    footer:               { fg: "black",  bg: "white"   },

    selected:             { fg: "black",  bg: "white"   },
    input:                { fg: "#1a1a1a", bg: "#4a90d9" },
    scrollbar:            { fg: "white",  bg: "black",  track: "grey" },

    accent:               { fg: "cyan",   bg: "black"   },
    highlight:            { fg: "#f07f8f", bg: "black"  },  // warm pink — user labels
    warning:              { fg: "yellow", bg: "black"   },
    error:                { fg: "red",    bg: "black"   },
    success:              { fg: "green",  bg: "black"   },
    muted:                { fg: "grey",   bg: "black"   },
  }
};
