/**
 * panel-types.ts — Panel content schema and type renderers for §y² Chronicles v2.
 *
 * Seven panel types:
 * - text: plain wrapped text
 * - figlet: ASCII art text using figlet CLI
 * - ascii-art: inline or file-based ASCII art
 * - pixel: pixel-style patterns using block chars
 * - infographic: bar charts and wave lines
 * - markdown: rendered markdown content
 * - mixed: custom content callback
 */

import fs from "node:fs";
import { paintLines, bar, waveLine } from "../../src/core/grid-canvas.js";
import { renderFiglet } from "../../src/services/figlet-service.js";
import { renderMarkdown, PLAIN_HEADING_CONFIG } from "../../src/services/markdown-service.js";
import type { PanelDef } from "../../src/core/panel-layout.js";

export type PanelType = "text" | "figlet" | "ascii-art" | "pixel" | "infographic" | "markdown" | "mixed" | "webcam";

export interface CEPanelDef {
  id: string;
  type: PanelType;
  title: string;
  w: number;          // width in chars (including border)
  h: number;          // height in rows (including border)
  col: 0 | 1 | 2;     // column hint for layout
  live?: boolean;     // animates on tick
  // Type-specific content:
  text?: string;                        // for "text" type
  figletText?: string;                  // for "figlet" type
  figletFont?: string;                  // optional font override
  asciiArt?: string;                    // inline ASCII for "ascii-art"
  asciiFile?: string;                   // path to primer file
  pixelData?: string[];                 // rows of pixel chars for "pixel"
  markdown?: string;                    // for "markdown" type
  content?: (tick: number, w: number, h: number) => string; // for "mixed"/"infographic"
  webcamMonster?: boolean; // for "webcam" — enable monster face overlays
}

/**
 * Convert CEPanelDef to the PanelDef format layoutPanels expects.
 */
export function toPanelDef(def: CEPanelDef): PanelDef {
  return {
    id: def.id,
    title: def.title,
    w: def.w,
    h: def.h,
    col: def.col,
    live: def.live,
    content: (tick, w, h) => renderPanel(def, w, h, tick),
  };
}

/**
 * Main dispatcher — renders panel content based on type.
 */
export function renderPanel(def: CEPanelDef, w: number, h: number, tick: number): string {
  // inner dimensions (border is 1 cell all sides)
  const iw = Math.max(1, w - 2);
  const ih = Math.max(1, h - 2);
  switch (def.type) {
    case "text":        return renderText(def, iw, ih);
    case "figlet":      return renderFigletPanel(def, iw, ih);
    case "ascii-art":   return renderAsciiArt(def, iw, ih);
    case "pixel":       return renderPixel(def, iw, ih);
    case "infographic": return renderInfographic(def, iw, ih, tick);
    case "markdown":    return renderMarkdownPanel(def, iw, ih);
    case "mixed":       return def.content?.(tick, iw, ih) ?? renderText(def, iw, ih);
    case "webcam":      return `[webcam]\n${def.title}`;
    default:            return renderText(def, iw, ih);
  }
}

// ── Individual renderers ──────────────────────────────────────────────────────

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
    } else {
      let remaining = paragraph;
      while (remaining.length > width) {
        let breakAt = remaining.lastIndexOf(" ", width);
        if (breakAt <= 0) breakAt = width;
        lines.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trimStart();
      }
      if (remaining) lines.push(remaining);
    }
  }
  return lines;
}

function renderText(def: CEPanelDef, iw: number, ih: number): string {
  const text = def.text ?? def.title;
  const lines = wrapText(text, iw);
  return paintLines(iw, ih, lines, { centerX: false, centerY: false });
}

function renderFigletPanel(def: CEPanelDef, iw: number, ih: number): string {
  const text = def.figletText ?? def.title;
  const font = def.figletFont ?? "small";
  try {
    const rendered = renderFiglet(text, font, iw);
    if (!rendered || rendered.includes("(figlet")) {
      // Fallback to plain text if figlet not available
      return paintLines(iw, ih, [text], { centerX: true, centerY: true });
    }
    const lines = rendered.split("\n");
    return paintLines(iw, ih, lines, { centerX: true, centerY: true });
  } catch {
    return paintLines(iw, ih, [text], { centerX: true, centerY: true });
  }
}

function renderAsciiArt(def: CEPanelDef, iw: number, ih: number): string {
  let lines: string[] = [];
  
  if (def.asciiFile) {
    try {
      const content = fs.readFileSync(def.asciiFile, "utf8");
      lines = content.split("\n");
    } catch {
      lines = [`[file: ${def.asciiFile}]`, "(not found)"];
    }
  } else if (def.asciiArt) {
    lines = def.asciiArt.split("\n");
  } else {
    lines = [def.title];
  }
  
  // Clip lines to fit
  const clipped = lines.slice(0, ih).map(l => l.slice(0, iw));
  return paintLines(iw, ih, clipped, { centerX: true, centerY: true });
}

function renderPixel(def: CEPanelDef, iw: number, ih: number): string {
  let lines: string[];
  
  if (def.pixelData && def.pixelData.length > 0) {
    lines = def.pixelData;
  } else {
    // Generate a simple pixel fill pattern
    const chars = ["▓", "▒", "░", " "];
    lines = [];
    for (let y = 0; y < ih; y++) {
      let row = "";
      for (let x = 0; x < iw; x++) {
        const idx = (x + y) % chars.length;
        row += chars[idx];
      }
      lines.push(row);
    }
  }
  
  const clipped = lines.slice(0, ih).map(l => l.slice(0, iw));
  return paintLines(iw, ih, clipped, { centerX: false, centerY: true });
}

function renderInfographic(def: CEPanelDef, iw: number, ih: number, tick: number): string {
  // If def.content is provided, use it (live callback)
  if (def.content) {
    return def.content(tick, iw, ih);
  }
  
  // Default infographic: simple bars + wave
  const animOffset = def.live ? tick % 12 : 0;
  const lines = [
    def.title,
    "",
    bar("val1", 5 + animOffset % 6, 12, "50%"),
    bar("val2", 8 + animOffset % 4, 12, "75%"),
    bar("val3", 3 + animOffset % 8, 12, "30%"),
    "",
    waveLine(iw, tick, 0),
  ];
  return lines.slice(0, ih).join("\n");
}

/**
 * Render a markdown panel — uses markdown-service with PLAIN_HEADING_CONFIG
 * to avoid figlet headings in small panel spaces. Strips ANSI for tags:false.
 */
function renderMarkdownPanel(def: CEPanelDef, iw: number, ih: number): string {
  const source = def.markdown ?? def.text ?? def.title;
  try {
    const lines = renderMarkdown(source, iw, {
      paddingX: 0,
      headingConfig: PLAIN_HEADING_CONFIG,
    });
    // Strip ANSI codes since panel content uses tags:false
    const stripped = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, ""));
    return stripped.slice(0, ih).join("\n");
  } catch {
    // Fallback to plain text
    return paintLines(iw, ih, wrapText(source, iw), { centerX: false, centerY: false });
  }
}
