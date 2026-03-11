import type { ThemeVariant } from "./types.js";

/** CRT amber-on-black phosphor monitor vibes. */
export const phosphor: ThemeVariant = {
  name: "wibwob-phosphor",
  tokens: {
    desktop:              { fg: "#1a1100",  bg: "#0a0800"  },
    desktopFillChar:      "░",
    menuBar:              { fg: "#ffb000",  bg: "#1a1100"  },
    statusLine:           { fg: "#ffb000",  bg: "#1a1100"  },

    windowFrame:          { fg: "#ffb000",  bg: "#0a0800"  },
    windowBorderFocused:  { fg: "#ffdd00",  bg: "#0a0800"  },
    windowBorderUnfocused:{ fg: "#664400",  bg: "#0a0800"  },
    titleBarFocused:      { fg: "#0a0800",  bg: "#ffb000"  },
    titleBarUnfocused:    { fg: "#ffb000",  bg: "#1a1100"  },
    closeButton:          { fg: "#0a0800",  bg: "#ff4400"  },
    resizeGrip:           { fg: "#ffdd00",  bg: "#0a0800"  },
    windowShadow:         { fg: "#0a0800",  bg: "#1a1100",  char: "░" },

    body:                 { fg: "#ffb000",  bg: "#0a0800"  },
    bodyAlt:              { fg: "#ffb000",  bg: "#1a1100"  },
    agentBg:              { fg: "#ffc844",  bg: "#0d0a00"  },
    header:               { fg: "#0a0800",  bg: "#ff8800"  },
    footer:               { fg: "#0a0800",  bg: "#996600"  },

    selected:             { fg: "#0a0800",  bg: "#ffdd00"  },
    input:                { fg: "#ffdd00",  bg: "#1a1100"  },
    scrollbar:            { fg: "#ffb000",  bg: "#1a1100",  track: "#332200" },

    accent:               { fg: "#ffdd00",  bg: "#0a0800"  },
    highlight:            { fg: "#ff8800",  bg: "#0a0800"  },
    warning:              { fg: "#ff8800",  bg: "#0a0800"  },
    error:                { fg: "#ff4400",  bg: "#0a0800"  },
    success:              { fg: "#44ff00",  bg: "#0a0800"  },
    muted:                { fg: "#664400",  bg: "#0a0800"  },
  }
};
