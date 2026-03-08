/**
 * Accordion — expandable sections.
 * Wib mode: smooth expand with content fade-in.
 * Wob mode: instant toggle with ▾/▸ markers.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface AccordionSection {
  title: string;
  content: string;
  expanded?: boolean;
}

export interface AccordionProps {
  sections: AccordionSection[];
}

export function createAccordion(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<AccordionProps>,
): UiPart<Partial<AccordionProps>> {
  let props: AccordionProps = {
    sections: initial?.sections ?? [],
  };

  const node = blessed.box({
    parent,
    scrollable: true,
    mouse: true,
  });

  node.on("click", () => {
    // Toggle first collapsed section (simple behavior)
    for (const section of props.sections) {
      if (!section.expanded) {
        section.expanded = true;
        render();
        return;
      }
    }
    // All expanded — collapse all
    for (const section of props.sections) section.expanded = false;
    render();
  });

  function render() {
    const t = theme();
    const lines: string[] = [];
    for (const section of props.sections) {
      const icon = section.expanded ? "▾" : "▸";
      lines.push(`${icon} ${section.title}`);
      if (section.expanded) {
        for (const line of section.content.split("\n")) {
          lines.push(`  ${line}`);
        }
      }
    }
    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.sections !== undefined) props.sections = next.sections;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
