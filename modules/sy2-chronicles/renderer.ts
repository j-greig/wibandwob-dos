import { CHRONICLES_PANELS, type ChroniclesPanel } from "./panels.js";

export interface ChroniclesState {
  scrollY: number;
}

interface PanelRect {
  panel: ChroniclesPanel;
  x: number;
  y: number;
}

const H_GAP = 1;
const V_GAP = 1;

function blankGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
}

function gridToText(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("\n");
}

function paintText(grid: string[][], x: number, y: number, text: string): void {
  if (y < 0 || y >= grid.length) return;
  const row = grid[y];
  if (!row) return;
  for (let i = 0; i < text.length && x + i < row.length; i += 1) {
    if (x + i >= 0) row[x + i] = text[i] ?? " ";
  }
}

function layoutPanels(width: number): { rects: PanelRect[]; totalHeight: number } {
  const maxWidth = Math.max(20, Math.floor(width));
  const rects: PanelRect[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;

  for (const panel of CHRONICLES_PANELS) {
    if (cursorX > 0 && cursorX + panel.w > maxWidth) {
      cursorX = 0;
      cursorY += rowH + V_GAP;
      rowH = 0;
    }

    rects.push({ panel, x: cursorX, y: cursorY });
    cursorX += panel.w + H_GAP;
    rowH = Math.max(rowH, panel.h);
  }

  return { rects, totalHeight: cursorY + rowH };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drawPanel(grid: string[][], rect: PanelRect): void {
  const { panel, x, y } = rect;
  const w = Math.max(6, panel.w);
  const h = Math.max(3, panel.h);
  const right = x + w - 1;
  const bottom = y + h - 1;

  paintText(grid, x, y, `┌${"─".repeat(Math.max(0, w - 2))}┐`);
  for (let yy = y + 1; yy < bottom; yy += 1) {
    paintText(grid, x, yy, "│");
    paintText(grid, right, yy, "│");
  }
  paintText(grid, x, bottom, `└${"─".repeat(Math.max(0, w - 2))}┘`);

  const title = ` ${panel.title} `;
  paintText(grid, x + 1, y, title.slice(0, Math.max(0, w - 2)));

  const innerW = Math.max(1, w - 2);
  const innerH = Math.max(0, h - 2);
  const lines = formatPanelContent(panel, innerW, innerH);
  for (let i = 0; i < lines.length && i < innerH; i += 1) {
    paintText(grid, x + 1, y + 1 + i, lines[i] ?? "");
  }
}

function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      out.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = "";

    for (const word of words) {
      if (!line) {
        line = word;
        continue;
      }

      if (line.length + 1 + word.length <= width) {
        line += ` ${word}`;
      } else {
        out.push(line);
        line = word;
      }
    }

    if (line) out.push(line);
  }

  return out;
}

function formatPanelContent(panel: ChroniclesPanel, width: number, height: number): string[] {
  if (height <= 0) return [];

  if (panel.type === "FIGLET" || panel.type === "ASCII") {
    return panel.content
      .split("\n")
      .map((line) => line.slice(0, width).padEnd(width, " "))
      .slice(0, height);
  }

  return wrapText(panel.content, width)
    .map((line) => line.slice(0, width).padEnd(width, " "))
    .slice(0, height);
}

export function measureChroniclesHeight(width: number): number {
  return layoutPanels(width).totalHeight;
}

export function renderChronicles(state: ChroniclesState, width: number, height: number): string {
  const w = Math.max(20, Math.floor(width));
  const h = Math.max(3, Math.floor(height));
  const { rects, totalHeight } = layoutPanels(w);
  const canvas = blankGrid(w, Math.max(totalHeight, h));

  for (const rect of rects) {
    drawPanel(canvas, rect);
  }

  const maxScroll = Math.max(0, totalHeight - h);
  const scroll = clamp(Math.floor(state.scrollY), 0, maxScroll);
  const viewport = canvas.slice(scroll, scroll + h);

  while (viewport.length < h) {
    viewport.push(Array.from({ length: w }, () => " "));
  }

  return gridToText(viewport);
}
