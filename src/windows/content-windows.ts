import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import stringWidth from "string-width";

import { createScrollbar } from "../core/ui-primitives.js";
import type { ContentMeasurement } from "../services/content-measurement.js";
import type { Box, BrowserEntry, List, WindowKind, WindowRecord } from "../core/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowManager } from "../core/window-manager.js";

function fitLineToWidth(line: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  let visible = "";
  let currentWidth = 0;
  for (const char of line) {
    const charWidth = stringWidth(char);
    if (currentWidth + charWidth > width) {
      break;
    }
    visible += char;
    currentWidth += charWidth;
  }
  return visible + " ".repeat(Math.max(0, width - currentWidth));
}

function setViewportContent(viewport: Box, raw: string): void {
  const width = Math.max(1, Number(viewport.width) || 1);
  const minRows = Math.max(1, Number(viewport.height) || 1);
  const rows = raw.replace(/\r\n/g, "\n").split("\n").map((line) => fitLineToWidth(line, width));
  while (rows.length < minRows) {
    rows.push(" ".repeat(width));
  }
  viewport.setContent(rows.join("\n"));
}

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
  let previewRawContent = "";

  const updatePreview = (index: number) => {
    const entry = activeEntries[index];
    if (!entry) {
      previewRawContent = "No primer selected.";
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }
    try {
      const content = fs.readFileSync(entry.filePath, "utf8");
      previewRawContent = `${tabs[activeTabIndex].label} :: ${entry.label}\n${entry.filePath}\n\n${content}`;
    } catch (error) {
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
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

export function openTextViewerWindow(params: {
  windowManager: WindowManager;
  applyMeasuredWindowSize: (frame: WindowRecord, kind: WindowKind, content: { width: number; height: number }) => void;
  title: string;
  content: string;
  kind: WindowKind;
  filePath?: string;
  measurement?: ContentMeasurement;
}): void {
  const frame = params.windowManager.createFrame(params.title, params.kind);
  let currentContent = params.content;
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
    content: "",
    style: { fg: "white", bg: "black" }
  });
  frame.kind = params.kind;
  frame.filePath = params.filePath;
  const m = params.measurement;
  frame.describeState = () => ({
    appType: `${params.kind}-viewer`,
    summary: params.filePath ? `Viewing ${params.filePath}` : `Viewing ${params.kind} content.`,
    filePath: params.filePath,
    lineCount: m?.lineCount ?? 0,
    contentWidth: m?.columnWidth ?? 0,
    contentHeight: m?.lineCount ?? 0,
    recommendedWidth: m?.recommendedWidth,
    recommendedHeight: m?.recommendedHeight,
    animated: m?.animated,
    frameCount: m?.frameCount,
    skippedCommentLines: m?.skippedCommentLines,
    contentPreview: params.content.split("\n").slice(0, 8).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    viewer.focus();
  };
  frame.refresh = () => setViewportContent(viewer, currentContent);
  params.windowManager.registerWindow(frame);
  if (m) {
    params.applyMeasuredWindowSize(frame, params.kind, {
      width: m.columnWidth,
      height: m.lineCount
    });
  }
  setViewportContent(viewer, currentContent);
  frame.frame.on("resize", () => {
    setViewportContent(viewer, currentContent);
  });
  frame.focus();
}

export function openFileManagerWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  startPath: string;
  onOpenFile: (filePath: string) => void;
  onViewFile: (filePath: string) => void;
  restore?: { currentPath?: string; selectedIndex?: number; filterValue?: string };
}): void {
  const initialPath = params.restore?.currentPath ?? params.startPath;
  if (!fs.existsSync(initialPath) || !fs.statSync(initialPath).isDirectory()) {
    params.overlays.flash(`File manager path is not a directory: ${initialPath}`);
    return;
  }

  const frame = params.windowManager.createFrame("File Manager", "browser");
  const header = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: "black", bg: "cyan" }
  });
  const filterBox = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    width: "36%",
    height: 1,
    style: { fg: "black", bg: "white" }
  });
  const list = blessed.list({
    parent: frame.body,
    top: 2,
    left: 0,
    width: "36%",
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: "white", bg: "black", selected: { fg: "black", bg: "white" } }
  });
  const previewHeader = blessed.box({
    parent: frame.body,
    top: 1,
    left: "36%",
    right: 0,
    height: 4,
    content: " ____  ____  _____ _   _ _____ _____ _    _\n|  _ \\|  _ \\| ____| | | | ____|_   _| |  | |\n| |_) | |_) |  _| | | | |  _|   | | | |  | |\n|  __/|  _ <| |___| |_| | |___  | | | |__| |\n|_|   |_| \\_\\_____|\\___/|_____| |_|  \\____/\n",
    style: { fg: "yellow", bg: "black" }
  });
  const preview = blessed.box({
    parent: frame.body,
    top: 5,
    left: "36%",
    right: 0,
    bottom: 0,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: "white", bg: "black" }
  });

  let currentPath = initialPath;
  let allEntries: Array<{ label: string; fullPath: string; isDirectory: boolean }> = [];
  let entries: Array<{ label: string; fullPath: string; isDirectory: boolean }> = [];
  let filterValue = params.restore?.filterValue ?? "";
  let previewRawContent = "";

  const renderFilter = () => {
    const prefix = inputFocused() ? "/" : "/";
    const width = Math.max(1, Number(filterBox.width) || 1);
    const visible = filterValue.slice(-(width - 2));
    filterBox.setContent(`${prefix}${visible}`.padEnd(width, " "));
  };

  const inputFocused = () => filterBox === params.screen.focused;

  const buildEntries = (directoryPath: string) => {
    const names = fs.readdirSync(directoryPath, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    const nextEntries: Array<{ label: string; fullPath: string; isDirectory: boolean }> = [];
    if (path.dirname(directoryPath) !== directoryPath) {
      nextEntries.push({
        label: "../",
        fullPath: path.dirname(directoryPath),
        isDirectory: true
      });
    }
    for (const entry of names) {
      nextEntries.push({
        label: entry.isDirectory ? `${entry.name}/` : entry.name,
        fullPath: path.join(directoryPath, entry.name),
        isDirectory: entry.isDirectory
      });
    }
    return nextEntries;
  };

  const updatePreview = (index: number) => {
    const entry = entries[index];
    if (!entry) {
      previewRawContent = "No file selected.";
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }
    if (entry.isDirectory) {
      previewRawContent = `${entry.fullPath}\n\n[directory]`;
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }
    try {
      const content = fs.readFileSync(entry.fullPath, "utf8");
      previewRawContent = `${entry.fullPath}\n\n${content.slice(0, 8000)}`;
    } catch (error) {
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  const applyFilter = (selectedIndex = 0) => {
    const normalized = filterValue.trim().toLowerCase();
    entries = normalized.length === 0
      ? [...allEntries]
      : allEntries.filter((entry) => entry.label.toLowerCase().includes(normalized));
    list.setItems(entries.map((entry) => entry.label));
    const safeIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, entries.length - 1)));
    list.select(safeIndex);
    updatePreview(safeIndex);
    renderFilter();
    params.screen.render();
  };

  const navigateTo = (directoryPath: string, selectedIndex = 0) => {
    currentPath = directoryPath;
    allEntries = buildEntries(directoryPath);
    header.setContent(` Enter edit  v view  / filter  Backspace parent  Path: ${currentPath} `);
    applyFilter(selectedIndex);
  };

  const getSelectedEntry = (index?: number) => {
    const currentIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
    return entries[currentIndex];
  };

  const openSelected = (index?: number) => {
    const entry = getSelectedEntry(index);
    if (!entry) {
      return;
    }
    if (entry.isDirectory) {
      navigateTo(entry.fullPath);
      return;
    }
    params.onOpenFile(entry.fullPath);
  };
  const viewSelected = (index?: number) => {
    const entry = getSelectedEntry(index);
    if (!entry || entry.isDirectory) {
      return;
    }
    params.onViewFile(entry.fullPath);
  };

  list.on("select", (_, index) => updatePreview(index));
  list.on("keypress", (ch, key) => {
    if (key.name === "enter") {
      openSelected();
      return;
    }
    if (key.name === "v") {
      viewSelected();
      return;
    }
    if (key.name === "slash") {
      filterBox.focus();
      renderFilter();
      params.screen.render();
      return;
    }
    if (key.name === "backspace") {
      const parentPath = path.dirname(currentPath);
      if (parentPath !== currentPath) {
        navigateTo(parentPath);
      }
      return;
    }
    if (["up", "down", "j", "k"].includes(key.name ?? "")) {
      setTimeout(() => updatePreview((list as List & { selected: number }).selected ?? 0), 0);
      return;
    }
    if (typeof ch === "string" && /^[ -~]$/.test(ch)) {
      const startIndex = ((list as List & { selected: number }).selected ?? 0) + 1;
      const normalized = ch.toLowerCase();
      const ordered = entries.slice(startIndex).concat(entries.slice(0, startIndex));
      const match = ordered.find((entry) => entry.label.toLowerCase().startsWith(normalized));
      if (match) {
        const nextIndex = entries.indexOf(match);
        list.select(nextIndex);
        updatePreview(nextIndex);
      }
    }
  });
  filterBox.on("focus", () => {
    params.windowManager.focusWindow(frame);
    renderFilter();
    params.screen.render();
  });
  filterBox.on("blur", () => {
    renderFilter();
    params.screen.render();
  });
  filterBox.on("keypress", (ch, key) => {
    if (key.name === "enter" || key.name === "escape") {
      list.focus();
      params.screen.render();
      return;
    }
    if (key.name === "backspace") {
      filterValue = filterValue.slice(0, -1);
      applyFilter();
      return;
    }
    if (typeof ch === "string" && /^[ -~]$/.test(ch) && !key.ctrl && !key.meta) {
      filterValue += ch;
      applyFilter();
    }
  });

  frame.kind = "browser";
  frame.describeState = () => ({
    appType: "farjs-file-manager",
    summary: `File manager at ${currentPath}`,
    currentPath,
    filterValue,
    selectedIndex: (list as List & { selected: number }).selected ?? 0,
    selectedLabel: entries[(list as List & { selected: number }).selected ?? 0]?.label,
    entryCount: entries.length,
    contentPreview: preview.getContent().split("\n").slice(0, 10).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    list.focus();
  };

  params.windowManager.registerWindow(frame);
  frame.frame.on("resize", () => {
    renderFilter();
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  });
  navigateTo(initialPath, params.restore?.selectedIndex ?? 0);
  frame.focus();
}
