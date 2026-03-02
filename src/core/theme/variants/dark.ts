import type { ThemeVariant } from "../types.js";

export const dark: ThemeVariant = {
  name: "wibwob-dark",
  tokens: {
    desktop:              { fg: "#444444", bg: "black"  },
    menuBar:              { fg: "white",  bg: "#333333" },
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
