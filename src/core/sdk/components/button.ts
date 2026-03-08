/**
 * Button — clickable action trigger.
 * Wib mode: pulsing border animation on hover.
 * Wob mode: clean single-char bracket, no animation.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function createButton(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<ButtonProps>,
): UiPart<Partial<ButtonProps>> {
  let props: ButtonProps = {
    label: initial?.label ?? "Button",
    onPress: initial?.onPress,
    disabled: initial?.disabled ?? false,
    variant: initial?.variant ?? "primary",
  };

  const t = theme();
  const node = blessed.box({
    parent,
    content: `[ ${props.label} ]`,
    style: {
      fg: props.disabled ? t.muted.fg : t.body.fg,
      bg: t.body.bg,
    },
    clickable: true,
    mouse: true,
  });

  node.on("click", () => {
    if (!props.disabled && props.onPress) props.onPress();
  });

  function render() {
    const t = theme();
    const prefix = props.disabled ? "  " : "▸ ";
    node.setContent(`${prefix}[ ${props.label} ]`);
    node.style.fg = props.disabled ? t.muted.fg : t.body.fg;
    node.style.bg = t.body.bg;
  }

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.label !== undefined) props.label = next.label;
      if (next.onPress !== undefined) props.onPress = next.onPress;
      if (next.disabled !== undefined) props.disabled = next.disabled;
      if (next.variant !== undefined) props.variant = next.variant;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
