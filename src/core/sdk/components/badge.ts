/**
 * Badge — small label tag.
 * Wib mode: colored background pill.
 * Wob mode: bracketed text.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface BadgeProps {
  text: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function createBadge(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<BadgeProps>,
): UiPart<Partial<BadgeProps>> {
  let props: BadgeProps = {
    text: initial?.text ?? "",
    variant: initial?.variant ?? "default",
  };

  const node = blessed.box({ parent });

  function render() {
    const t = theme();
    node.setContent(` ${props.text} `);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.text !== undefined) props.text = next.text;
      if (next.variant !== undefined) props.variant = next.variant;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
