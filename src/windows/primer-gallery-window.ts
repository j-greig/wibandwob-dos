/**
 * primer-gallery-window.ts — Tabbed primer gallery with search/filter,
 * preview pane, and restorable tab/selection state.
 */
import blessed from "blessed";
import fs from "node:fs";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle, createSelectableList, deferRender } from "../core/ui-parts.js";
import { EMPTY_PRIMER_SELECTED } from "../core/empty-states.js";
import type { BrowserEntry, List } from "../core/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";
import { PREVIEW_SPLIT_RATIO, cleanLabel, setViewportContent } from "./browser-utils.js";
import { safeReadFile, safeWriteFile } from "../core/safe-fs.js";

export function openPrimerGalleryWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  allEntries: BrowserEntry[];
  tabs: Array<{ label: string; entries: BrowserEntry[] }>;
  onOpenPrimer: (filePath: string) => void;
  restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number };
  onStateChanged?: () => void;
}): void {
  const { allEntries, tabs } = params;
  if (allEntries.length === 0) {
    params.overlays.flash("No gallery entries available.");
    return;
  }
  const frame = params.windowManager.createFrame("Primer Gallery", "gallery");
  const tabBar = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, height: 1,
    style: theme().footer
  });
  const filterBox = blessed.textbox({
    parent: frame.body,
    top: 1, left: 0,
    width: `${PREVIEW_SPLIT_RATIO}%`,
    height: 1,
    inputOnFocus: true, mouse: true,
    style: theme().input
  });
  const listHandle = createSelectableList({
    parent: frame.body,
    top: 2, left: 0,
    width: `${PREVIEW_SPLIT_RATIO}%`,
    bottom: 1,
    items: tabs[0].entries.map((entry) => cleanLabel(entry.label)),
  });
  const list = listHandle.node;
  const divider = blessed.box({
    parent: frame.body,
    top: 1, left: `${PREVIEW_SPLIT_RATIO}%`, width: 1, bottom: 0,
    style: { fg: theme().header?.fg ?? "cyan", bg: theme().body?.bg ?? "black" },
    content: "",
  });
  const fillDivider = () => {
    const h = Math.max(1, Number(divider.height) || 1);
    divider.setContent("\u2502".repeat(h).split("").join("\n"));
  };
  const previewHeader = blessed.box({
    parent: frame.body,
    top: 1, left: `${PREVIEW_SPLIT_RATIO}%+1`, right: 0, height: 1,
    style: theme().header, content: "",
  });
  const preview = blessed.box({
    parent: frame.body,
    top: 2, left: `${PREVIEW_SPLIT_RATIO}%+1`, right: 0, bottom: 1,
    mouse: true, scrollable: true, alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body
  });
  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: theme().footer, content: "",
  });

  let activeTabIndex = Math.max(0, Math.min(params.restore?.activeTabIndex ?? 0, tabs.length - 1));
  let activeEntries = tabs[activeTabIndex].entries;
  let searchValue = params.restore?.searchValue ?? "";
  let previewRawContent = "";

  const updatePreview = (index: number) => {
    const entry = activeEntries[index];
    if (!entry) {
      previewHeader.setContent(" Select a primer to preview");
      previewRawContent = EMPTY_PRIMER_SELECTED;
      setViewportContent(preview, previewRawContent);
      statusBar.setContent(` ${activeEntries.length} primers`);
      params.screen.render();
      return;
    }
    try {
      const content = safeReadFile(entry.filePath) ?? "";
      const lineCount = content.split("\n").length;
      const cleanName = cleanLabel(entry.label);
      previewHeader.setContent(` ${cleanName}  (${lineCount} lines)`);
      previewRawContent = content;
    } catch (error) {
      previewHeader.setContent(` ${cleanLabel(entry.label)}`);
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    statusBar.setContent(` ${index + 1}/${activeEntries.length}  |  ${tabs[activeTabIndex].label}  |  Enter: open  Tab: next tab  /: search`);
    fillDivider();
    params.screen.render();
  };
  const openSelected = (index?: number) => {
    const currentIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
    const entry = activeEntries[currentIndex];
    if (entry) params.onOpenPrimer(entry.filePath);
  };
  const renderTabs = () => {
    tabBar.children.forEach((child) => child.destroy());
    let left = 0;
    tabs.forEach((tabConfig, index) => {
      const count = tabConfig.entries.length;
      const tabLabel = count > 0 ? `${tabConfig.label} (${count})` : tabConfig.label;
      const tabNode = blessed.box({
        parent: tabBar,
        top: 0, left, height: 1,
        width: tabLabel.length + 2,
        mouse: true, clickable: true,
        content: ` ${tabLabel} `,
        style: index === activeTabIndex ? theme().input : theme().footer
      });
      tabNode.on("click", () => switchTab(index));
      left += tabLabel.length + 2;
    });
  };
  const applySearch = () => {
    activeEntries = allEntries.filter((entry) => entry.label.toLowerCase().includes(searchValue.toLowerCase()));
    list.setItems(activeEntries.map((entry) => cleanLabel(entry.label)));
    list.select(0);
    updatePreview(0);
    params.onStateChanged?.();
    params.screen.render();
  };
  const switchTab = (index: number) => {
    activeTabIndex = index;
    activeEntries = tabs[index].entries;
    list.setItems(activeEntries.map((entry) => cleanLabel(entry.label)));
    list.select(0);
    filterBox.setValue(index === 5 ? searchValue : ` ${tabs[index].label} `);
    renderTabs();
    updatePreview(0);
    if (index === 5) {
      filterBox.focus();
      filterBox.readInput();
    } else {
      list.focus();
    }
    params.onStateChanged?.();
    params.screen.render();
  };

  list.on("select item", (_, index) => {
    updatePreview(index);
    params.onStateChanged?.();
  });
  list.on("keypress", (_, key) => {
    if (["up", "down", "j", "k"].includes(key.name ?? "")) {
      deferRender(() => updatePreview((list as List & { selected: number }).selected ?? 0));
    } else if (key.name === "left") {
      switchTab((activeTabIndex - 1 + tabs.length) % tabs.length);
    } else if (key.name === "right") {
      switchTab((activeTabIndex + 1) % tabs.length);
    }
  });
  list.on("select", (_, index) => openSelected(index));
  filterBox.on("submit", (value) => {
    searchValue = (value ?? "").trim();
    applySearch();
    filterBox.focus();
    filterBox.readInput();
  });

  renderTabs();
  list.select(0);
  updatePreview(0);
  frame.kind = "gallery";
  frame.describeState = () => ({
    appType: "primer-gallery",
    summary: `Primer gallery with ${allEntries.length} total entries.`,
    activeTabIndex,
    activeTab: tabs[activeTabIndex]?.label,
    searchValue,
    selectedIndex: (list as List & { selected: number }).selected ?? 0,
    visibleEntryCount: activeEntries.length,
    selectedLabel: activeEntries[(list as List & { selected: number }).selected ?? 0]?.label,
    contentPreview: preview.getContent().split("\n").slice(0, 8).join("\n")
  });
  frame.focus = () => {
    if (activeTabIndex === 5) {
      filterBox.focus();
      filterBox.readInput();
    } else {
      list.focus();
    }
  };
  const restyleBundle = createRestyleBundle([
    [tabBar, () => theme().footer],
    [filterBox, () => theme().input],
    [list, () => ({ ...theme().body, selected: theme().selected })],
    [previewHeader, () => theme().header],
    [preview, () => theme().body],
    [statusBar, () => theme().footer],
    [divider, () => ({ fg: theme().header?.fg ?? "cyan", bg: theme().body?.bg ?? "black" })],
  ]);
  frame.onRestyle = () => {
    restyleBundle.restyle();
    tabBar.children.forEach((child, index) => {
      (child as blessed.Widgets.BoxElement).style = index === activeTabIndex ? theme().input : theme().footer;
    });
  };
  params.windowManager.registerWindow(frame);
  frame.frame.on("resize", () => {
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  });
  if (activeTabIndex === 5) {
    filterBox.setValue(searchValue);
    applySearch();
    list.select(Math.max(0, Math.min(params.restore?.selectedIndex ?? 0, Math.max(0, activeEntries.length - 1))));
    updatePreview((list as List & { selected: number }).selected ?? 0);
  } else {
    switchTab(activeTabIndex);
    list.select(Math.max(0, Math.min(params.restore?.selectedIndex ?? 0, Math.max(0, activeEntries.length - 1))));
    updatePreview((list as List & { selected: number }).selected ?? 0);
  }
  frame.focus();
}
