/**
 * LevelMeter — VU meter using block characters.
 * Green/yellow/red zones. Peak hold indicator.
 * Wib register: color overflow on peaks.
 * Wob register: precise dB readout.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface LevelMeterProps {
  level: number;        // 0.0 to 1.0
  peak?: number;        // 0.0 to 1.0
  channels?: 1 | 2;
  orientation?: "vertical" | "horizontal";
}

export function createLevelMeter(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<LevelMeterProps>,
): UiPart<Partial<LevelMeterProps>> {
  let props: LevelMeterProps = {
    level: initial?.level ?? 0,
    peak: initial?.peak,
    channels: initial?.channels ?? 1,
    orientation: initial?.orientation ?? "vertical",
  };

  const node = blessed.box({ parent });
  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function render() {
    const t = theme();
    const isVert = props.orientation === "vertical";
    const extent = isVert ? (lastRect.height || 10) : (lastRect.width || 20);

    if (isVert) {
      const lines: string[] = [];
      for (let y = 0; y < extent; y++) {
        const pos = 1 - (y / (extent - 1 || 1));
        const filled = pos <= props.level;
        const isPeak = props.peak !== undefined && Math.abs(pos - props.peak) < (1 / extent);

        let ch: string;
        if (isPeak) {
          ch = "▓▓";
        } else if (filled) {
          if (pos > 0.85) ch = "██";      // red zone
          else if (pos > 0.65) ch = "▓▓";  // yellow zone
          else ch = "██";                   // green zone
        } else {
          ch = "░░";
        }

        const db = pos > 0 ? Math.round(20 * Math.log10(pos)) : -60;
        const label = (y % 3 === 0) ? `${String(db).padStart(4)}dB ` : "       ";
        lines.push(`${label}${ch}`);
      }
      node.setContent(lines.join("\n"));
    } else {
      const filled = Math.round(props.level * extent);
      const peakPos = props.peak !== undefined ? Math.round(props.peak * extent) : -1;
      let bar = "";
      for (let x = 0; x < extent; x++) {
        if (x === peakPos) {
          bar += "▓";
        } else if (x < filled) {
          const pos = x / extent;
          if (pos > 0.85) bar += "█";
          else if (pos > 0.65) bar += "▓";
          else bar += "█";
        } else {
          bar += "░";
        }
      }
      const db = props.level > 0 ? Math.round(20 * Math.log10(props.level)) : -60;
      node.setContent(`${bar} ${db}dB`);
    }

    node.style.fg = t.accent.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { lastRect = rect; applyRect(node, rect); render(); },
    update(next) {
      if (next.level !== undefined) props.level = next.level;
      if (next.peak !== undefined) props.peak = next.peak;
      if (next.channels !== undefined) props.channels = next.channels;
      if (next.orientation !== undefined) props.orientation = next.orientation;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
