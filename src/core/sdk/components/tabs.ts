/**
 * Tabs — tabbed content container.
 * Wib mode: sliding underline animation.
 * Wob mode: bracket-delimited active tab.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface TabDef {
  id: string;
  label: string;
  content: UiPart<any>;
}

export interface TabsProps {
  tabs: TabDef[];
  active?: string;
  onChange?: (id: string) => void;
}

export function createTabs(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<TabsProps>,
): UiPart<Partial<TabsProps>> {
  let props: TabsProps = {
    tabs: initial?.tabs ?? [],
    active: initial?.active,
    onChange: initial?.onChange,
  };

  const headerNode = blessed.box({
    parent,
    height: 1,
    clickable: true,
    mouse: true,
  });

  const bodyNode = blessed.box({ parent });

  headerNode.on("click", () => {
    // Cycle tabs on click
    const idx = props.tabs.findIndex(t => t.id === props.active);
    const next = (idx + 1) % props.tabs.length;
    if (props.tabs[next]) {
      props.active = props.tabs[next].id;
      if (props.onChange) props.onChange(props.active);
      render();
    }
  });

  function render() {
    const t = theme();
    const active = props.active ?? props.tabs[0]?.id;
    const tabLabels = props.tabs.map(tab =>
      tab.id === active ? `[${tab.label}]` : ` ${tab.label} `
    ).join(" ");
    headerNode.setContent(tabLabels);
    headerNode.style.fg = t.body.fg;
    headerNode.style.bg = t.body.bg;

    // Show only active tab content
    for (const tab of props.tabs) {
      tab.content.node.hide();
    }
    const activeTab = props.tabs.find(tab => tab.id === active);
    if (activeTab) activeTab.content.node.show();
  }

  render();

  return {
    node: headerNode,
    layout(rect: Rect) {
      applyRect(headerNode, { ...rect, height: 1 });
      const bodyRect = { ...rect, top: rect.top + 1, height: rect.height - 1 };
      applyRect(bodyNode, bodyRect);
      const activeTab = props.tabs.find(tab => tab.id === (props.active ?? props.tabs[0]?.id));
      if (activeTab) activeTab.content.layout(bodyRect);
    },
    update(next) {
      if (next.tabs !== undefined) props.tabs = next.tabs;
      if (next.active !== undefined) props.active = next.active;
      if (next.onChange !== undefined) props.onChange = next.onChange;
      render();
    },
    restyle() {
      render();
      for (const tab of props.tabs) tab.content.restyle();
    },
    destroy() {
      headerNode.destroy();
      bodyNode.destroy();
      for (const tab of props.tabs) tab.content.destroy();
    },
  };
}
