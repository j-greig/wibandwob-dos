/**
 * primer-browser-window.ts — Simple primer list browser.
 * Restores selection index from workspace state.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { createRestyleBundle, createSelectableList } from "../core/ui-parts.js";
import type { BrowserEntry, List } from "../core/types.js";
import { getSelectedIndex } from "../ui/index.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";

export function openPrimerBrowserWindow(params: {
  windowManager: WindowManager;
  overlays: OverlayManager;
  entries: BrowserEntry[];
  onOpenPrimer: (filePath: string) => void;
  restore?: { selectedIndex?: number };
  onStateChanged?: () => void;
}): void {
  const { entries } = params;
  if (entries.length === 0) {
    params.overlays.flash("No primer files found in modules, modules-private, or docs.");
    return;
  }
  const frame = params.windowManager.createFrame("Primer Browser", "browser");
  const header = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, height: 1,
    content: " Enter opens file  j/k scroll  Esc closes menu ",
    style: theme().header
  });
  const listHandle = createSelectableList({
    parent: frame.body,
    top: 1, left: 0, right: 0, bottom: 0,
    items: entries.map((entry) => entry.label),
    style: { ...theme().body, selected: theme().selected },
  });
  const list = listHandle.node;
  const initialSelectedIndex = Math.max(0, Math.min(params.restore?.selectedIndex ?? 0, entries.length - 1));
  const openSelected = (index?: number) => {
    const itemIndex = typeof index === "number" ? index : getSelectedIndex(list);
    const entry = entries[itemIndex];
    if (entry) params.onOpenPrimer(entry.filePath);
  };
  list.on("select item", () => params.onStateChanged?.());
  list.on("select", (_, index) => openSelected(index));
  frame.kind = "browser";
  frame.describeState = () => ({
    appType: "primer-browser",
    summary: `Primer browser listing ${entries.length} entries.`,
    selectedIndex: getSelectedIndex(list),
    selectedLabel: entries[getSelectedIndex(list)]?.label,
    entryCount: entries.length
  });
  frame.setFocusTarget(list);
  frame.onRestyle = createRestyleBundle([
    [header, () => theme().header],
    [list, () => ({ ...theme().body, selected: theme().selected })],
  ]).restyle;
  params.windowManager.registerWindow(frame);
  list.select(initialSelectedIndex);
  frame.focus();
}
