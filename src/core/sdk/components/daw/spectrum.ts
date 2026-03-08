/**
 * Spectrum — frequency spectrum analyser bar chart.
 * Uses block characters for bar rendering.
 * Wib register: color gradient across bins.
 * Wob register: precise dB scale, clean color ramp.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface SpectrumProps {
  bins: number[];           // 0.0 to 1.0 per bin
  labels?: string[];        // frequency labels (e.g., "20Hz", "1kHz")
  barWidth?: number;        // chars per bar (default 1)
}

const VBLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function createSpectrum(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<SpectrumProps>,
): UiPart<Partial<SpectrumProps>> {
  let props: SpectrumProps = {
    bins: initial?.bins ?? [],
    labels: initial?.labels,
    barWidth: initial?.barWidth ?? 1,
  };

  const node = blessed.box({ parent });
  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function render() {
    const t = theme();
    const w = lastRect.width || 40;
    const h = lastRect.height || 8;
    const barH = props.labels ? h - 1 : h;  // reserve bottom row for labels
    const barW = props.barWidth ?? 1;
    const bins = props.bins;

    if (bins.length === 0) {
      node.setContent("─".repeat(w));
      return;
    }

    // Build rows top-down
    const lines: string[] = [];
    for (let row = 0; row < barH; row++) {
      let line = "";
      const threshold = 1 - ((row + 0.5) / barH);  // top = 1.0, bottom = 0.0
      for (let b = 0; b < bins.length && line.length < w; b++) {
        const val = bins[b] ?? 0;
        if (val >= threshold + (1 / barH)) {
          line += "█".repeat(barW);
        } else if (val >= threshold) {
          // Partial block
          const frac = (val - threshold) * barH;
          const idx = Math.round(frac * (VBLOCKS.length - 1));
          line += VBLOCKS[Math.max(0, Math.min(VBLOCKS.length - 1, idx))].repeat(barW);
        } else {
          line += " ".repeat(barW);
        }
        if (barW > 1 && b < bins.length - 1 && line.length < w) {
          // No gap for single-width bars
        }
      }
      lines.push(line.padEnd(w).slice(0, w));
    }

    // Label row
    if (props.labels) {
      let labelLine = "";
      for (let b = 0; b < bins.length && labelLine.length < w; b++) {
        const lbl = props.labels[b] ?? "";
        labelLine += lbl.padEnd(barW).slice(0, barW);
      }
      lines.push(labelLine.padEnd(w).slice(0, w));
    }

    node.setContent(lines.join("\n"));
    node.style.fg = t.accent.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { lastRect = rect; applyRect(node, rect); render(); },
    update(next) {
      if (next.bins !== undefined) props.bins = next.bins;
      if (next.labels !== undefined) props.labels = next.labels;
      if (next.barWidth !== undefined) props.barWidth = next.barWidth;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
