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
import {
  paintLines,
  renderFiglet,
  renderMarkdown,
  PLAIN_HEADING_CONFIG,
  type PanelDef,
} from "../../src/services/microapp-sdk.js";
import type { PanelType, CEPanelDef } from "../../src/services/microapp-sdk.js";

// Re-export so existing consumers don't break
export type { PanelType, CEPanelDef };

/** Display prefix per panel type — glyph for dense view, label for readable view. */
export const PANEL_TYPE_PREFIX: Record<PanelType, { glyph: string; label: string }> = {
  "text":          { glyph: "¶",  label: "Text" },
  "figlet":        { glyph: "▌",  label: "Figlet" },
  "ascii-art":     { glyph: "◈",  label: "Art" },
  "pixel":         { glyph: "▒",  label: "Pixel" },
  "infographic":   { glyph: "◊",  label: "Info" },
  "markdown":      { glyph: "≡",  label: "Doc" },
  "mixed":         { glyph: "⊕",  label: "Mixed" },
  "webcam":        { glyph: "◉",  label: "Cam" },
  "animated-text": { glyph: "▶",  label: "Anim" },
};

/** Current prefix mode — change to "label" for readable names. */
export type PrefixMode = "glyph" | "label";
let prefixMode: PrefixMode = "glyph";

export function setPrefixMode(mode: PrefixMode): void { prefixMode = mode; }
export function getPrefixMode(): PrefixMode { return prefixMode; }

/** Return the display title with type prefix. */
export function prefixedTitle(type: PanelType, title: string): string {
  const p = PANEL_TYPE_PREFIX[type];
  return prefixMode === "glyph" ? `${p.glyph} ${title}` : `${p.label}: ${title}`;
}

// CEPanelDef interface now lives in src/core/canvas-types.ts (canonical owner)

/**
 * Convert CEPanelDef to the PanelDef format layoutPanels expects.
 */
export function toPanelDef(def: CEPanelDef): PanelDef {
  return {
    id: def.id,
    title: prefixedTitle(def.type, def.title),
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
    case "webcam":        return `[webcam]\n${def.title}`;
    case "animated-text": return renderAnimatedText(def, iw, ih, tick);
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

/**
 * Animated text: cycle through frames on tick.
 * Frames come from def.frames[] (split by --- in YAML).
 * Each frame is padded/clipped to fit the panel.
 */
function renderAnimatedText(def: CEPanelDef, iw: number, ih: number, tick: number): string {
  const frames = def.frames;
  if (!frames || frames.length === 0) return def.text ?? def.title;
  const frameIdx = tick % frames.length;
  const frame = frames[frameIdx]!;
  const lines = frame.split("\n");
  // Pad or clip to panel height, clip width
  const out: string[] = [];
  for (let i = 0; i < ih; i++) {
    const line = lines[i] ?? "";
    out.push(line.length > iw ? line.slice(0, iw) : line);
  }
  return out.join("\n");
}

function renderInfographic(def: CEPanelDef, iw: number, ih: number, tick: number): string {
  // Infographic panels must provide a content callback
  if (def.content) {
    return def.content(tick, iw, ih);
  }
  // No callback — show title only. Use animated-text for frame-based animations.
  return def.title;
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
