/**
 * Tree — hierarchical node display.
 * Wib mode: branch lines animate on expand.
 * Wob mode: clean └── / ├── connectors.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  expanded?: Set<string>;
  onToggle?: (id: string) => void;
  onSelect?: (id: string) => void;
}

export function createTree(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<TreeProps>,
): UiPart<Partial<TreeProps>> {
  let props: TreeProps = {
    nodes: initial?.nodes ?? [],
    expanded: initial?.expanded ?? new Set<string>(),
    onToggle: initial?.onToggle,
    onSelect: initial?.onSelect,
  };

  const node = blessed.box({
    parent,
    scrollable: true,
    mouse: true,
  });

  function renderNodes(nodes: TreeNode[], prefix: string): string[] {
    const lines: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isLast = i === nodes.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const hasChildren = n.children && n.children.length > 0;
      const expandIcon = hasChildren ? (props.expanded?.has(n.id) ? "▾ " : "▸ ") : "  ";
      lines.push(`${prefix}${connector}${expandIcon}${n.label}`);
      if (hasChildren && props.expanded?.has(n.id)) {
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        lines.push(...renderNodes(n.children!, childPrefix));
      }
    }
    return lines;
  }

  function render() {
    const t = theme();
    const lines = renderNodes(props.nodes, "");
    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.nodes !== undefined) props.nodes = next.nodes;
      if (next.expanded !== undefined) props.expanded = next.expanded;
      if (next.onToggle !== undefined) props.onToggle = next.onToggle;
      if (next.onSelect !== undefined) props.onSelect = next.onSelect;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
