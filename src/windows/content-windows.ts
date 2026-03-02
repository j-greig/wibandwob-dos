import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import stringWidth from "string-width";

import { theme } from "../core/theme/resolver.js";
import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
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
  const outer = Math.max(1, Number(viewport.width) || 1);
  const iw = Number((viewport as any).iwidth ?? 0);
  const sb = (viewport as any).scrollbar ? 1 : 0;
  const width = Math.max(1, outer - iw - sb);
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
  const header = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    content: " Enter opens file  j/k scroll  Esc closes menu ",
    style: theme().header
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
    style: { ...theme().body, selected: theme().selected }
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
  frame.onRestyle = () => {
    header.style = theme().header;
    safeSetStyle(list, { ...theme().body, selected: theme().selected });
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
    style: theme().footer
  });
  const filterBox = blessed.textbox({
    parent: frame.body,
    top: 1,
    left: 0,
    width: "34%",
    height: 1,
    inputOnFocus: true,
    mouse: true,
    style: theme().input
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
    style: { ...theme().body, selected: theme().selected }
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
    style: theme().body
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
        style: index === activeTabIndex ? theme().input : theme().footer
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
  frame.onRestyle = () => {
    tabBar.style = theme().footer;
    filterBox.style = theme().input;
    safeSetStyle(list, { ...theme().body, selected: theme().selected });
    safeSetStyle(preview, theme().body);
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
    style: theme().body
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
  frame.onRestyle = () => {
    safeSetStyle(viewer, theme().body);
  };
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

export interface FileManagerRestore {
  currentPath?: string;
  selectedIndex?: number;
  filterValue?: string;
  searchQuery?: string;
  searchMode?: "simple" | "advanced";
  viewMode?: "list" | "icon";
  showHidden?: boolean; // deprecated — dotfiles always shown
  sortField?: "name" | "size" | "modified" | "type";
}

export function openFileManagerWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  startPath: string;
  onOpenFile: (filePath: string) => void;
  onViewFile: (filePath: string) => void;
  restore?: FileManagerRestore;
}): void {
  const initialPath = params.restore?.currentPath ?? params.startPath;
  if (!fs.existsSync(initialPath) || !fs.statSync(initialPath).isDirectory()) {
    params.overlays.flash(`File manager path is not a directory: ${initialPath}`);
    return;
  }

  // ── State ──────────────────────────────────────────────
  let currentPath = initialPath;
  let allEntries: Array<{ label: string; fullPath: string; isDirectory: boolean; size: number; mtime: number }> = [];
  let entries: Array<{ label: string; fullPath: string; isDirectory: boolean; size: number; mtime: number }> = [];
  let filterValue = params.restore?.filterValue ?? "";
  let previewRawContent = "";
  let viewMode: "list" | "icon" = params.restore?.viewMode ?? "list";
  const showHidden = true; // always show dotfiles
  let sortField: "name" | "size" | "modified" | "type" = params.restore?.sortField ?? "name";
  let searchMode: "simple" | "advanced" = params.restore?.searchMode ?? "simple";
  let searchQuery = params.restore?.searchQuery ?? "";
  let searchActive = false;
  let searchResults: Array<{ file: string; line: number; text: string }> = [];
  let activeSearchProcess: ReturnType<typeof import("node:child_process").spawn> | null = null;

  // ── Icon helpers ───────────────────────────────────────
  const fileIcon = (entry: { isDirectory: boolean; label: string }): string => {
    if (entry.isDirectory) return "\u25A0"; // filled square
    const ext = path.extname(entry.label).toLowerCase();
    if ([".ts", ".js", ".tsx", ".jsx", ".py", ".c", ".cpp", ".h", ".rs"].includes(ext)) return "\u2666"; // diamond
    if ([".md", ".txt", ".doc", ".rtf"].includes(ext)) return "\u2261"; // triple bar
    if ([".json", ".yaml", ".yml", ".toml", ".xml"].includes(ext)) return "\u2630"; // trigram
    if ([".png", ".jpg", ".gif", ".svg", ".webp", ".bmp"].includes(ext)) return "\u263C"; // sun
    if ([".sh", ".bash", ".zsh", ".fish"].includes(ext)) return "\u25B6"; // play
    return "\u2022"; // bullet
  };

  // ── Frame + layout ─────────────────────────────────────
  const frame = params.windowManager.createFrame("File Manager", "browser");

  // ── Row 0: toolbar with path + clickable buttons ────────
  const toolbar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: theme().header
  });
  // Path label (left side of toolbar, fills remaining space)
  const pathLabel = blessed.box({
    parent: toolbar,
    top: 0,
    left: 0,
    right: 29, // reserve space for buttons on the right
    height: 1,
    style: theme().header
  });
  // Toolbar buttons (right-aligned, fixed widths)
  const btnFilter = blessed.box({
    parent: toolbar,
    top: 0,
    right: 19,
    width: 10,
    height: 1,
    content: " / Filter ",
    mouse: true,
    style: theme().footer
  });
  const btnSearch = blessed.box({
    parent: toolbar,
    top: 0,
    right: 9,
    width: 10,
    height: 1,
    content: " s Search ",
    mouse: true,
    style: theme().footer
  });
  const btnView = blessed.box({
    parent: toolbar,
    top: 0,
    right: 0,
    width: 9,
    height: 1,
    content: "",
    mouse: true,
    style: theme().footer
  });
  // (dotfiles always shown — no toggle button needed)

  const renderToolbarButtons = () => {
    const viewLabel = viewMode === "icon" ? "\u2261 List " : "\u25A6 Icon ";
    btnView.setContent(` ${viewLabel}`);
  };

  btnFilter.on("click", () => {
    filterBox.focus();
    renderFilter();
    params.screen.render();
  });
  btnSearch.on("click", () => {
    searchBox.focus();
    renderSearchBox();
    params.screen.render();
  });
  btnView.on("click", () => {
    toggleViewMode();
  });


  // Row 1 left: filter input
  const filterBox = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    width: "36%",
    height: 1,
    style: theme().footer
  });

  // Row 1 right: search input
  const searchBox = blessed.box({
    parent: frame.body,
    top: 1,
    left: "36%",
    right: 0,
    height: 1,
    style: theme().footer
  });

  // Left pane: directory listing (list view)
  const list = blessed.list({
    parent: frame.body,
    top: 2,
    left: 0,
    width: "36%",
    bottom: 1,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { ...theme().body, selected: theme().selected }
  });

  // Left pane: icon grid (icon view) — full width, toggled via hidden
  const iconGrid = blessed.box({
    parent: frame.body,
    top: 2,
    left: 0,
    width: viewMode === "icon" ? "100%" : "36%",
    bottom: 1,
    mouse: true,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body,
    hidden: viewMode !== "icon"
  });
  let iconSelected = 0;

  // Right pane: preview
  // Right pane: preview (hidden in icon mode)
  const preview = blessed.box({
    parent: frame.body,
    top: 2,
    left: "36%",
    right: 0,
    bottom: 1,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body,
    hidden: viewMode === "icon"
  });

  // ── Bottom status bar with clickable buttons ────────────
  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    style: theme().footer
  });
  // Left: item counts (not clickable, just info)
  const statusInfo = blessed.box({
    parent: statusBar,
    top: 0,
    left: 0,
    right: 22,
    height: 1,
    style: theme().footer
  });
  // Right: clickable buttons
  const btnSort = blessed.box({
    parent: statusBar,
    top: 0,
    right: 10,
    width: 12,
    height: 1,
    content: "",
    mouse: true,
    style: theme().footer
  });
  // (Advanced search button removed — stub lives in command catalog only)
  const btnRefresh = blessed.box({
    parent: statusBar,
    top: 0,
    right: 0,
    width: 10,
    height: 1,
    content: " \u21BB Refresh",
    mouse: true,
    style: theme().footer
  });

  const sortCycle: Array<"name" | "size" | "modified" | "type"> = ["name", "size", "modified", "type"];

  btnSort.on("click", () => {
    const idx = sortCycle.indexOf(sortField);
    sortField = sortCycle[(idx + 1) % sortCycle.length];
    navigateTo(currentPath);
  });
  btnRefresh.on("click", () => {
    navigateTo(currentPath);
  });

  // ── Rendering helpers ──────────────────────────────────

  const renderStatusButtons = () => {
    const sortLabel = sortField.charAt(0).toUpperCase() + sortField.slice(1);
    btnSort.setContent(` \u2195 ${sortLabel} `);

  };

  const renderStatusBar = () => {
    const dirs = entries.filter((e) => e.isDirectory && e.label !== "../").length;
    const files = entries.filter((e) => !e.isDirectory).length;
    statusInfo.setContent(` ${entries.length} items | ${dirs} dirs, ${files} files`);
    renderStatusButtons();
    renderToolbarButtons();
  };

  const renderFilter = () => {
    const prefix = filterFocused() ? "/" : "/";
    const width = Math.max(1, Number(filterBox.width) || 1);
    const visible = filterValue.slice(-(width - 2));
    filterBox.setContent(`${prefix}${visible}`.padEnd(width, " "));
  };

  const renderSearchBox = () => {
    const prefix = searchFocused() ? "\u25B6 " : "\u2315 ";
    const width = Math.max(1, Number(searchBox.width) || 1);
    const visible = searchQuery.slice(-(width - prefix.length - 1));
    searchBox.setContent(`${prefix}${visible}`.padEnd(width, " "));
  };

  const filterFocused = () => filterBox === params.screen.focused;
  const searchFocused = () => searchBox === params.screen.focused;

  const ICON_CELL_WIDTH = 14;

  const iconCols = () => {
    const gridWidth = Math.max(1, Number(iconGrid.width) || 40);
    return Math.max(1, Math.floor(gridWidth / ICON_CELL_WIDTH));
  };

  const renderIconGrid = () => {
    const cols = iconCols();
    // Clamp selection
    if (iconSelected >= entries.length) iconSelected = Math.max(0, entries.length - 1);
    let content = "";
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const icon = fileIcon(entry);
      const name = entry.label.length > ICON_CELL_WIDTH - 3
        ? entry.label.slice(0, ICON_CELL_WIDTH - 5) + ".."
        : entry.label;
      const cell = ` ${icon} ${name}`;
      const padded = cell.padEnd(ICON_CELL_WIDTH, " ");
      if (i === iconSelected) {
        // Highlight: use angle brackets as visual selection cursor
        content += `>${icon} ${name}<`.padEnd(ICON_CELL_WIDTH, " ");
      } else {
        content += padded;
      }
      if ((i + 1) % cols === 0) content += "\n";
    }
    iconGrid.setContent(content);
  };

  // ── Sort logic ─────────────────────────────────────────

  const sortEntries = (items: typeof allEntries): typeof allEntries => {
    const parent = items.filter((e) => e.label === "../");
    const rest = items.filter((e) => e.label !== "../");
    rest.sort((a, b) => {
      // Directories always first
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      switch (sortField) {
        case "size":
          return a.size - b.size;
        case "modified":
          return b.mtime - a.mtime;
        case "type": {
          const extA = path.extname(a.label).toLowerCase();
          const extB = path.extname(b.label).toLowerCase();
          return extA.localeCompare(extB) || a.label.localeCompare(b.label);
        }
        default:
          return a.label.localeCompare(b.label);
      }
    });
    return [...parent, ...rest];
  };

  // ── Directory listing ──────────────────────────────────

  const buildEntries = (directoryPath: string) => {
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return [];
    }
    const raw = dirents

      .map((entry) => {
        const fullPath = path.join(directoryPath, entry.name);
        let size = 0;
        let mtime = 0;
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
          mtime = stat.mtimeMs;
        } catch { /* permission denied etc */ }
        return {
          label: entry.isDirectory() ? `${entry.name}/` : entry.name,
          fullPath,
          isDirectory: entry.isDirectory(),
          size,
          mtime
        };
      });
    const nextEntries: typeof raw = [];
    if (path.dirname(directoryPath) !== directoryPath) {
      nextEntries.push({
        label: "../",
        fullPath: path.dirname(directoryPath),
        isDirectory: true,
        size: 0,
        mtime: 0
      });
    }
    nextEntries.push(...sortEntries(raw));
    return nextEntries;
  };

  // ── Preview ────────────────────────────────────────────

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
      const lines = content.slice(0, 8000).split("\n");
      const numbered = lines.map((ln, i) => `${String(i + 1).padStart(4, " ")} | ${ln}`).join("\n");
      previewRawContent = `${entry.fullPath}\n\n${numbered}`;
    } catch (error) {
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  const updatePreviewForSearchResult = (result: { file: string; line: number; text: string }) => {
    try {
      const content = fs.readFileSync(result.file, "utf8");
      const lines = content.split("\n");
      const startLine = Math.max(0, result.line - 5);
      const endLine = Math.min(lines.length, result.line + 20);
      const context = lines.slice(startLine, endLine)
        .map((ln, i) => {
          const lineNum = startLine + i + 1;
          const marker = lineNum === result.line ? "\u25B6" : " ";
          return `${marker}${String(lineNum).padStart(4, " ")} | ${ln}`;
        })
        .join("\n");
      previewRawContent = `${result.file}:${result.line}\n\n${context}`;
    } catch (error) {
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  // ── Filter + refresh ───────────────────────────────────

  const applyFilter = (selectedIndex = 0) => {
    const normalized = filterValue.trim().toLowerCase();
    entries = normalized.length === 0
      ? [...allEntries]
      : allEntries.filter((entry) => entry.label.toLowerCase().includes(normalized));
    if (viewMode === "list") {
      list.setItems(entries.map((e) => ` ${fileIcon(e)} ${e.label}`));
    } else {
      renderIconGrid();
    }
    const safeIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, entries.length - 1)));
    list.select(safeIndex);
    updatePreview(safeIndex);
    renderFilter();
    renderStatusBar();
    params.screen.render();
  };

  const navigateTo = (directoryPath: string, selectedIndex = 0) => {
    // Cancel any active search when navigating
    cancelSearch();
    currentPath = directoryPath;
    allEntries = buildEntries(directoryPath);
    pathLabel.setContent(` \u2302 ${currentPath}`);
    applyFilter(selectedIndex);
  };

  // ── Search ─────────────────────────────────────────────

  const cancelSearch = () => {
    if (activeSearchProcess) {
      activeSearchProcess.kill();
      activeSearchProcess = null;
    }
    searchActive = false;
  };

  const showSearchResults = () => {
    searchActive = true;
    if (searchResults.length === 0) {
      list.setItems(["  (no results)"]);
      previewRawContent = "No matches found.";
      setViewportContent(preview, previewRawContent);
    } else {
      const items = searchResults.map((r) => {
        const rel = path.relative(currentPath, r.file);
        return ` ${rel}:${r.line} ${r.text.trim().slice(0, 60)}`;
      });
      list.setItems(items);
      list.select(0);
      updatePreviewForSearchResult(searchResults[0]);
    }
    renderStatusBar();
    params.screen.render();
  };

  const runSimpleSearch = (query: string, glob?: string) => {
    cancelSearch();
    searchQuery = query;
    searchResults = [];

    if (!query.trim()) {
      searchActive = false;
      applyFilter();
      return;
    }

    const { spawn } = require("node:child_process") as typeof import("node:child_process");
    const args = ["--no-heading", "--line-number", "--color=never", "--max-count=200"];
    if (glob) {
      args.push("--glob", glob);
    }
    args.push("--", query, currentPath);

    const proc = spawn("rg", args, { cwd: currentPath, stdio: ["ignore", "pipe", "pipe"] });
    activeSearchProcess = proc;
    let buffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          searchResults.push({ file: match[1], line: parseInt(match[2], 10), text: match[3] });
        }
      }
      // Incremental update every batch
      showSearchResults();
    });

    proc.on("close", () => {
      if (buffer.trim()) {
        const match = buffer.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          searchResults.push({ file: match[1], line: parseInt(match[2], 10), text: match[3] });
        }
      }
      activeSearchProcess = null;
      showSearchResults();
    });

    proc.on("error", () => {
      activeSearchProcess = null;
      params.overlays.flash("Search failed: ripgrep (rg) not found");
    });

    // Show "searching..." immediately
    list.setItems(["  Searching..."]);
    previewRawContent = `Searching for "${query}" in ${currentPath}...`;
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  const runAdvancedSearch = (_query: string) => {
    params.overlays.flash("Advanced search (QMD) coming soon");
  };

  // ── View toggle ────────────────────────────────────────

  const setViewMode = (mode: "list" | "icon") => {
    viewMode = mode;
    if (mode === "list") {
      list.hidden = false;
      iconGrid.hidden = true;
      // Restore split layout
      list.width = "36%";
      filterBox.width = "36%";
      searchBox.left = "36%";
      preview.hidden = false;
      // Sync selection from icon -> list
      list.select(iconSelected);
      applyFilter(iconSelected);
      list.focus();
    } else {
      list.hidden = true;
      iconGrid.hidden = false;
      // Icon mode: full width, hide preview
      iconGrid.width = "100%";
      preview.hidden = true;
      // Sync selection from list -> icon
      iconSelected = (list as List & { selected: number }).selected ?? 0;
      renderIconGrid();
      renderStatusBar();
      iconGrid.focus();
      params.screen.render();
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "icon" : "list");
  };

  // ── Entry interaction ──────────────────────────────────

  const getSelectedEntry = (index?: number) => {
    const currentIndex = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
    return entries[currentIndex];
  };

  const openSelected = (index?: number) => {
    if (searchActive) {
      const idx = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const result = searchResults[idx];
      if (result) params.onOpenFile(result.file);
      return;
    }
    const entry = getSelectedEntry(index);
    if (!entry) return;
    if (entry.isDirectory) {
      navigateTo(entry.fullPath);
      return;
    }
    params.onOpenFile(entry.fullPath);
  };

  const viewSelected = (index?: number) => {
    if (searchActive) {
      const idx = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      const result = searchResults[idx];
      if (result) params.onViewFile(result.file);
      return;
    }
    const entry = getSelectedEntry(index);
    if (!entry || entry.isDirectory) return;
    params.onViewFile(entry.fullPath);
  };

  // ── Key bindings: list ─────────────────────────────────

  list.on("select", (_, index) => {
    if (searchActive && searchResults[index]) {
      updatePreviewForSearchResult(searchResults[index]);
    } else {
      updatePreview(index);
    }
  });

  list.on("keypress", (ch, key) => {
    if (key.name === "enter") {
      openSelected();
      return;
    }
    if (key.name === "v" && !key.ctrl && !key.meta) {
      viewSelected();
      return;
    }
    if (key.name === "slash") {
      if (searchActive) {
        // Exit search mode, back to browse
        cancelSearch();
        applyFilter();
      }
      filterBox.focus();
      renderFilter();
      params.screen.render();
      return;
    }
    if (key.name === "s" && !key.ctrl && !key.meta) {
      searchBox.focus();
      renderSearchBox();
      params.screen.render();
      return;
    }
    if (key.name === "backspace") {
      if (searchActive) {
        cancelSearch();
        applyFilter();
        return;
      }
      const parentPath = path.dirname(currentPath);
      if (parentPath !== currentPath) {
        navigateTo(parentPath);
      }
      return;
    }
    if (key.name === "tab") {
      toggleViewMode();
      return;
    }

    if (key.name === "escape") {
      if (searchActive) {
        cancelSearch();
        applyFilter();
        return;
      }
    }
    if (["up", "down", "j", "k"].includes(key.name ?? "")) {
      setTimeout(() => {
        const idx = (list as List & { selected: number }).selected ?? 0;
        if (searchActive && searchResults[idx]) {
          updatePreviewForSearchResult(searchResults[idx]);
        } else {
          updatePreview(idx);
        }
        if (viewMode === "icon") renderIconGrid();
      }, 0);
      return;
    }
    // Jump-to-letter (only in browse mode)
    if (!searchActive && typeof ch === "string" && /^[a-zA-Z0-9]$/.test(ch) && ch !== "s" && ch !== "v") {
      const startIndex = ((list as List & { selected: number }).selected ?? 0) + 1;
      const normalized = ch.toLowerCase();
      const ordered = entries.slice(startIndex).concat(entries.slice(0, startIndex));
      const match = ordered.find((entry) => entry.label.toLowerCase().startsWith(normalized));
      if (match) {
        const nextIndex = entries.indexOf(match);
        list.select(nextIndex);
        updatePreview(nextIndex);
        if (viewMode === "icon") renderIconGrid();
      }
    }
  });

  /** Focus the appropriate content pane based on current view mode. */
  const focusContentPane = () => {
    if (viewMode === "icon") {
      iconGrid.focus();
    } else {
      list.focus();
    }
  };

  // ── Key bindings: filter box ───────────────────────────

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
      focusContentPane();
      params.screen.render();
      return;
    }
    if (key.name === "backspace") {
      filterValue = filterValue.slice(0, -1);
      applyFilter();
      return;
    }
    if (key.name === "tab") {
      searchBox.focus();
      renderSearchBox();
      params.screen.render();
      return;
    }
    if (typeof ch === "string" && /^[ -~]$/.test(ch) && !key.ctrl && !key.meta) {
      filterValue += ch;
      applyFilter();
    }
  });

  // ── Key bindings: search box ───────────────────────────

  searchBox.on("focus", () => {
    params.windowManager.focusWindow(frame);
    renderSearchBox();
    params.screen.render();
  });
  searchBox.on("blur", () => {
    renderSearchBox();
    params.screen.render();
  });
  searchBox.on("keypress", (ch, key) => {
    if (key.name === "escape") {
      focusContentPane();
      params.screen.render();
      return;
    }
    if (key.name === "enter") {
      if (searchMode === "simple") {
        runSimpleSearch(searchQuery);
      } else {
        runAdvancedSearch(searchQuery);
      }
      focusContentPane();
      return;
    }
    if (key.name === "backspace") {
      searchQuery = searchQuery.slice(0, -1);
      renderSearchBox();
      params.screen.render();
      return;
    }
    if (key.name === "tab") {
      // Tab from search box goes to filter box
      filterBox.focus();
      renderFilter();
      params.screen.render();
      return;
    }
    if (typeof ch === "string" && /^[ -~]$/.test(ch) && !key.ctrl && !key.meta) {
      searchQuery += ch;
      renderSearchBox();
      params.screen.render();
    }
  });

  // ── Icon grid navigation ────────────────────────────────

  iconGrid.on("click", () => {
    iconGrid.focus();
  });

  iconGrid.on("keypress", (ch, key) => {
    if (!entries.length) return;
    const cols = iconCols();

    if (key.name === "right" || key.name === "l") {
      if (iconSelected < entries.length - 1) {
        iconSelected++;
        renderIconGrid();
        params.screen.render();
      }
      return;
    }
    if (key.name === "left" || key.name === "h") {
      if (iconSelected > 0) {
        iconSelected--;
        renderIconGrid();
        params.screen.render();
      }
      return;
    }
    if (key.name === "down" || key.name === "j") {
      const next = iconSelected + cols;
      if (next < entries.length) {
        iconSelected = next;
        renderIconGrid();
        params.screen.render();
      }
      return;
    }
    if (key.name === "up" || key.name === "k") {
      const next = iconSelected - cols;
      if (next >= 0) {
        iconSelected = next;
        renderIconGrid();
        params.screen.render();
      }
      return;
    }
    if (key.name === "enter") {
      const entry = entries[iconSelected];
      if (!entry) return;
      if (entry.isDirectory) {
        navigateTo(entry.fullPath);
        iconSelected = 0;
        renderIconGrid();
        iconGrid.focus();
      } else {
        params.onOpenFile(entry.fullPath);
      }
      return;
    }
    if (key.name === "v" && !key.ctrl && !key.meta) {
      const entry = entries[iconSelected];
      if (entry && !entry.isDirectory) {
        params.onViewFile(entry.fullPath);
      }
      return;
    }
    if (key.name === "backspace") {
      const parentPath = path.dirname(currentPath);
      if (parentPath !== currentPath) {
        navigateTo(parentPath);
        iconSelected = 0;
        renderIconGrid();
        iconGrid.focus();
      }
      return;
    }
    if (key.name === "tab") {
      toggleViewMode();
      return;
    }
    if (key.name === "slash") {
      filterBox.focus();
      renderFilter();
      params.screen.render();
      return;
    }
    if (key.name === "s" && !key.ctrl && !key.meta) {
      searchBox.focus();
      renderSearchBox();
      params.screen.render();
      return;
    }
    // Jump-to-letter
    if (typeof ch === "string" && /^[a-zA-Z0-9]$/.test(ch) && ch !== "s" && ch !== "v") {
      const startIndex = iconSelected + 1;
      const normalized = ch.toLowerCase();
      const ordered = entries.slice(startIndex).concat(entries.slice(0, startIndex));
      const match = ordered.find((entry) => entry.label.toLowerCase().startsWith(normalized));
      if (match) {
        iconSelected = entries.indexOf(match);
        renderIconGrid();
        params.screen.render();
      }
    }
  });

  // ── Frame wiring ───────────────────────────────────────

  frame.kind = "browser";
  frame.describeState = () => ({
    appType: "farjs-file-manager",
    summary: `File manager at ${currentPath}` + (searchActive ? ` (searching: ${searchQuery})` : ""),
    currentPath,
    filterValue,
    searchQuery,
    searchMode,
    viewMode,
    showHidden,
    sortField,
    searchActive,
    selectedIndex: (list as List & { selected: number }).selected ?? 0,
    selectedLabel: entries[(list as List & { selected: number }).selected ?? 0]?.label,
    entryCount: entries.length,
    searchResultCount: searchActive ? searchResults.length : undefined,
    contentPreview: preview.getContent().split("\n").slice(0, 10).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    if (viewMode === "icon") {
      iconGrid.focus();
    } else {
      list.focus();
    }
  };
  frame.onRestyle = () => {
    toolbar.style = theme().header;
    pathLabel.style = theme().header;
    btnFilter.style = theme().footer;
    btnSearch.style = theme().footer;
    btnView.style = theme().footer;
    filterBox.style = theme().footer;
    searchBox.style = theme().footer;
    safeSetStyle(list, { ...theme().body, selected: theme().selected });
    safeSetStyle(iconGrid, theme().body);
    safeSetStyle(preview, theme().body);
    statusBar.style = theme().footer;
    statusInfo.style = theme().footer;
    btnSort.style = theme().footer;

    btnRefresh.style = theme().footer;
  };

  // Expose FinderController for command dispatch
  frame.finder = {
    search: (query: string, glob?: string) => {
      searchQuery = query;
      if (searchMode === "simple") {
        runSimpleSearch(query, glob);
      } else {
        runAdvancedSearch(query);
      }
    },
    navigateTo: (dirPath: string) => {
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        navigateTo(dirPath);
      } else {
        params.overlays.flash(`Not a directory: ${dirPath}`);
      }
    },
    toggleView: () => toggleViewMode(),

    refresh: () => navigateTo(currentPath),
    sortBy: (field: "name" | "size" | "modified" | "type") => {
      sortField = field;
      navigateTo(currentPath);
    }
  };

  frame.cleanup = () => {
    cancelSearch();
  };

  params.windowManager.registerWindow(frame);
  frame.frame.on("resize", () => {
    renderFilter();
    renderSearchBox();
    renderStatusBar();
    if (viewMode === "icon") renderIconGrid();
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  });
  navigateTo(initialPath, params.restore?.selectedIndex ?? 0);
  renderSearchBox();
  frame.focus();
}
