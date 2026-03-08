/**
 * Table — columnar data display.
 * Wib mode: zebra-striped rows with subtle animation.
 * Wob mode: clean aligned columns with header rule.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export interface TableProps {
  columns: TableColumn[];
  rows: Record<string, string>[];
  onRowSelect?: (index: number, row: Record<string, string>) => void;
}

export function createTable(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<TableProps>,
): UiPart<Partial<TableProps>> {
  let props: TableProps = {
    columns: initial?.columns ?? [],
    rows: initial?.rows ?? [],
    onRowSelect: initial?.onRowSelect,
  };

  const node = blessed.box({
    parent,
    scrollable: true,
    mouse: true,
  });

  function render() {
    const t = theme();
    const totalW = Number(node.width) || 40;
    const colWidths = props.columns.map(c => c.width ?? Math.floor(totalW / props.columns.length));

    const header = props.columns.map((c, i) => c.label.padEnd(colWidths[i]).slice(0, colWidths[i])).join("│");
    const rule = colWidths.map(w => "─".repeat(w)).join("┼");
    const rows = props.rows.map(row =>
      props.columns.map((c, i) => (row[c.key] ?? "").padEnd(colWidths[i]).slice(0, colWidths[i])).join("│")
    );

    node.setContent([header, rule, ...rows].join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.columns !== undefined) props.columns = next.columns;
      if (next.rows !== undefined) props.rows = next.rows;
      if (next.onRowSelect !== undefined) props.onRowSelect = next.onRowSelect;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
