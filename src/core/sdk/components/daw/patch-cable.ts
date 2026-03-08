/**
 * PatchCable — draws ASCII cable between two port positions.
 * Uses curved line chars for MaxMSP/modular-style patching UIs.
 * Wib register: animated signal flow dots along cable.
 * Wob register: clean static line.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface PatchCableProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  style?: "solid" | "dashed" | "dotted";
}

export function createPatchCable(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<PatchCableProps>,
): UiPart<Partial<PatchCableProps>> {
  let props: PatchCableProps = {
    from: initial?.from ?? { x: 0, y: 0 },
    to: initial?.to ?? { x: 10, y: 5 },
    color: initial?.color,
    style: initial?.style ?? "solid",
  };

  const node = blessed.box({ parent, tags: true });
  let lastRect: Rect = { top: 0, left: 0, width: 0, height: 0 };

  function render() {
    const t = theme();
    const w = lastRect.width || 40;
    const h = lastRect.height || 10;

    // Build a character grid
    const grid: string[][] = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => " ")
    );

    const fx = Math.max(0, Math.min(w - 1, props.from.x));
    const fy = Math.max(0, Math.min(h - 1, props.from.y));
    const tx = Math.max(0, Math.min(w - 1, props.to.x));
    const ty = Math.max(0, Math.min(h - 1, props.to.y));

    // Draw cable: start with from port, curve to midpoint, then to target
    const mx = Math.floor((fx + tx) / 2);
    const my = Math.floor((fy + ty) / 2);

    const hChar = props.style === "dashed" ? "╌" : props.style === "dotted" ? "·" : "─";
    const vChar = props.style === "dashed" ? "╎" : props.style === "dotted" ? "·" : "│";

    // Draw from port marker
    if (fy >= 0 && fy < h && fx >= 0 && fx < w) grid[fy][fx] = "◉";

    // Horizontal segment from source to midpoint x
    const hStart = Math.min(fx, mx);
    const hEnd = Math.max(fx, mx);
    for (let x = hStart + 1; x < hEnd; x++) {
      if (fy >= 0 && fy < h && x >= 0 && x < w) grid[fy][x] = hChar;
    }

    // Corner at (mx, fy)
    if (fy >= 0 && fy < h && mx >= 0 && mx < w) {
      grid[fy][mx] = ty > fy ? (tx > fx ? "╮" : "╭") : (tx > fx ? "╯" : "╰");
    }

    // Vertical segment from fy to ty at mx
    const vStart = Math.min(fy, ty);
    const vEnd = Math.max(fy, ty);
    for (let y = vStart + 1; y < vEnd; y++) {
      if (y >= 0 && y < h && mx >= 0 && mx < w) grid[y][mx] = vChar;
    }

    // Corner at (mx, ty)
    if (ty >= 0 && ty < h && mx >= 0 && mx < w && mx !== tx) {
      grid[ty][mx] = ty > fy ? (tx > fx ? "╰" : "╯") : (tx > fx ? "╭" : "╮");
    }

    // Horizontal segment from midpoint x to target
    const h2Start = Math.min(mx, tx);
    const h2End = Math.max(mx, tx);
    for (let x = h2Start + 1; x < h2End; x++) {
      if (ty >= 0 && ty < h && x >= 0 && x < w) grid[ty][x] = hChar;
    }

    // Draw to port marker
    if (ty >= 0 && ty < h && tx >= 0 && tx < w) grid[ty][tx] = "◉";

    node.setContent(grid.map(row => row.join("")).join("\n"));
    node.style.fg = props.color ?? t.accent.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { lastRect = rect; applyRect(node, rect); render(); },
    update(next) {
      if (next.from !== undefined) props.from = next.from;
      if (next.to !== undefined) props.to = next.to;
      if (next.color !== undefined) props.color = next.color;
      if (next.style !== undefined) props.style = next.style;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
