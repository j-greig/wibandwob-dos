import type { ThemeVariant } from "../../src/services/microapp-sdk.js";

const flexokiPaper: ThemeVariant = {
  name: "flexoki-paper",
  tokens: {
    desktop: { fg: "#6F6E69", bg: "#E6E4D9" },
    desktopFillChar: "·",
    menuBar: { fg: "#100F0F", bg: "#F2F0E5" },
    statusLine: { fg: "#403E3C", bg: "#E6E4D9" },

    windowFrame: { fg: "#282726", bg: "#FFFCF0" },
    windowBorderFocused: { fg: "#205EA6", bg: "#FFFCF0" },
    windowBorderUnfocused: { fg: "#9F9D96", bg: "#FFFCF0" },
    titleBarFocused: { fg: "#FFFCF0", bg: "#205EA6" },
    titleBarUnfocused: { fg: "#100F0F", bg: "#E6E4D9" },
    closeButton: { fg: "#FFFCF0", bg: "#AF3029" },
    resizeGrip: { fg: "#4385BE", bg: "#FFFCF0" },
    windowShadow: { fg: "#CECDC3", bg: "#CECDC3", char: "░" },

    body: { fg: "#282726", bg: "#FFFCF0" },
    bodyAlt: { fg: "#403E3C", bg: "#F2F0E5" },
    agentBg: { fg: "#1C1B1A", bg: "#F2F0E5" },
    header: { fg: "#FFFCF0", bg: "#205EA6" },
    footer: { fg: "#FFFCF0", bg: "#205EA6" },

    selected: { fg: "#FFFCF0", bg: "#205EA6" },
    input: { fg: "#FFFCF0", bg: "#205EA6" },
    scrollbar: { fg: "#6F6E69", bg: "#FFFCF0", track: "#DAD8CE" },

    accent: { fg: "#205EA6", bg: "#FFFCF0" },
    highlight: { fg: "#CE5D97", bg: "#FFFCF0" },
    warning: { fg: "#BC5215", bg: "#FFFCF0" },
    error: { fg: "#AF3029", bg: "#FFFCF0" },
    success: { fg: "#66800B", bg: "#FFFCF0" },
    muted: { fg: "#6F6E69", bg: "#FFFCF0" }
  }
};

export default flexokiPaper;
