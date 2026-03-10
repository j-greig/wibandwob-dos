/**
 * Renders the headless engine's frame output to a blessed box.
 * Paints FrameCell[] line by line into the content area.
 */

import type { Widgets } from "blessed";
import type { FrameCell } from "./rogue-engine/types.js";

/** Map hex colour to nearest blessed colour name */
function hexToBlessed(hex: string): string {
  if (!hex || hex === "#000000") return "black";
  if (hex === "#f5f5f5" || hex === "#ffffff") return "white";
  if (hex === "#393939") return "#393939"; // blessed supports hex in tags
  return hex;
}

/**
 * Render a frame to a blessed box.
 */
export function renderFrame(
  box: Widgets.BoxElement,
  cells: FrameCell[],
  viewW: number,
  viewH: number,
  log: string[],
  logLines: number,
) {
  const mapH = viewH - logLines;
  const lines: string[] = [];

  for (let y = 0; y < mapH && y < viewH; y++) {
    let line = "";
    let prevFg = "";
    for (let x = 0; x < viewW; x++) {
      const idx = y * viewW + x;
      const cell = cells[idx];
      if (!cell) {
        line += " ";
        continue;
      }
      const fg = hexToBlessed(cell.fg);
      if (fg !== prevFg) {
        if (prevFg) line += "{/}";
        line += `{${fg}-fg}`;
        prevFg = fg;
      }
      // Escape blessed tag delimiters in the char
      const ch = cell.ch === "{" ? "\\{" : cell.ch === "}" ? "\\}" : cell.ch;
      line += ch;
    }
    if (prevFg) line += "{/}";
    lines.push(line);
  }

  // Log separator + messages
  if (logLines > 0) {
    lines.push("{gray-fg}" + "─".repeat(Math.min(viewW, 80)) + "{/}");
    const recentLog = log.slice(-(logLines - 1));
    for (const msg of recentLog) {
      lines.push(`{white-fg}${msg}{/}`);
    }
    while (lines.length < viewH) {
      lines.push("");
    }
  }

  box.setContent(lines.join("\n"));
}
