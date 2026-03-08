/**
 * Waveform — ASCII oscilloscope display.
 * Renders float[] as a waveform using block characters.
 * Wib register: glitchy scanline mode.
 * Wob register: clean envelope mode.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface WaveformProps {
  samples: number[];  // -1.0 to 1.0
  cursor?: number;
  color?: string;
  style?: "block" | "line" | "dot";
}

const VBLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function createWaveform(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<WaveformProps>,
): UiPart<Partial<WaveformProps>> {
  let props: WaveformProps = {
    samples: initial?.samples ?? [],
    cursor: initial?.cursor,
    color: initial?.color,
    style: initial?.style ?? "block",
  };

  const node = blessed.box({ parent });
  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function render() {
    const t = theme();
    const w = lastRect.width || 40;
    const h = lastRect.height || 8;
    const samples = props.samples;

    if (samples.length === 0) {
      const mid = Math.floor(h / 2);
      const lines = Array.from({ length: h }, (_, y) =>
        y === mid ? "─".repeat(w) : " ".repeat(w)
      );
      node.setContent(lines.join("\n"));
      node.style.fg = props.color ?? t.body.fg;
      node.style.bg = t.body.bg;
      return;
    }

    // Resample to fit width
    const resampled: number[] = [];
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * samples.length);
      resampled.push(samples[idx] ?? 0);
    }

    // Render as character grid
    const grid: string[][] = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => " ")
    );

    for (let x = 0; x < w; x++) {
      const v = Math.max(-1, Math.min(1, resampled[x]));
      // Map -1..1 to 0..h-1
      const y = Math.floor(((1 - v) / 2) * (h - 1));
      const cy = Math.max(0, Math.min(h - 1, y));

      if (props.style === "dot") {
        grid[cy][x] = "●";
      } else if (props.style === "line") {
        grid[cy][x] = "─";
      } else {
        // Block mode: fill from center
        const mid = Math.floor(h / 2);
        const from = Math.min(mid, cy);
        const to = Math.max(mid, cy);
        for (let row = from; row <= to; row++) {
          const intensity = Math.abs(v);
          const blockIdx = Math.round(intensity * (VBLOCKS.length - 1));
          grid[row][x] = VBLOCKS[blockIdx];
        }
      }

      // Cursor marker
      if (props.cursor !== undefined) {
        const cx = Math.floor((props.cursor / samples.length) * w);
        if (x === cx) {
          grid[cy][x] = "▎";
        }
      }
    }

    node.setContent(grid.map(row => row.join("")).join("\n"));
    node.style.fg = props.color ?? t.accent.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { lastRect = rect; applyRect(node, rect); render(); },
    update(next) {
      if (next.samples !== undefined) props.samples = next.samples;
      if (next.cursor !== undefined) props.cursor = next.cursor;
      if (next.color !== undefined) props.color = next.color;
      if (next.style !== undefined) props.style = next.style;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
