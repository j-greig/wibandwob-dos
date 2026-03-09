import blessed from "blessed";
import { createScrollbar, safeSetStyle, scrollableStyle } from "./ui-primitives.js";
import { theme } from "./theme/resolver.js";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  expanded?: boolean;
  data?: unknown;
}

interface VisibleTreeItem {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

export interface TreeWidgetHandle {
  widget: blessed.Widgets.ListElement;
  setNodes(nodes: TreeNode[]): void;
  expandNode(id: string): void;
  collapseNode(id: string): void;
  toggleNode(id: string): void;
  getFocusedNode(): TreeNode | undefined;
  onSelect(cb: (node: TreeNode) => void): void;
  onFocus(cb: (node: TreeNode) => void): void;
  destroy(): void;
}

export function createTreeWidget(
  parent: blessed.Widgets.Node,
  opts?: { style?: Record<string, unknown> }
): TreeWidgetHandle {
  let nodes: TreeNode[] = [];
  let visibleItems: VisibleTreeItem[] = [];

  const selectCallbacks: Array<(node: TreeNode) => void> = [];
  const focusCallbacks: Array<(node: TreeNode) => void> = [];

  const list = blessed.list({
    parent,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    items: [],
    style: scrollableStyle({
      ...theme().body,
      selected: theme().selected,
      item: theme().body,
      ...(opts?.style ?? {}),
    }),
  }) as blessed.Widgets.ListElement;

  const render = () => {
    const screen = list.screen ?? (parent as blessed.Widgets.Node & { screen?: blessed.Widgets.Screen }).screen;
    screen?.render();
  };

  const getSelectedIndex = () => {
    const selected = (list as blessed.Widgets.ListElement & { selected?: number }).selected;
    return typeof selected === "number" ? selected : 0;
  };

  const escapeTags = (text: string): string => {
    return text.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  };

  const hasChildren = (node: TreeNode): boolean => Array.isArray(node.children) && node.children.length > 0;

  const makeLine = (item: VisibleTreeItem): string => {
    let prefix = "";

    for (const ancestorIsLast of item.parentIsLast) {
      prefix += ancestorIsLast ? "    " : "│   ";
    }

    if (item.depth > 0) {
      prefix += item.isLast ? "└─ " : "├─ ";
    }

    let icon = "  ";
    if (hasChildren(item.node)) {
      icon = item.node.expanded ? "▼ " : "▶ ";
    }

    const safeLabel = escapeTags(item.node.label);
    const label = item.node.expanded && hasChildren(item.node) ? `{bold}${safeLabel}{/bold}` : safeLabel;
    return `${prefix}${icon}${label}`;
  };

  const flattenVisible = (): VisibleTreeItem[] => {
    const flat: VisibleTreeItem[] = [];

    const walk = (entries: TreeNode[], depth: number, parentIsLast: boolean[]) => {
      for (let i = 0; i < entries.length; i += 1) {
        const node = entries[i];
        const isLast = i === entries.length - 1;
        flat.push({ node, depth, isLast, parentIsLast: [...parentIsLast] });

        if (node.expanded && hasChildren(node)) {
          walk(node.children ?? [], depth + 1, [...parentIsLast, isLast]);
        }
      }
    };

    walk(nodes, 0, []);
    return flat;
  };

  const setSelectionById = (id?: string) => {
    if (!id) {
      list.select(0);
      return;
    }
    const nextIndex = visibleItems.findIndex((item) => item.node.id === id);
    list.select(nextIndex >= 0 ? nextIndex : 0);
  };

  const rebuild = (keepFocusId?: string) => {
    visibleItems = flattenVisible();
    list.setItems(visibleItems.map(makeLine));
    setSelectionById(keepFocusId);
  };

  const findNode = (id: string, entries: TreeNode[] = nodes): TreeNode | undefined => {
    for (const node of entries) {
      if (node.id === id) {
        return node;
      }
      if (node.children?.length) {
        const found = findNode(id, node.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };

  const notifyFocus = () => {
    const focused = visibleItems[getSelectedIndex()]?.node;
    if (!focused) {
      return;
    }
    for (const cb of focusCallbacks) {
      cb(focused);
    }
  };

  const notifySelect = (node: TreeNode) => {
    for (const cb of selectCallbacks) {
      cb(node);
    }
  };

  const toggleFocusedNode = () => {
    const focused = visibleItems[getSelectedIndex()];
    if (!focused || !hasChildren(focused.node)) {
      return;
    }
    focused.node.expanded = !focused.node.expanded;
    rebuild(focused.node.id);
    notifyFocus();
    render();
  };

  const keyHandler = (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    const name = key.name;
    if (!name) {
      return;
    }

    if (name === "g") {
      list.select(0);
      notifyFocus();
      render();
      return;
    }

    if (name === "G") {
      list.select(Math.max(0, visibleItems.length - 1));
      notifyFocus();
      render();
      return;
    }

    if (name === "space" || name === "enter") {
      toggleFocusedNode();
      return;
    }

    if (name === "right") {
      const focused = visibleItems[getSelectedIndex()];
      if (focused && hasChildren(focused.node) && !focused.node.expanded) {
        focused.node.expanded = true;
        rebuild(focused.node.id);
        notifyFocus();
        render();
      }
      return;
    }

    if (name === "left") {
      const focused = visibleItems[getSelectedIndex()];
      if (focused && hasChildren(focused.node) && focused.node.expanded) {
        focused.node.expanded = false;
        rebuild(focused.node.id);
        notifyFocus();
        render();
      }
      return;
    }

    if (name === "j" || name === "k" || name === "up" || name === "down") {
      setTimeout(() => notifyFocus(), 0);
    }
  };

  list.on("keypress", keyHandler);
  list.on("select", (_item, index) => {
    const selected = typeof index === "number" ? visibleItems[index] : visibleItems[getSelectedIndex()];
    if (!selected) {
      return;
    }
    notifySelect(selected.node);
    notifyFocus();
  });

  rebuild();

  return {
    widget: list,
    setNodes(nextNodes: TreeNode[]) {
      nodes = nextNodes;
      const focusId = visibleItems[getSelectedIndex()]?.node.id;
      rebuild(focusId);
      notifyFocus();
      render();
    },
    expandNode(id: string) {
      const node = findNode(id);
      if (!node || !hasChildren(node)) {
        return;
      }
      node.expanded = true;
      rebuild(id);
      notifyFocus();
      render();
    },
    collapseNode(id: string) {
      const node = findNode(id);
      if (!node || !hasChildren(node)) {
        return;
      }
      node.expanded = false;
      rebuild(id);
      notifyFocus();
      render();
    },
    toggleNode(id: string) {
      const node = findNode(id);
      if (!node || !hasChildren(node)) {
        return;
      }
      node.expanded = !node.expanded;
      rebuild(id);
      notifyFocus();
      render();
    },
    getFocusedNode() {
      return visibleItems[getSelectedIndex()]?.node;
    },
    onSelect(cb: (node: TreeNode) => void) {
      selectCallbacks.push(cb);
    },
    onFocus(cb: (node: TreeNode) => void) {
      focusCallbacks.push(cb);
    },
    destroy() {
      list.removeListener("keypress", keyHandler);
      list.removeAllListeners("select");
      selectCallbacks.length = 0;
      focusCallbacks.length = 0;
      list.destroy();
    },
  };
}
