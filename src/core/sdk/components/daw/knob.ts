/**
 * Knob — rotary control rendered in ASCII.
 * Wib register: animated sweep arc.
 * Wob register: precise numeric readout.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function createKnob(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<KnobProps>,
): UiPart<Partial<KnobProps>> {
  let props: KnobProps = {
    value: initial?.value ?? 0,
    min: initial?.min ?? 0,
    max: initial?.max ?? 100,
    label: initial?.label,
    size: initial?.size ?? "md",
  };

  const node = blessed.box({ parent, mouse: true });

  function render() {
    const t = theme();
    const range = props.max - props.min || 1;
    const ratio = Math.max(0, Math.min(1, (props.value - props.min) / range));

    // ASCII arc representation
    // Position in arc: 7 positions from 7 o'clock to 5 o'clock
    const arcChars = ["╰", "│", "╭", "─", "╮", "│", "╯"];
    const pos = Math.round(ratio * (arcChars.length - 1));
    const indicator = arcChars[pos];

    const valStr = String(Math.round(props.value));
    const label = props.label ?? "";

    if (props.size === "sm") {
      node.setContent(`${label ? label + " " : ""}(${indicator})${valStr}`);
    } else if (props.size === "lg") {
      const filled = Math.round(ratio * 10);
      const arc = "━".repeat(filled) + "○" + "─".repeat(10 - filled);
      node.setContent([
        `  ╭${arc}╮`,
        `  │  ${valStr.padStart(5)}  │`,
        `  ╰───────────╯`,
        `    ${label}`,
      ].join("\n"));
    } else {
      // md (default)
      const filled = Math.round(ratio * 6);
      const arc = "━".repeat(filled) + "○" + "─".repeat(6 - filled);
      node.setContent([
        ` ╭${arc}╮`,
        ` │ ${valStr.padStart(4)} │`,
        ` ╰───────╯`,
        `  ${label}`,
      ].join("\n"));
    }

    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  node.key(["up", "right"], () => {
    const step = (props.max - props.min) / 20;
    props.value = Math.min(props.max, props.value + step);
    render();
  });
  node.key(["down", "left"], () => {
    const step = (props.max - props.min) / 20;
    props.value = Math.max(props.min, props.value - step);
    render();
  });

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.value !== undefined) props.value = next.value;
      if (next.min !== undefined) props.min = next.min;
      if (next.max !== undefined) props.max = next.max;
      if (next.label !== undefined) props.label = next.label;
      if (next.size !== undefined) props.size = next.size;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
