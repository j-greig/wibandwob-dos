/**
 * SplitPane — side-by-side layout with ratio control.
 * Wib mode: draggable divider with elastic snap.
 * Wob mode: fixed ratio, thin rule divider.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface SplitPaneProps {
  left: UiPart<any>;
  right: UiPart<any>;
  ratio?: number;
  orientation?: "horizontal" | "vertical";
}

export function createSplitPane(
  parent: blessed.Widgets.BoxElement,
  initial: SplitPaneProps,
): UiPart<Partial<Pick<SplitPaneProps, "ratio" | "orientation">>> {
  let ratio = initial.ratio ?? 0.5;
  let orientation = initial.orientation ?? "horizontal";
  const left = initial.left;
  const right = initial.right;

  const divider = blessed.box({
    parent,
    style: { fg: "gray" },
  });

  function render() {
    const t = theme();
    if (orientation === "horizontal") {
      divider.setContent("│");
    } else {
      divider.setContent("─".repeat(Number(divider.width) || 1));
    }
    divider.style.fg = t.muted.fg;
  }

  render();

  return {
    node: divider,
    layout(rect: Rect) {
      if (orientation === "horizontal") {
        const leftW = Math.floor(rect.width * ratio);
        const divW = 1;
        const rightW = rect.width - leftW - divW;
        left.layout({ top: rect.top, left: rect.left, width: leftW, height: rect.height });
        applyRect(divider, { top: rect.top, left: rect.left + leftW, width: divW, height: rect.height });
        right.layout({ top: rect.top, left: rect.left + leftW + divW, width: rightW, height: rect.height });
      } else {
        const topH = Math.floor(rect.height * ratio);
        const divH = 1;
        const bottomH = rect.height - topH - divH;
        left.layout({ top: rect.top, left: rect.left, width: rect.width, height: topH });
        applyRect(divider, { top: rect.top + topH, left: rect.left, width: rect.width, height: divH });
        right.layout({ top: rect.top + topH + divH, left: rect.left, width: rect.width, height: bottomH });
      }
    },
    update(next) {
      if (next.ratio !== undefined) ratio = next.ratio;
      if (next.orientation !== undefined) orientation = next.orientation;
      render();
    },
    restyle() {
      render();
      left.restyle();
      right.restyle();
    },
    destroy() {
      divider.destroy();
      left.destroy();
      right.destroy();
    },
  };
}
