import type { ThemeVariant } from "./types.js";

export const light: ThemeVariant = {
  name: "wibwob-light",
  tokens: {
    desktop: { fg: "grey", bg: "#e0e0e0" }, // light grey desktop
    desktopFillChar: "▒",
    menuBar: { fg: "black", bg: "white" }, // white bar on grey desktop = visible
    statusLine: { fg: "black", bg: "white" },

    windowFrame: { fg: "black", bg: "white" },
    windowBorderFocused: { fg: "blue", bg: "white" },
    windowBorderUnfocused: { fg: "grey", bg: "white" },
    titleBarFocused: { fg: "white", bg: "blue" },
    titleBarUnfocused: { fg: "black", bg: "white" },
    closeButton: { fg: "white", bg: "red" },
    resizeGrip: { fg: "blue", bg: "white" },
    windowShadow: { fg: "#999999", bg: "#999999", char: "▒" },

    body: { fg: "black", bg: "white" },
    bodyAlt: { fg: "black", bg: "#e8e8f0" },
    agentBg: { fg: "#1a1a2e", bg: "#eeeef8" },
    header: { fg: "white", bg: "blue" },
    footer: { fg: "white", bg: "blue" },

    selected: { fg: "white", bg: "blue" },
    input: { fg: "#1a1a1a", bg: "#4a90d9" },
    scrollbar: { fg: "blue", bg: "white", track: "grey" },

    accent: { fg: "blue", bg: "white" },
    highlight: { fg: "#c0006a", bg: "white" }, // deep rose — readable on white
    warning: { fg: "red", bg: "white" },
    error: { fg: "red", bg: "white" },
    success: { fg: "#c0006a", bg: "white" }, // deep rose — matches close-button energy, visible on light bg
    muted: { fg: "grey", bg: "white" },
  },
};
