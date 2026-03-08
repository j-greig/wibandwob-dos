/**
 * Sparkline — inline data visualization.
 * Wib mode: color gradient from cool to hot.
 * Wob mode: monochrome block characters.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  style?: "block" | "braille";
}

const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function createSparkline(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<SparklineProps>,
): UiPart<Partial<SparklineProps>> {
  let props: SparklineProps = {
    data: initial?.data ?? [],
    width: initial?.width,
    height: initial?.height ?? 1,
    style: initial?.style ?? "block",
  };

  const node = blessed.box({ parent });

  function render() {
    const t = theme();
    const data = props.data;
    if (data.length === 0) {
      node.setContent("─");
      return;
    }
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const spark = data.map(v => {
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    }).join("");
    node.setContent(spark);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.data !== undefined) props.data = next.data;
      if (next.width !== undefined) props.width = next.width;
      if (next.height !== undefined) props.height = next.height;
      if (next.style !== undefined) props.style = next.style;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
