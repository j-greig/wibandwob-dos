/**
 * grid-canvas.ts — Pure 2D string-canvas API.
 *
 * No blessed dependency. Functions work on a string[][] grid that can be
 * converted to text via gridToText(). Used by panel-layout microapps and
 * any surface that needs programmatic ASCII drawing.
 *
 * Extracted from modules/sy2-chronicles/index.ts.
 */

import { clipToVisibleWidth, visibleWidth } from "./ansi-utils.js";
import { clamp } from "./ui-parts.js";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function blankGrid(w: number, h: number): string[][] {
  return Array.from({ length: Math.max(0, h) }, () =>
    Array.from({ length: Math.max(0, w) }, () => " "),
  );
}

export function paintText(grid: string[][], x: number, y: number, text: string): void {
  if (y < 0 || y >= grid.length) return;
  const row = grid[y];
  if (!row) return;

  let cursorX = x;
  for (const { segment } of segmenter.segment(text)) {
    const width = Math.max(0, visibleWidth(segment));
    if (width <= 0) continue;
    if (cursorX >= row.length) break;
    if (cursorX + width <= 0) {
      cursorX += width;
      continue;
    }
    if (cursorX < 0 || cursorX + width > row.length) {
      cursorX += width;
      continue;
    }
    row[cursorX] = segment;
    for (let offset = 1; offset < width; offset += 1) {
      row[cursorX + offset] = "";
    }
    cursorX += width;
  }
}

export function gridToText(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("\n");
}

export function paintCentered(grid: string[][], y: number, text: string): void {
  const row = grid[y];
  if (!row) return;
  const trimmed = clipToVisibleWidth(text, row.length);
  const x = Math.max(0, Math.floor((row.length - visibleWidth(trimmed)) / 2));
  paintText(grid, x, y, trimmed);
}

export function drawArrow(
  grid: string[][],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  const minX = Math.min(fromX, toX);
  const maxX = Math.max(fromX, toX);
  for (let x = minX; x <= maxX && fromY >= 0 && fromY < grid.length; x += 1) {
    const row = grid[fromY];
    if (row && x >= 0 && x < row.length) row[x] = x === toX ? ">" : "-";
  }
  const minY = Math.min(fromY, toY);
  const maxY = Math.max(fromY, toY);
  for (let y = minY; y <= maxY; y += 1) {
    const row = grid[y];
    if (row && toX >= 0 && toX < row.length) row[toX] = y === toY ? ">" : "|";
  }
}

export function paintLines(
  width: number,
  height: number,
  lines: string[],
  opts?: { centerX?: boolean; centerY?: boolean },
): string {
  const grid = blankGrid(width, height);
  const centerX = opts?.centerX ?? false;
  const centerY = opts?.centerY ?? false;
  const startY = centerY ? Math.max(0, Math.floor((height - lines.length) / 2)) : 0;
  for (let i = 0; i < lines.length; i += 1) {
    const y = startY + i;
    if (y >= height) break;
    if (centerX) {
      paintCentered(grid, y, lines[i] ?? "");
    } else {
      paintText(grid, 0, y, clipToVisibleWidth(lines[i] ?? "", width));
    }
  }
  return gridToText(grid);
}

export function waveLine(width: number, tick: number, phaseShift: number): string {
  const chars = ["~", "^", "~", "^"];
  const points: string[] = [];
  for (let x = 0; x < width; x += 1) {
    points.push(chars[(x + tick + phaseShift) % chars.length] ?? "~");
  }
  return points.join("");
}

export function bar(label: string, fill: number, total: number, value: string): string {
  const clamped = clamp(fill, 0, total);
  const line = `${"█".repeat(clamped)}${" ".repeat(Math.max(0, total - clamped))}`;
  return `${label.padEnd(5)} ${line} ${value}`;
}
