/**
 * Gauge — circular/arc value display.
 * Wib mode: ASCII arc with animated needle.
 * Wob mode: numeric readout with bar.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}

export function createGauge(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<GaugeProps>,
): UiPart<Partial<GaugeProps>> {
  let props: GaugeProps = {
    value: initial?.value ?? 0,
    min: initial?.min ?? 0,
    max: initial?.max ?? 100,
    label: initial?.label,
    showValue: initial?.showValue ?? true,
  };

  const node = blessed.box({ parent });

  function render() {
    const t = theme();
    const min = props.min ?? 0;
    const max = props.max ?? 100;
    const range = max - min || 1;
    const ratio = Math.min(1, Math.max(0, (props.value - min) / range));
    const barW = Math.max(0, (Number(node.width) || 20) - 2);
    const filled = Math.round(ratio * barW);
    const bar = `▕${"▓".repeat(filled)}${"░".repeat(barW - filled)}▏`;
    const valStr = props.showValue ? ` ${props.value}` : "";
    const label = props.label ? `${props.label}: ` : "";
    node.setContent(`${label}${bar}${valStr}`);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.value !== undefined) props.value = next.value;
      if (next.min !== undefined) props.min = next.min;
      if (next.max !== undefined) props.max = next.max;
      if (next.label !== undefined) props.label = next.label;
      if (next.showValue !== undefined) props.showValue = next.showValue;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
