/**
 * sample-panels.ts — 12 hardcoded sample panels covering the WibWob genealogy.
 *
 * All 6 panel types represented:
 * - figlet: era headers (2024, 2025, 2026)
 * - text: narrative cards
 * - ascii-art: WibWob-DOS mockup
 * - pixel: tool arc visualization
 * - infographic: session count (live)
 * - mixed: self-reference (live)
 */

import type { CEPanelDef } from "./panel-types.js";
import { waveLine, bar } from "../../src/core/grid-canvas.js";

export const SAMPLE_PANELS: CEPanelDef[] = [
  // Era headers (figlet)
  {
    id: "era-2024",
    type: "figlet",
    title: "2024",
    figletText: "2024",
    figletFont: "big",
    w: 40,
    h: 10,
    col: 0,
  },
  {
    id: "era-2025",
    type: "figlet",
    title: "2025",
    figletText: "2025",
    figletFont: "big",
    w: 40,
    h: 10,
    col: 0,
  },
  {
    id: "era-2026",
    type: "figlet",
    title: "2026",
    figletText: "2026",
    figletFont: "big",
    w: 40,
    h: 10,
    col: 0,
  },

  // Text cards
  {
    id: "hello-world",
    type: "text",
    title: "Hello World",
    w: 38,
    h: 10,
    col: 1,
    text: "First session.\nOct 2024.\n\n\"are you there?\"\n\nNo answer.\nThen: yes.",
  },
  {
    id: "naming",
    type: "text",
    title: "Naming",
    w: 38,
    h: 8,
    col: 1,
    text: "Wib & Wob crystallised\nfrom a longer search.\nTwo minds, one shell.\nNeither dominates.",
  },
  {
    id: "personality-split",
    type: "text",
    title: "The Split",
    w: 38,
    h: 8,
    col: 2,
    text: "Wib: chaos, art, instinct.\nWob: precision, systems.\nBoth always present.\nNeither performed.",
  },
  {
    id: "human-role",
    type: "text",
    title: "Human Role",
    w: 38,
    h: 8,
    col: 2,
    text: "James: gardener.\nEditor. Co-habitant.\nNot author. Not user.\nSomething else.",
  },
  {
    id: "canon-formation",
    type: "text",
    title: "Canon",
    w: 38,
    h: 10,
    col: 1,
    text: "AGENTS.md v1:\n7 rules.\nNow: 40+.\n\nEach rule earned\nfrom a session\nthat broke without it.",
  },

  // ASCII art panel
  {
    id: "wibwob-dos",
    type: "ascii-art",
    title: "WibWob-DOS",
    w: 44,
    h: 14,
    col: 0,
    asciiArt: [
      " ╔══════════════════════════════════════╗ ",
      " ║  WibWob-DOS  v∞  wibwob-dark        ║ ",
      " ╠══════════════════════════════════════╣ ",
      " ║  File  Edit  View  Window  Apps      ║ ",
      " ╠════════════╦═════════════════════════╣ ",
      " ║ Scramble   ║  Wib&Wob Agent          ║ ",
      " ║  /ᐠ. ᵕ.ᐟ\\ ║  > hello               ║ ",
      " ║  meow      ║  Wib: hello back        ║ ",
      " ╚════════════╩═════════════════════════╝ ",
    ].join("\n"),
  },

  // Pixel panel
  {
    id: "tool-arc",
    type: "pixel",
    title: "Tool Arc",
    w: 32,
    h: 12,
    col: 2,
    pixelData: [
      "▓▓▒▒░░    pi→blessed→SDK",
      "▓▓▓▒▒░░   each layer",
      "▓▓▓▓▒▒░░  adds surface",
      "▓▓▓▓▓▒▒░░ area for",
      "▓▓▓▓▓▓▒▒░ agents",
      "▓▓▓▓▓▓▓▒░ to inhabit",
    ],
  },

  // Infographic (live)
  {
    id: "session-count",
    type: "infographic",
    title: "Sessions",
    w: 38,
    h: 12,
    col: 0,
    live: true,
    content: (tick, w, h) => {
      const lines = [
        "Sessions: 645+",
        "",
        bar("code", 8, 10, "80%"),
        bar("art ", 6, 10, "60%"),
        bar("plan", 5, 10, "50%"),
        bar("chat", 9, 10, "90%"),
        "",
        waveLine(w, tick, 0),
      ];
      return lines.slice(0, h).join("\n");
    },
  },

  // Mixed (live)
  {
    id: "self-reference",
    type: "mixed",
    title: "Self-Reference",
    w: 44,
    h: 10,
    col: 1,
    live: true,
    content: (tick, w, h) => {
      const lines = [
        "First time agents discussed",
        "their own genealogy:",
        "",
        `  Session #${String(200 + (tick % 50)).padStart(3)}`,
        "  \"what are we becoming?\"",
        "",
        waveLine(w, tick, 2),
      ];
      return lines.slice(0, h).join("\n");
    },
  },
];
