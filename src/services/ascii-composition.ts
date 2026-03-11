import { blankGrid, gridToText, paintText } from "../core/grid-canvas.js";

export type AsciiCompositionRole =
  | "source"
  | "transform"
  | "mix"
  | "output"
  | "preview"
  | "parameter";

export type AsciiBlendMode = "overwrite" | "mask";

export interface AsciiCompositionNodeSpec {
  id: string;
  title: string;
  role: AsciiCompositionRole;
  description?: string;
}

export function renderAsciiTextBlock(width: number, height: number, text: string, top = Math.floor(height / 2)): string {
  const grid = blankGrid(Math.max(1, width), Math.max(1, height));
  paintText(grid, 0, Math.max(0, top), text);
  return gridToText(grid);
}

export function composeAsciiLayers(width: number, height: number, layers: string[], mode: AsciiBlendMode): string {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const grid = blankGrid(safeWidth, safeHeight);

  for (const layer of layers) {
    const rows = layer.split("\n");
    for (let y = 0; y < Math.min(safeHeight, rows.length); y += 1) {
      const row = rows[y] ?? "";
      for (let x = 0; x < row.length && x < safeWidth; x += 1) {
        const ch = row[x];
        if (!ch || ch === " ") continue;
        if (mode === "overwrite") {
          grid[y]![x] = ch;
        } else {
          grid[y]![x] = grid[y]![x] === " " ? "." : ch;
        }
      }
    }
  }

  return gridToText(grid);
}
