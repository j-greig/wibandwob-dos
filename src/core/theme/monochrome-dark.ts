import type { ThemeVariant } from "./types.js";

/**
 * Monochrome dark theme — pure black + white/grey.
 * Purpose: maximum readability, minimal visual noise, no color distractions.
 *
 * Contrast strategy:
 *   - White (#fff) on black (#000): 21:1 ratio — WCAG AAA
 *   - Light grey (#ccc) on black: ~12:1 — WCAG AA+
 *   - Mid grey (#888) on black: ~5:1 — WCAG AA (for muted/secondary)
 *   - Dark grey (#333) on white: ~12:1 — WCAG AA+ (inverted elements)
 *   - Black on light grey (#ccc): ~12:1 — WCAG AA+
 */
export const monochromeDark: ThemeVariant = {
  name: "wibwob-monochrome-dark",
  tokens: {
    // Desktop: pure black canvas
    desktop: { fg: "#888888", bg: "#000000" },
    desktopFillChar: " ",

    // Menu bar: white text on dark grey strip
    menuBar: { fg: "#ffffff", bg: "#1a1a1a" },

    // Status line: light grey on dark grey
    statusLine: { fg: "#aaaaaa", bg: "#1a1a1a" },

    // Window frames: white text, black bg (matches desktop)
    windowFrame: { fg: "#ffffff", bg: "#000000" },

    // Window borders: focused = bright white, unfocused = dim grey
    // Using #ffffff (white) for focus creates a subtle glow effect against black
    windowBorderFocused: { fg: "#cccccc", bg: "#000000" },
    windowBorderUnfocused: { fg: "#555555", bg: "#000000" },

    // Title bar: inverted — black text on white bg for focused, grey on dark grey for unfocused
    titleBarFocused: { fg: "#000000", bg: "#ffffff" },
    titleBarUnfocused: { fg: "#888888", bg: "#2a2a2a" },

    // Close button: black on white (inverted, like a real button)
    closeButton: { fg: "#000000", bg: "#ffffff" },

    // Resize grip: mid-grey on black
    resizeGrip: { fg: "#666666", bg: "#000000" },

    // Window shadow: very subtle dark grey
    windowShadow: { fg: "#333333", bg: "#000000", char: " " },

    // Body content: white on black
    body: { fg: "#ffffff", bg: "#000000" },
    bodyAlt: { fg: "#ffffff", bg: "#111111" }, // slightly lifted for distinction

    // Agent/special backgrounds: pure black for maximum contrast
    agentBg: { fg: "#ffffff", bg: "#000000" },

    // Header/footer: inverted for visual anchors
    header: { fg: "#000000", bg: "#ffffff" },
    footer: { fg: "#000000", bg: "#cccccc" },

    // Selected state: white text on dark grey (not inverted, so it's clearly "selected")
    selected: { fg: "#ffffff", bg: "#333333" },

    // Input: white text on dark grey
    input: { fg: "#ffffff", bg: "#222222" },

    // Scrollbar: light grey thumb on darker grey track
    scrollbar: { fg: "#888888", bg: "#1a1a1a", track: "#111111" },

    // Semantic tokens: use grey scale only
    accent: { fg: "#ffffff", bg: "#000000" }, // white for emphasis
    highlight: { fg: "#ffffff", bg: "#1a1a1a" }, // inverted for standout
    warning: { fg: "#cccccc", bg: "#000000" }, // light grey — distinguishable but not alarming
    error: { fg: "#ffffff", bg: "#000000" }, // white with context
    success: { fg: "#ffffff", bg: "#000000" }, // white with context
    muted: { fg: "#666666", bg: "#000000" }, // mid grey for de-emphasized text
  },
};
