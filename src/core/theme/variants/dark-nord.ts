import type { ThemeVariant } from "../types.js";

/** Nord-inspired: muted steel blues, calm and professional. */
export const darkNord: ThemeVariant = {
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
