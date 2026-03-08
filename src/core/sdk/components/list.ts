/**
 * List — scrollable item list with selection.
 * Wib mode: arrow marker dances on hover.
 * Wob mode: clean highlight bar.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface ListProps {
  items: string[];
  selected?: number;
  onSelect?: (index: number, item: string) => void;
  scrollable?: boolean;
}

export function createList(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<ListProps>,
): UiPart<Partial<ListProps>> {
  let props: ListProps = {
    items: initial?.items ?? [],
    selected: initial?.selected ?? 0,
    onSelect: initial?.onSelect,
    scrollable: initial?.scrollable ?? true,
  };

  const node = blessed.box({
    parent,
    scrollable: true,
    mouse: true,
    keys: true,
  });

  node.key(["up", "k"], () => {
    if (props.selected !== undefined && props.selected > 0) {
      props.selected--;
      if (props.onSelect) props.onSelect(props.selected, props.items[props.selected]);
      render();
    }
  });

  node.key(["down", "j"], () => {
    if (props.selected !== undefined && props.selected < props.items.length - 1) {
      props.selected++;
      if (props.onSelect) props.onSelect(props.selected, props.items[props.selected]);
      render();
    }
  });

  function render() {
    const t = theme();
    const lines = props.items.map((item, i) => {
      const marker = i === props.selected ? "▸ " : "  ";
      return `${marker}${item}`;
    });
    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.items !== undefined) props.items = next.items;
      if (next.selected !== undefined) props.selected = next.selected;
      if (next.onSelect !== undefined) props.onSelect = next.onSelect;
      if (next.scrollable !== undefined) props.scrollable = next.scrollable;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
