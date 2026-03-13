import type { ThemeVariant } from "../../src/core/theme/types.js";

const flexokiInk: ThemeVariant = {
  name: "flexoki-ink",
  tokens: {
    desktop: { fg: "#6F6E69", bg: "#1C1B1A" },
    desktopFillChar: "░",
    menuBar: { fg: "#E6E4D9", bg: "#282726" },
    statusLine: { fg: "#DAD8CE", bg: "#282726" },

    windowFrame: { fg: "#E6E4D9", bg: "#1C1B1A" },
    windowBorderFocused: { fg: "#4385BE", bg: "#1C1B1A" },
    windowBorderUnfocused: { fg: "#6F6E69", bg: "#1C1B1A" },
    titleBarFocused: { fg: "#FFFCF0", bg: "#205EA6" },
    titleBarUnfocused: { fg: "#DAD8CE", bg: "#282726" },
    closeButton: { fg: "#FFFCF0", bg: "#AF3029" },
    resizeGrip: { fg: "#8B7EC8", bg: "#1C1B1A" },
    windowShadow: { fg: "#100F0F", bg: "#100F0F", char: "▒" },

    body: { fg: "#DAD8CE", bg: "#1C1B1A" },
    bodyAlt: { fg: "#B7B5AC", bg: "#282726" },
    agentBg: { fg: "#E6E4D9", bg: "#282726" },
    header: { fg: "#FFFCF0", bg: "#205EA6" },
    footer: { fg: "#FFFCF0", bg: "#205EA6" },

    selected: { fg: "#FFFCF0", bg: "#5E409D" },
    input: { fg: "#F2F0E5", bg: "#403E3C" },
    scrollbar: { fg: "#9F9D96", bg: "#1C1B1A", track: "#282726" },

    accent: { fg: "#4385BE", bg: "#1C1B1A" },
    highlight: { fg: "#CE5D97", bg: "#1C1B1A" },
    warning: { fg: "#DA702C", bg: "#1C1B1A" },
    error: { fg: "#D14D41", bg: "#1C1B1A" },
    success: { fg: "#879A39", bg: "#1C1B1A" },
    muted: { fg: "#9F9D96", bg: "#1C1B1A" }
  }
};

export default flexokiInk;
