/**
 * Spinner — animated loading indicator.
 * Wib mode: rotating ASCII art frames.
 * Wob mode: simple ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ braille cycle.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface SpinnerProps {
  style?: "braille" | "dots" | "line";
  label?: string;
}

const FRAMES: Record<string, string[]> = {
  braille: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  dots: ["·", "··", "···", "··", "·"],
  line: ["-", "\\", "|", "/"],
};

export function createSpinner(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<SpinnerProps>,
): UiPart<Partial<SpinnerProps>> {
  let props: SpinnerProps = {
    style: initial?.style ?? "braille",
    label: initial?.label,
  };

  let frameIdx = 0;
  const node = blessed.box({ parent });

  const timer = setInterval(() => {
    const frames = FRAMES[props.style ?? "braille"];
    frameIdx = (frameIdx + 1) % frames.length;
    render();
  }, 80);

  function render() {
    const t = theme();
    const frames = FRAMES[props.style ?? "braille"];
    const frame = frames[frameIdx % frames.length];
    const label = props.label ? ` ${props.label}` : "";
    node.setContent(`${frame}${label}`);
    node.style.fg = t.muted.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.style !== undefined) props.style = next.style;
      if (next.label !== undefined) props.label = next.label;
      render();
    },
    restyle() { render(); },
    destroy() { clearInterval(timer); node.destroy(); },
  };
}
