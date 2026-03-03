import type { ThemeVariant } from "./types.js";

/** Catppuccin Mocha-inspired: purple accents on dark grey. */
export const darkPastel: ThemeVariant = {
  name: "wibwob-dark-pastel",
  tokens: {
    desktop: { fg: "#6c7086", bg: "#1e1e2e" }, // surface0 on base
    desktopFillChar: " ",
    menuBar: { fg: "#cdd6f4", bg: "#313244" }, // text on surface0
    statusLine: { fg: "#a6adc8", bg: "#313244" }, // subtext0 on surface0

    windowFrame: { fg: "#cdd6f4", bg: "#1e1e2e" },
    windowBorderFocused: { fg: "#cba6f7", bg: "#1e1e2e" }, // mauve
    windowBorderUnfocused: { fg: "#585b70", bg: "#1e1e2e" }, // surface2
    titleBarFocused: { fg: "#1e1e2e", bg: "#cba6f7" }, // base on mauve
    titleBarUnfocused: { fg: "#a6adc8", bg: "#313244" }, // subtext0 on surface0
    closeButton: { fg: "#1e1e2e", bg: "#f38ba8" }, // base on red
    resizeGrip: { fg: "#f9e2af", bg: "#1e1e2e" },
    windowShadow: { fg: "#999", bg: "#181825", char: "▒" },

    body: { fg: "#cdd6f4", bg: "#1e1e2e" }, // text on base
    bodyAlt: { fg: "#cdd6f4", bg: "#313244" }, // text on surface0
    agentBg: { fg: "#cdd6f4", bg: "#11111b" }, // deep crust — distinct from body
    header: { fg: "#1e1e2e", bg: "#89b4fa" }, // base on blue
    footer: { fg: "#1e1e2e", bg: "#a6adc8" }, // base on subtext0

    selected: { fg: "#1e1e2e", bg: "#cba6f7" }, // base on mauve
    input: { fg: "#cdd6f4", bg: "#45475a" }, // text on surface1
    scrollbar: { fg: "#cba6f7", bg: "#313244", track: "#45475a" },

    accent: { fg: "#89b4fa", bg: "#1e1e2e" }, // blue
    warning: { fg: "#f9e2af", bg: "#1e1e2e" }, // yellow
    error: { fg: "#f38ba8", bg: "#1e1e2e" }, // red
    success: { fg: "#a6e3a1", bg: "#1e1e2e" }, // green
    muted: { fg: "#6c7086", bg: "#1e1e2e" }, // overlay0
  },
};
