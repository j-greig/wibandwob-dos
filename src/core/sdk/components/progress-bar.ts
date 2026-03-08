/**
 * ProgressBar — horizontal fill indicator.
 * Wib mode: gradient fill with shimmer.
 * Wob mode: clean block fill with numeric readout.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface ProgressBarProps {
  value: number;
  max?: number;
  showPercent?: boolean;
}

export function createProgressBar(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<ProgressBarProps>,
): UiPart<Partial<ProgressBarProps>> {
  let props: ProgressBarProps = {
    value: initial?.value ?? 0,
    max: initial?.max ?? 100,
    showPercent: initial?.showPercent ?? true,
  };

  const node = blessed.box({ parent });

  function render() {
    const t = theme();
    const max = props.max ?? 100;
    const ratio = max > 0 ? Math.min(1, Math.max(0, props.value / max)) : 0;
    const barWidth = Math.max(0, (Number(node.width) || 20) - (props.showPercent ? 6 : 2));
    const filled = Math.round(ratio * barWidth);
    const empty = barWidth - filled;
    const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
    const pct = props.showPercent ? ` ${Math.round(ratio * 100)}%` : "";
    node.setContent(`${bar}${pct}`);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.value !== undefined) props.value = next.value;
      if (next.max !== undefined) props.max = next.max;
      if (next.showPercent !== undefined) props.showPercent = next.showPercent;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
