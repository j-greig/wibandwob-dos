/**
 * Toggle — boolean switch.
 * Wib mode: animated slide with sparkle.
 * Wob mode: clean [x] / [ ] checkbox.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface ToggleProps {
  value: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
}

export function createToggle(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<ToggleProps>,
): UiPart<Partial<ToggleProps>> {
  let props: ToggleProps = {
    value: initial?.value ?? false,
    onChange: initial?.onChange,
    label: initial?.label,
  };

  const node = blessed.box({
    parent,
    clickable: true,
    mouse: true,
  });

  node.on("click", () => {
    props.value = !props.value;
    if (props.onChange) props.onChange(props.value);
    render();
  });

  function render() {
    const t = theme();
    const check = props.value ? "[x]" : "[ ]";
    const label = props.label ? ` ${props.label}` : "";
    node.setContent(`${check}${label}`);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.value !== undefined) props.value = next.value;
      if (next.onChange !== undefined) props.onChange = next.onChange;
      if (next.label !== undefined) props.label = next.label;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
