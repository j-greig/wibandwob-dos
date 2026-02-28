import blessed from "blessed";
import fs from "node:fs";

import { createScrollbar } from "../core/ui-primitives.js";
import type { BrowserEntry, List, WindowKind, WindowRecord } from "../core/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";

export function openPrimerBrowserWindow(params: {
  windowManager: WindowManager;
  overlays: OverlayManager;
  entries: BrowserEntry[];
  onOpenPrimer: (filePath: string) => void;
  restore?: { selectedIndex?: number };
}): void {
  const { entries } = params;
  if (entries.length === 0) {
    params.overlays.flash("No primer files found in modules, modules-private, or docs.");
    return;
  }
  const frame = params.windowManager.createFrame("Primer Browser", "browser");
  blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    content: " Enter opens file  j/k scroll  Esc closes menu ",
    style: { fg: "black", bg: "cyan" }
  });
  const list = blessed.list({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    items: entries.map((entry) => entry.label),
    style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
  });
  const initialSelectedIndex = Math.max(0, Math.min(params.restore?.selectedIndex ?? 0, entries.length - 1));
  const openSelected = (index?: number) => {
    const itemIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
    const entry = entries[itemIndex];
    if (entry) {
      params.onOpenPrimer(entry.filePath);
    }
  };
  list.on("select", (_, index) => openSelected(index));
  list.on("keypress", (_, key) => {
    if (key.name === "enter") {
      openSelected();
    }
  });
  frame.kind = "browser";
  frame.describeState = () => ({
    appType: "primer-browser",
    summary: `Primer browser listing ${entries.length} entries.`,
    selectedIndex: (list as List & { selected: number }).selected ?? 0,
    selectedLabel: entries[(list as List & { selected: number }).selected ?? 0]?.label,
    entryCount: entries.length
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    list.focus();
  };
  params.windowManager.registerWindow(frame);
  list.select(initialSelectedIndex);
  frame.focus();
}

export function openPrimerGalleryWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  allEntries: BrowserEntry[];
  tabs: Array<{ label: string; entries: BrowserEntry[] }>;
  onOpenPrimer: (filePath: string) => void;
  restore?: { activeTabIndex?: number; searchValue?: string; selectedIndex?: number };
}): void {
  const { allEntries, tabs } = params;
  if (allEntries.length === 0) {
    params.overlays.flash("No gallery entries available.");
    return;
  }
  const frame = params.windowManager.createFrame("Primer Gallery", "gallery");
  const tabBar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: "black", bg: "white" }
  });
  const filterBox = blessed.textbox({
    parent: frame.body,
    top: 1,
    left: 0,
    width: "34%",
    height: 1,
    inputOnFocus: true,
    mouse: true,
    style: { fg: "black", bg: "cyan" }
  });
  const list = blessed.list({
    parent: frame.body,
    top: 2,
    left: 0,
    width: "34%",
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    items: tabs[0].entries.map((entry) => entry.label),
    style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
  });
  const preview = blessed.box({
    parent: frame.body,
    top: 1,
    left: "34%",
    right: 0,
    bottom: 0,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: "white", bg: "black" }
  });

  let activeTabIndex = Math.max(0, Math.min(params.restore?.activeTabIndex ?? 0, tabs.length - 1));
  let activeEntries = tabs[activeTabIndex].entries;
  let searchValue = params.restore?.searchValue ?? "";

  const updatePreview = (index: number) => {
    const entry = activeEntries[index];
    if (!entry) {
      preview.setContent("No primer selected.");
      params.screen.render();
      return;
    }
    try {
      const content = fs.readFileSync(entry.filePath, "utf8");
      preview.setContent(`${tabs[activeTabIndex].label} :: ${entry.label}\n${entry.filePath}\n\n${content}`);
    } catch (error) {
      preview.setContent(`Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`);
    }
    params.screen.render();
  };
  const openSelected = (index?: number) => {
    const currentIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
    const entry = activeEntries[currentIndex];
    if (entry) {
      params.onOpenPrimer(entry.filePath);
    }
  };
  const renderTabs = () => {
    tabBar.children.forEach((child) => child.destroy());
    let left = 0;
    tabs.forEach((tabConfig, index) => {
      const tabNode = blessed.box({
        parent: tabBar,
        top: 0,
        left,
        height: 1,
        width: tabConfig.label.length + 2,
        mouse: true,
        clickable: true,
        content: ` ${tabConfig.label} `,
        style: { fg: index === activeTabIndex ? "white" : "black", bg: index === activeTabIndex ? "blue" : "white" }
      });
      tabNode.on("click", () => switchTab(index));
      left += tabConfig.label.length + 2;
    });
  };
  const applySearch = () => {
    activeEntries = allEntries.filter((entry) => entry.label.toLowerCase().includes(searchValue.toLowerCase()));
    list.setItems(activeEntries.map((entry) => entry.label));
    list.select(0);
    updatePreview(0);
    params.screen.render();
  };
  const switchTab = (index: number) => {
    activeTabIndex = index;
    activeEntries = tabs[index].entries;
    list.setItems(activeEntries.map((entry) => entry.label));
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
    params.screen.render();
  };

  list.on("select item", (_, index) => updatePreview(index));
  list.on("keypress", (_, key) => {
    if (key.name === "enter") {
      openSelected();
    } else if (["up", "down", "j", "k"].includes(key.name ?? "")) {
      setTimeout(() => updatePreview((list as List & { selected: number }).selected ?? 0), 0);
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
    params.windowManager.focusWindow(frame);
    if (activeTabIndex === 5) {
      filterBox.focus();
      filterBox.readInput();
    } else {
      list.focus();
    }
  };
  params.windowManager.registerWindow(frame);
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

export function openTextViewerWindow(params: {
  windowManager: WindowManager;
  applyMeasuredWindowSize: (frame: WindowRecord, kind: WindowKind, content: { width: number; height: number }) => void;
  title: string;
  content: string;
  kind: WindowKind;
  filePath?: string;
  contentMeasurement?: {
    contentWidth: number;
    contentHeight: number;
    recommendedWidth: number;
    recommendedHeight: number;
    animated?: boolean;
    frameCount?: number;
    skippedCommentLines?: number;
  };
  fallbackMeasurement?: {
    columnWidth: number;
    lineCount: number;
  };
}): void {
  const frame = params.windowManager.createFrame(params.title, params.kind);
  const viewer = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    content: params.content,
    style: { fg: "white", bg: "black" }
  });
  frame.kind = params.kind;
  frame.filePath = params.filePath;
  const measuredWidth = params.contentMeasurement?.contentWidth ?? params.fallbackMeasurement?.columnWidth ?? 0;
  const measuredHeight = params.contentMeasurement?.contentHeight ?? params.fallbackMeasurement?.lineCount ?? 0;
  frame.describeState = () => ({
    appType: `${params.kind}-viewer`,
    summary: params.filePath ? `Viewing ${params.filePath}` : `Viewing ${params.kind} content.`,
    filePath: params.filePath,
    lineCount: measuredHeight,
    contentWidth: measuredWidth,
    contentHeight: measuredHeight,
    recommendedWidth: params.contentMeasurement?.recommendedWidth,
    recommendedHeight: params.contentMeasurement?.recommendedHeight,
    animated: params.contentMeasurement?.animated,
    frameCount: params.contentMeasurement?.frameCount,
    skippedCommentLines: params.contentMeasurement?.skippedCommentLines,
    contentPreview: params.content.split("\n").slice(0, 8).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    viewer.focus();
  };
  params.windowManager.registerWindow(frame);
  if (params.contentMeasurement) {
    params.applyMeasuredWindowSize(frame, params.kind, {
      width: params.contentMeasurement.contentWidth,
      height: params.contentMeasurement.contentHeight
    });
  }
  frame.focus();
}

