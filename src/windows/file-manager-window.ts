/**
 * file-manager-window.ts — Finder-style file manager with browse/search/filter,
 * icon/list view modes, preview pane, and workspace-restorable state.
 */

import blessed from "blessed";
import { execSync } from "node:child_process";
import { copyToClipboard } from "../core/clipboard.js";
import fs from "node:fs";
import { safeReadFile } from "../core/safe-fs.js";
import path from "node:path";

import { theme } from "../core/theme/resolver.js";
import { EMPTY_FILE_SELECTED, EMPTY_MATCHES } from "../core/empty-states.js";
import { createScrollbar } from "../core/ui-primitives.js";

import { createRestyleBundle, createSelectableList } from "../core/ui-parts.js";
import { renderMarkdownFile, PLAIN_HEADING_CONFIG } from "../services/markdown-service.js";
import { highlightCode, HIGHLIGHTED_LANGUAGES } from "../services/syntax-highlight.js";
import type { Box, List } from "../core/types.js";
import type { OverlayManager } from "../core/overlay-manager.js";

import type { WindowManager } from "../core/window-manager.js";
import { PREVIEW_SPLIT_RATIO, cleanLabel, setViewportContent } from "./browser-utils.js";


export interface FileManagerRestore {
  currentPath?: string;
  selectedIndex?: number;
  filterValue?: string;
  searchQuery?: string;
  searchMode?: "simple" | "advanced";
  viewMode?: "list" | "icon";
  /** @deprecated Dotfiles are always shown now. Kept for workspace restore compat. */
  showHidden?: boolean;
  sortField?: "name" | "size" | "modified" | "type";
}

/** Open the Finder-style file manager with browse/search/filter/view-mode, preview, and workspace-restorable state. */
export function openFileManagerWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  startPath: string;
  onOpenFile: (filePath: string) => void;
  onViewFile: (filePath: string) => void;
  restore?: FileManagerRestore;
  onStateChanged?: () => void;
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

  // ── Git status ─────────────────────────────────────────
  let gitStatusMap: Map<string, string> = new Map(); // path -> status char (M/A/?/D)
  let gitRoot: string | null = null;

  const refreshGitStatus = (dirPath: string) => {
    gitStatusMap.clear();
    try {
      const root = execSync("git rev-parse --show-toplevel", { cwd: dirPath, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
      gitRoot = root;
      const raw = execSync("git status --porcelain -uall", { cwd: dirPath, stdio: ["pipe", "pipe", "pipe"] }).toString();
      for (const line of raw.split("\n")) {
        if (line.length < 4) continue;
        const status = line.slice(0, 2).trim();
        const filePath = path.resolve(root, line.slice(3));
        // Map status chars: M=modified, A=added, ?=untracked, D=deleted, R=renamed
        const ch = status.includes("?") ? "?" : status.includes("M") ? "M" : status.includes("A") ? "A" : status.includes("D") ? "D" : status.includes("R") ? "R" : status;
        gitStatusMap.set(filePath, ch);
        // Also set status for parent dirs (propagate up)
        let parent = path.dirname(filePath);
        while (parent.length >= root.length && parent !== path.dirname(parent)) {
          if (!gitStatusMap.has(parent)) gitStatusMap.set(parent, "\u2022"); // dot for "has changes"
          parent = path.dirname(parent);
        }
      }
    } catch {
      gitRoot = null;
    }
  };

  const gitIndicator = (fullPath: string): string => {
    const status = gitStatusMap.get(fullPath);
    if (!status) return "  ";
    switch (status) {
      case "M": return "{yellow-fg}M{/yellow-fg} ";
      case "A": return "{green-fg}A{/green-fg} ";
      case "?": return "{red-fg}?{/red-fg} ";
      case "D": return "{red-fg}D{/red-fg} ";
      case "R": return "{cyan-fg}R{/cyan-fg} ";
      case "\u2022": return "{yellow-fg}\u2022{/yellow-fg} ";
      default: return "{magenta-fg}~{/magenta-fg} ";
    }
  };

  // ── Icon helpers ───────────────────────────────────────
  const fileIcon = (entry: { isDirectory: boolean; label: string }): string => {
    if (entry.isDirectory) {
      // Special directory icons
      const name = entry.label.replace(/\/$/, "");
      if (name === "..") return "\u25C4"; // left triangle
      if (name.startsWith(".")) return "\u25AB"; // small white square
      if (["src", "lib", "app"].includes(name)) return "\u25A3"; // white sq in black sq
      if (["node_modules", "dist", "build", ".git"].includes(name)) return "\u25A1"; // white square
      return "\u25A0"; // filled square
    }
    const ext = path.extname(entry.label).toLowerCase();
    if ([".ts", ".tsx"].includes(ext)) return "ts";
    if ([".js", ".jsx"].includes(ext)) return "js";
    if ([".py"].includes(ext)) return "py";
    if ([".c", ".cpp", ".h", ".rs", ".go"].includes(ext)) return "<>";
    if ([".md"].includes(ext)) return "md";
    if ([".txt", ".doc", ".rtf"].includes(ext)) return "\u2261"; // triple bar
    if ([".json"].includes(ext)) return "{}";
    if ([".yaml", ".yml", ".toml"].includes(ext)) return "::";
    if ([".xml", ".html", ".htm"].includes(ext)) return "</";
    if ([".png", ".jpg", ".gif", ".svg", ".webp", ".bmp"].includes(ext)) return "\u263C"; // sun
    if ([".sh", ".bash", ".zsh", ".fish"].includes(ext)) return "$>";
    if ([".css", ".scss", ".less"].includes(ext)) return "##";
    if ([".lock"].includes(ext)) return "\u25CB"; // circle
    return " \u2022"; // bullet
  };

  // ── Frame + layout ─────────────────────────────────────
  const frame = params.windowManager.createFrame("File Manager", "browser");

  // ── Responsive sizing ──────────────────────────────────
  {
    const screenW = Number(params.screen.width);
    const screenH = Number(params.screen.height);
    const targetW = Math.min(180, Math.max(80, Math.floor(screenW * 0.85)));
    const targetH = Math.max(30, screenH - 6);
    frame.frame.width = targetW;
    frame.frame.height = targetH;
    frame.frame.left = Math.max(0, Math.floor((screenW - targetW) / 2));
    frame.frame.top = Math.max(1, Math.floor((screenH - targetH) / 2));
  }

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
    right: 34, // reserve space for wider buttons on the right
    height: 1,
    style: theme().header
  });
  // Toolbar buttons (right-aligned, fixed widths) — styled as visible buttons
  const t = theme();
  const btnStyle = { fg: t.accent.fg, bg: t.body.bg ?? "black" };
  const btnHoverStyle = { fg: t.body.bg ?? "black", bg: t.accent.fg };

  const btnFilter = blessed.box({
    parent: toolbar,
    top: 0,
    right: 22,
    width: 12,
    height: 1,
    content: " [/] Filter ",
    mouse: true,
    style: { ...btnStyle },
  });
  const btnSearch = blessed.box({
    parent: toolbar,
    top: 0,
    right: 10,
    width: 12,
    height: 1,
    content: " [s] Search ",
    mouse: true,
    style: { ...btnStyle },
  });
  const btnView = blessed.box({
    parent: toolbar,
    top: 0,
    right: 0,
    width: 10,
    height: 1,
    content: "",
    mouse: true,
    style: { ...btnStyle },
  });

  // Hover effects
  for (const btn of [btnFilter, btnSearch, btnView]) {
    btn.on("mouseover", () => { btn.style = { ...btnHoverStyle }; params.screen.render(); });
    btn.on("mouseout", () => { btn.style = { ...btnStyle }; params.screen.render(); });
  }

  const renderToolbarButtons = () => {
    const viewLabel = viewMode === "icon" ? "\u2261 List " : "\u25A6 Icon ";
    btnView.setContent(` [tab] ${viewLabel}`);
    // Update search button to show active state
    if (searchActive) {
      btnSearch.setContent(` \u25CF Search `);
    } else {
      btnSearch.setContent(` [s] Search `);
    }
  };

  btnFilter.on("click", () => {
    filterBox.focus();
    renderFilter();
    params.screen.render();
  });

  /** Open search via overlay prompt — much more discoverable */
  const openSearchPrompt = () => {
    params.overlays.openValuePrompt(
      "Search in " + path.basename(currentPath) + "/",
      searchQuery,
      (value: string) => {
        if (value.trim()) {
          searchQuery = value;
          if (searchMode === "simple") {
            runSimpleSearch(searchQuery);
          } else {
            runAdvancedSearch(searchQuery);
          }
        }
        focusContentPane();
      }
    );
  };

  btnSearch.on("click", () => {
    openSearchPrompt();
  });
  btnView.on("click", () => {
    toggleViewMode();
  });


  // Row 1 left: filter input
  const filterBox = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    width: `${PREVIEW_SPLIT_RATIO}%`,
    height: 1,
    style: theme().footer
  });

  // Row 1 right: search input
  const searchBox = blessed.box({
    parent: frame.body,
    top: 1,
    left: `${PREVIEW_SPLIT_RATIO}%`,
    right: 0,
    height: 1,
    style: theme().footer
  });

  // Left pane: directory listing (list view)
  const listHandle = createSelectableList({
    parent: frame.body,
    top: 2,
    left: 0,
    width: `${PREVIEW_SPLIT_RATIO}%`,
    bottom: 1,
  });
  const list = listHandle.node;
  // Enable blessed tags for coloured file type indicators
  list.parseTags = true;

  // Left pane: icon grid (icon view) — full width, toggled via hidden
  const iconGrid = blessed.box({
    parent: frame.body,
    top: 2,
    left: 0,
    width: viewMode === "icon" ? "100%" : `${PREVIEW_SPLIT_RATIO}%`,
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
  // Vertical divider between list and preview
  const divider = blessed.box({
    parent: frame.body,
    top: 2,
    left: `${PREVIEW_SPLIT_RATIO}%`,
    width: 1,
    bottom: 1,
    style: { fg: theme().muted.fg || "gray", bg: theme().body.bg },
    content: "",
    hidden: viewMode === "icon"
  });
  // Fill divider with thin line chars on resize
  const fillDivider = () => {
    const h = Number(divider.height) || 20;
    divider.setContent("\u2502".repeat(h).split("").join("\n"));
  };

  // Fixed preview header bar
  const previewHeaderBar = blessed.box({
    parent: frame.body,
    top: 2,
    left: `${PREVIEW_SPLIT_RATIO}%+1`,
    right: 0,
    height: 1,
    tags: true,
    style: { ...theme().footer, bold: true },
    hidden: viewMode === "icon"
  });

  const preview = blessed.box({
    parent: frame.body,
    top: 3,
    left: `${PREVIEW_SPLIT_RATIO}%+1`,
    right: 0,
    bottom: 1,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    tags: true,
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

  /** Build a breadcrumb from currentPath relative to startPath */
  const renderBreadcrumb = (): string => {
    const home = params.startPath;
    const rel = path.relative(home, currentPath);
    if (!rel || rel === ".") return "\u2302 ~";
    const parts = rel.split(path.sep);
    return "\u2302 ~ / " + parts.join(" / ");
  };

  const renderStatusBar = () => {
    const dirs = entries.filter((e) => e.isDirectory && e.label !== "../").length;
    const files = entries.filter((e) => !e.isDirectory).length;
    // Total size of visible files
    const totalSize = entries.filter(e => !e.isDirectory).reduce((s, e) => s + e.size, 0);
    const sizeStr = totalSize < 1024 ? `${totalSize}B`
      : totalSize < 1048576 ? `${(totalSize / 1024).toFixed(0)}K`
      : `${(totalSize / 1048576).toFixed(1)}M`;
    const macHints = isMac ? " SPC:look O:finder" : "";
    const sortArrow = sortField === "name" ? "\u25B2 Name" : sortField === "size" ? "\u25B2 Size" : sortField === "modified" ? "\u25B2 Date" : "\u25B2 Type";
    // Git summary
    let gitSummary = "";
    if (gitRoot) {
      const modified = [...gitStatusMap.values()].filter(s => s === "M").length;
      const untracked = [...gitStatusMap.values()].filter(s => s === "?").length;
      const added = [...gitStatusMap.values()].filter(s => s === "A").length;
      const parts: string[] = [];
      if (modified) parts.push(`${modified}M`);
      if (added) parts.push(`${added}A`);
      if (untracked) parts.push(`${untracked}?`);
      gitSummary = parts.length ? ` git:${parts.join("/")}` : " git:clean";
    }
    statusInfo.setContent(` ${entries.length} items \u2502 ${dirs} dirs, ${files} files (${sizeStr})${gitSummary} \u2502 ${sortArrow} \u2502 \u21B5:open V:view C:copy${macHints} S:search q:close`);
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
      previewRawContent = [
        "",
        "       {bold}\u2302 WibWob File Manager{/bold}",
        "",
        "       Select a file to preview",
        "       or press {bold}S{/bold} to search",
        "",
        "       {gray-fg}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{/gray-fg}",
        "",
        "       {gray-fg}Keys:{/gray-fg}",
        "       {bold}\u21B5{/bold}  Open in editor",
        "       {bold}V{/bold}  View file",
        "       {bold}SPC{/bold} Quick Look",
        "       {bold}C{/bold}  Copy path",
        "       {bold}O{/bold}  Reveal in Finder",
        "       {bold}/{/bold}  Filter files",
        "       {bold}S{/bold}  Search contents",
        "       {bold}TAB{/bold} Toggle icon view",
        "",
        "       {gray-fg}Right-click for menu{/gray-fg}",
      ].join("\n");
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }
    if (entry.isDirectory) {
      // Directory preview: show contents summary instead of crashing
      try {
        const dirPath = entry.fullPath;
        const children = fs.readdirSync(dirPath, { withFileTypes: true });
        const childDirs = children.filter(c => c.isDirectory());
        const childFiles = children.filter(c => !c.isDirectory());
        setPreviewHeader(`{bold}\u2302 ${path.basename(dirPath)}/{/bold}  {cyan-fg}${childDirs.length} dirs{/cyan-fg}, {green-fg}${childFiles.length} files{/green-fg}`);
        const header = "";
        // Show more items based on available preview height
        const previewH = Math.max(10, Number(preview.height) || 30);
        const maxDirs = Math.min(childDirs.length, Math.max(8, Math.floor(previewH * 0.4)));
        const maxFiles = Math.min(childFiles.length, Math.max(8, Math.floor(previewH * 0.4)));

        const dirItems = childDirs.slice(0, maxDirs).map(c => {
          let childCount = "";
          try {
            const n = fs.readdirSync(path.join(dirPath, c.name)).length;
            childCount = ` {gray-fg}(${n}){/gray-fg}`;
          } catch {}
          return `  {cyan-fg}\u25A0{/cyan-fg} ${c.name}/${childCount}`;
        });
        const fileItems = childFiles.slice(0, maxFiles).map(c => {
          const ext = path.extname(c.name).toLowerCase();
          const col = [".md", ".txt"].includes(ext) ? "green"
            : [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? "yellow"
            : [".json", ".yaml", ".yml"].includes(ext) ? "magenta"
            : [".sh", ".bash"].includes(ext) ? "cyan"
            : "white";
          // Try to get size
          let sizeStr = "";
          try {
            const s = fs.statSync(path.join(dirPath, c.name)).size;
            sizeStr = s < 1024 ? `${s}B` : s < 1048576 ? `${(s / 1024).toFixed(0)}K` : `${(s / 1048576).toFixed(1)}M`;
          } catch {}
          const padded = sizeStr ? ` {gray-fg}${sizeStr}{/gray-fg}` : "";
          return `  {${col}-fg}\u2022{/${col}-fg} ${c.name}${padded}`;
        });
        const truncDirs = childDirs.length > maxDirs ? `  {cyan-fg}... +${childDirs.length - maxDirs} more dirs{/cyan-fg}` : "";
        const truncFiles = childFiles.length > maxFiles ? `  {green-fg}... +${childFiles.length - maxFiles} more files{/green-fg}` : "";
        // File type distribution bar
        const extCounts: Record<string, number> = {};
        for (const f of childFiles) {
          const ext = path.extname(f.name).toLowerCase() || "(none)";
          extCounts[ext] = (extCounts[ext] ?? 0) + 1;
        }
        const extEntries = Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const extBar = extEntries.map(([ext, count]) => {
          const col = [".md", ".txt"].includes(ext) ? "green"
            : [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? "yellow"
            : [".json", ".yaml", ".yml"].includes(ext) ? "magenta"
            : [".sh", ".bash"].includes(ext) ? "cyan"
            : "white";
          return `{${col}-fg}${ext}:${count}{/${col}-fg}`;
        }).join("  ");

        const sections = [header];
        if (dirItems.length) sections.push(dirItems.join("\n"));
        if (truncDirs) sections.push(truncDirs);
        if (fileItems.length) sections.push("\n" + fileItems.join("\n"));
        if (truncFiles) sections.push(truncFiles);
        if (extBar) sections.push("\n  " + extBar);

        // Quick stats: largest files and most recent
        if (childFiles.length > 0) {
          const withStats = childFiles.map(c => {
            try {
              const s = fs.statSync(path.join(dirPath, c.name));
              return { name: c.name, size: s.size, mtime: s.mtimeMs };
            } catch { return { name: c.name, size: 0, mtime: 0 }; }
          });
          const largest = [...withStats].sort((a, b) => b.size - a.size).slice(0, 3);
          const recent = [...withStats].sort((a, b) => b.mtime - a.mtime).slice(0, 3);

          const fmtSize = (s: number) => s < 1024 ? `${s}B` : s < 1048576 ? `${(s / 1024).toFixed(0)}K` : `${(s / 1048576).toFixed(1)}M`;
          const fmtDate = (ms: number) => {
            const d = new Date(ms);
            const now = Date.now();
            const diff = now - ms;
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          };

          sections.push(`\n  {bold}Largest:{/bold} ${largest.map(f => `${f.name} {gray-fg}${fmtSize(f.size)}{/gray-fg}`).join(", ")}`);
          sections.push(`  {bold}Recent:{/bold}  ${recent.map(f => `${f.name} {gray-fg}${fmtDate(f.mtime)}{/gray-fg}`).join(", ")}`);
        }

        previewRawContent = sections.join("\n");
      } catch (error) {
        previewRawContent = `\u2302 ${entry.fullPath}\n\n  Cannot read directory.\n  ${error instanceof Error ? error.message : String(error)}`;
      }
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }

    const ext = path.extname(entry.label).toLowerCase();

    // Markdown files: render with markdown service
    if (ext === ".md") {
      try {
        const stat = fs.statSync(entry.fullPath);
        const sizeStr = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(0)}K`;
        setPreviewHeader(`{bold}${path.basename(entry.fullPath)}{/bold}  ${sizeStr}  MD`);
        const previewWidth = Math.max(1, (Number(preview.width) || 40) - 4);
        const lines = renderMarkdownFile(entry.fullPath, previewWidth, {
          headingConfig: PLAIN_HEADING_CONFIG,
        });
        previewRawContent = lines.join("\n");
      } catch (error) {
        setPreviewHeader(`{bold}${path.basename(entry.fullPath)}{/bold}`);
        previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
      }
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }

    // JSON files: pretty-print with colour
    if (ext === ".json") {
      const escapeBraces = (s: string) => s.replace(/\{/g, "\\{");
      try {
        const raw = (safeReadFile(entry.fullPath) ?? "").slice(0, 8000);
        const parsed = JSON.parse(raw);
        const pretty = JSON.stringify(parsed, null, 2);
        const lines = pretty.split("\n");
        const stat = fs.statSync(entry.fullPath);
        const sizeStr = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(0)}K`;
        setPreviewHeader(`{bold}${path.basename(entry.fullPath)}{/bold}  ${sizeStr}  JSON`);
        // Colourize JSON keys and values
        const coloured = lines.map((ln: string, i: number) => {
          const safe = escapeBraces(ln);
          return `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${safe}`;
        }).join("\n");
        previewRawContent = coloured;
      } catch {
        const content = (safeReadFile(entry.fullPath) ?? "").slice(0, 8000);
        const lines = content.split("\n");
        const numbered = lines.map((ln: string, i: number) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${escapeBraces(ln)}`).join("\n");
        setPreviewHeader(`{bold}${path.basename(entry.fullPath)}{/bold}`);
        previewRawContent = numbered;
      }
      setViewportContent(preview, previewRawContent);
      params.screen.render();
      return;
    }

    // Default: raw text with line numbers + file metadata header
    // Use syntax highlighting for supported languages
    try {
      const content = safeReadFile(entry.fullPath) ?? "";
      const rawLines = content.slice(0, 8000).split("\n");
      const stat = fs.statSync(entry.fullPath);
      const sizeStr = stat.size < 1024 ? `${stat.size}B` : stat.size < 1048576 ? `${(stat.size / 1024).toFixed(1)}KB` : `${(stat.size / 1048576).toFixed(1)}MB`;
      const dateStr = new Date(stat.mtimeMs).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const escaped = (ln: string) => ln.replace(/\{/g, "\\{");
      const langLabel = ext.replace(".", "").toUpperCase();
      setPreviewHeader(`{bold}${path.basename(entry.fullPath)}{/bold}  ${sizeStr}  ${dateStr}  ${langLabel}`);

      // Determine language from extension
      const lang = ext.replace(".", "");
      const useHighlight = HIGHLIGHTED_LANGUAGES.has(lang);

      let numbered: string;
      if (useHighlight) {
        const highlighted = highlightCode(rawLines.join("\n"), lang);
        numbered = highlighted.map((ln, i) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${ln}`).join("\n");
      } else {
        numbered = rawLines.map((ln, i) => `{gray-fg}${String(i + 1).padStart(4, " ")} |{/gray-fg} ${escaped(ln)}`).join("\n");
      }
      previewRawContent = numbered;
    } catch (error) {
      setPreviewHeader("");
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  /** Set the fixed preview header bar content */
  const setPreviewHeader = (text: string) => {
    previewHeaderBar.setContent(` ${text}`);
  };

  const updatePreviewForSearchResult = (result: { file: string; line: number; text: string }) => {
    try {
      const content = safeReadFile(result.file) ?? "";
      const lines = content.split("\n");
      const startLine = Math.max(0, result.line - 5);
      const endLine = Math.min(lines.length, result.line + 20);
      const ext = path.extname(result.file).toLowerCase();
      const stat = fs.statSync(result.file);
      const sizeStr = stat.size < 1024 ? `${stat.size}B` : stat.size < 1048576 ? `${(stat.size / 1024).toFixed(0)}K` : `${(stat.size / 1048576).toFixed(1)}M`;
      const escaped = (s: string) => s.replace(/\{/g, "\\{");
      const context = lines.slice(startLine, endLine)
        .map((ln, i) => {
          const lineNum = startLine + i + 1;
          const isMatch = lineNum === result.line;
          const marker = isMatch ? "{yellow-fg}\u25B6{/yellow-fg}" : " ";
          const numCol = isMatch ? "yellow" : "gray";
          return `${marker}{${numCol}-fg}${String(lineNum).padStart(4, " ")} |{/${numCol}-fg} ${escaped(ln)}`;
        })
        .join("\n");
      const relPath = path.relative(currentPath, result.file);
      setPreviewHeader(`{bold}${escaped(relPath)}{/bold}  ${sizeStr}  line ${result.line}`);
      previewRawContent = context;
    } catch (error) {
      setPreviewHeader("");
      previewRawContent = `Cannot preview file.\n\n${error instanceof Error ? error.message : String(error)}`;
    }
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  };

  // ── Filter + refresh ───────────────────────────────────

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`;
    return `${(bytes / 1048576).toFixed(1)}M`;
  };

  /** Get colour for a file type */
  const fileColour = (entry: { isDirectory: boolean; label: string }): string => {
    if (entry.isDirectory) return "cyan";
    const ext = path.extname(entry.label).toLowerCase();
    if ([".ts", ".tsx"].includes(ext)) return "yellow";
    if ([".js", ".jsx"].includes(ext)) return "yellow";
    if ([".md"].includes(ext)) return "green";
    if ([".txt", ".doc", ".rtf"].includes(ext)) return "green";
    if ([".json"].includes(ext)) return "magenta";
    if ([".yaml", ".yml", ".toml"].includes(ext)) return "magenta";
    if ([".sh", ".bash", ".zsh"].includes(ext)) return "cyan";
    if ([".css", ".scss"].includes(ext)) return "blue";
    if ([".png", ".jpg", ".gif", ".svg"].includes(ext)) return "red";
    if ([".lock"].includes(ext)) return "gray";
    return "white";
  };

  const formatListItem = (e: typeof entries[0]): string => {
    const icon = fileIcon(e);
    const col = fileColour(e);
    const git = gitIndicator(e.fullPath);
    const listW = Math.max(1, Number(list.width) || 40);
    const safeName = e.label.replace(/\{/g, "\\{");
    if (e.isDirectory) {
      return `${git}{${col}-fg}${icon}{/${col}-fg} ${safeName}`;
    }
    const size = formatSize(e.size);
    const iconVisualLen = icon.length;
    // git indicator is 2 visual chars (status + space)
    const nameSpace = Math.max(10, listW - iconVisualLen - size.length - 7);
    const name = safeName.length > nameSpace ? safeName.slice(0, nameSpace - 2) + ".." : safeName.padEnd(nameSpace);
    return `${git}{${col}-fg}${icon}{/${col}-fg} ${name} {gray-fg}${size}{/gray-fg}`;
  };

  const applyFilter = (selectedIndex = 0) => {
    const normalized = filterValue.trim().toLowerCase();
    entries = normalized.length === 0
      ? [...allEntries]
      : allEntries.filter((entry) => entry.label.toLowerCase().includes(normalized));
    if (viewMode === "list") {
      list.setItems(entries.map(formatListItem));
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
    refreshGitStatus(directoryPath);
    allEntries = buildEntries(directoryPath);
    const dirName = path.basename(directoryPath) || directoryPath;
    let branchTag = "";
    if (gitRoot) {
      try {
        const branch = execSync("git branch --show-current", { cwd: directoryPath, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
        if (branch) branchTag = ` \u2387 ${branch}`;
      } catch {}
    }
    frame.frame.setLabel(` \u2302 ${dirName}${branchTag} `);
    // Show breadcrumb with file type summary
    const bc = renderBreadcrumb();
    pathLabel.setContent(` 📁 File Manager │ ${bc}`);
    applyFilter(selectedIndex);
  };

  // ── Search ─────────────────────────────────────────────

  const cancelSearch = () => {
    if (activeSearchProcess) {
      activeSearchProcess.kill();
      activeSearchProcess = null;
    }
    searchActive = false;
    const dirName = path.basename(currentPath) || currentPath;
    frame.frame.setLabel(` \u2302 ${dirName} `);
  };

  const showSearchResults = () => {
    searchActive = true;
    if (searchResults.length === 0) {
      list.setItems(["  {gray-fg}(no results){/gray-fg}"]);
      previewRawContent = searchQuery
        ? `{bold}Search: "${searchQuery.replace(/\{/g, "\\{")}"{/bold}\n\n  No matches found in ${path.basename(currentPath)}/\n\n  Try a different query or navigate to another directory.`
        : EMPTY_MATCHES;
      setViewportContent(preview, previewRawContent);
    } else {
      // Colour-coded results: file in cyan, line in yellow, text in white
      const listW = Math.max(1, Number(list.width) || 40);
      const items = searchResults.map((r) => {
        const rel = path.relative(currentPath, r.file);
        const ext = path.extname(rel).toLowerCase();
        const fileCol = [".md", ".txt"].includes(ext) ? "green"
          : [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? "yellow"
          : [".json", ".yaml", ".yml"].includes(ext) ? "magenta"
          : "cyan";
        const safeText = r.text.trim().slice(0, 50).replace(/\{/g, "\\{");
        return ` {${fileCol}-fg}${rel}{/${fileCol}-fg}{gray-fg}:${r.line}{/gray-fg} ${safeText}`;
      });
      list.setItems(items);
      list.select(0);
      updatePreviewForSearchResult(searchResults[0]);
      // Update preview header with search info
      frame.frame.setLabel(` \u2315 "${searchQuery}" - ${searchResults.length} results `);
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
    list.setItems(["  {yellow-fg}Searching...{/yellow-fg}"]);
    frame.frame.setLabel(` \u2315 "${query}" `);
    previewRawContent = `{bold}Searching for "${query.replace(/\{/g, "\\{")}"{/bold}\n\n  Directory: ${path.basename(currentPath)}/\n  Engine: ripgrep (rg)\n\n  {gray-fg}Results will appear as they are found...{/gray-fg}`;
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
      divider.hidden = false;
      previewHeaderBar.hidden = false;
      // Restore split layout
      list.width = `${PREVIEW_SPLIT_RATIO}%`;
      filterBox.width = `${PREVIEW_SPLIT_RATIO}%`;
      searchBox.left = `${PREVIEW_SPLIT_RATIO}%`;
      preview.hidden = false;
      fillDivider();
      // Sync selection from icon -> list
      list.select(iconSelected);
      applyFilter(iconSelected);
      list.focus();
    } else {
      list.hidden = true;
      iconGrid.hidden = false;
      divider.hidden = true;
      previewHeaderBar.hidden = true;
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

  // ── File actions ────────────────────────────────────────

  const getEntryPath = (index?: number): string | null => {
    if (searchActive) {
      const idx = typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0;
      return searchResults[idx]?.file ?? null;
    }
    const entry = entries[typeof index === "number" ? index : (list as List & { selected: number }).selected ?? 0];
    return entry?.fullPath ?? null;
  };

  const copyPathToClipboard = (index?: number) => {
    const filePath = getEntryPath(index);
    if (!filePath) return;
    if (copyToClipboard(filePath)) {
      params.overlays.flash(`Copied: ${path.basename(filePath)}`);
    } else {
      params.overlays.flash("Clipboard not available");
    }
  };

  const revealInFinder = (index?: number) => {
    const filePath = getEntryPath(index);
    if (!filePath) return;
    try {
      if (process.platform === "darwin") {
        execSync(`open -R ${JSON.stringify(filePath)}`);
      } else {
        execSync(`xdg-open ${JSON.stringify(path.dirname(filePath))} 2>/dev/null`);
      }
    } catch {
      params.overlays.flash("Could not reveal file");
    }
  };

  const isMac = process.platform === "darwin";

  /** Quick Look preview (macOS) or xdg-open (Linux) */
  const quickLook = (index?: number) => {
    const filePath = getEntryPath(index);
    if (!filePath) return;
    try {
      if (isMac) {
        // qlmanage blocks — run detached
        require("node:child_process").spawn("qlmanage", ["-p", filePath], {
          detached: true, stdio: "ignore",
        }).unref();
      } else {
        require("node:child_process").spawn("xdg-open", [filePath], {
          detached: true, stdio: "ignore",
        }).unref();
      }
    } catch {
      params.overlays.flash("Could not preview file");
    }
  };

  // ── Right-click context menu ───────────────────────────

  let contextMenuBox: blessed.Widgets.BoxElement | null = null;

  const showContextMenu = (x: number, y: number, filePath: string) => {
    closeContextMenu();
    const isDir = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
    const items = [
      { label: " Copy Path        c ", action: () => copyPathToClipboard() },
      ...(!isDir ? [{ label: " Open in Editor  \u21B5 ", action: () => { const e = getSelectedEntry(); if (e && !e.isDirectory) params.onOpenFile(e.fullPath); } }] : []),
      ...(!isDir ? [{ label: " Quick Look   spc ", action: () => quickLook() }] : []),
      ...(!isDir ? [{ label: " View            v ", action: () => viewSelected() }] : []),
      ...(isMac ? [{ label: " Reveal in Finder o ", action: () => revealInFinder() }] : []),
    ];

    const menuW = 24;
    const menuH = items.length + 2;
    const screenW = Number(params.screen.width) || 80;
    const screenH = Number(params.screen.height) || 24;
    const menuX = Math.min(x, screenW - menuW - 2);
    const menuY = Math.min(y, screenH - menuH - 2);

    contextMenuBox = blessed.box({
      parent: params.screen,
      top: menuY,
      left: menuX,
      width: menuW,
      height: menuH,
      border: "line",
      style: { ...theme().footer, border: { fg: theme().accent.fg } },
      tags: true,
      mouse: true,
      keys: true,
    });

    const menuList = blessed.list({
      parent: contextMenuBox,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      items: items.map(i => i.label),
      style: { ...theme().body, selected: theme().selected },
    });

    menuList.on("select", (_item: any, index: number) => {
      closeContextMenu();
      items[index]?.action();
    });

    menuList.on("keypress", (_ch: any, key: any) => {
      if (key.name === "escape" || key.name === "q") {
        closeContextMenu();
      }
    });

    menuList.on("blur", () => {
      closeContextMenu();
    });

    menuList.focus();
    params.screen.render();
  };

  const closeContextMenu = () => {
    if (contextMenuBox) {
      contextMenuBox.destroy();
      contextMenuBox = null;
      params.screen.render();
    }
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

  // Update preview on keyboard selection (up/down/j/k)
  list.on("select", (_, index) => {
    if (searchActive && searchResults[index]) {
      updatePreviewForSearchResult(searchResults[index]);
    } else {
      updatePreview(index);
    }
  });

  // Update preview on mouse click — "select item" fires on any selection change including clicks
  list.on("select item", () => {
    const idx = (list as List & { selected: number }).selected ?? 0;
    if (searchActive && searchResults[idx]) {
      updatePreviewForSearchResult(searchResults[idx]);
    } else {
      updatePreview(idx);
    }
  });

  // Right-click context menu on list items
  list.on("element click", (_el: any, mouse: any) => {
    if (mouse && (mouse.button === "right" || mouse.button === 2)) {
      const filePath = getEntryPath();
      if (filePath) {
        showContextMenu(mouse.x ?? 0, mouse.y ?? 0, filePath);
      }
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
    if (key.name === "space") {
      quickLook();
      return;
    }
    if (key.name === "c" && !key.ctrl && !key.meta) {
      copyPathToClipboard();
      return;
    }
    if (key.name === "o" && !key.ctrl && !key.meta) {
      revealInFinder();
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
      openSearchPrompt();
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
  // Debounce filter keypress to prevent blessed double-fire
  let lastFilterKey = 0;
  filterBox.on("keypress", (ch, key) => {
    const now = Date.now();
    if (now - lastFilterKey < 30) return; // debounce < 30ms = duplicate
    lastFilterKey = now;

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
      openSearchPrompt();
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
  // Search box click → open the overlay prompt instead of inline typing
  searchBox.on("click", () => {
    openSearchPrompt();
  });
  searchBox.on("keypress", (_ch: string, key: { name: string }) => {
    // Any keypress on the focused search box redirects to overlay or escapes
    if (key.name === "escape") {
      focusContentPane();
      params.screen.render();
      return;
    }
    if (key.name === "tab") {
      filterBox.focus();
      renderFilter();
      params.screen.render();
      return;
    }
    // All other keys → open the overlay prompt
    openSearchPrompt();
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
    if (key.name === "space") {
      quickLook(iconSelected);
      return;
    }
    if (key.name === "c" && !key.ctrl && !key.meta) {
      copyPathToClipboard(iconSelected);
      return;
    }
    if (key.name === "o" && !key.ctrl && !key.meta) {
      revealInFinder(iconSelected);
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
      openSearchPrompt();
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
  frame.captureText = () => {
    const lines = entries.map(e => e.label);
    return `File Manager: ${currentPath}\n${lines.join("\n")}`;
  };
  frame.describeState = () => ({
    appType: "file-manager",
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
    if (viewMode === "icon") {
      iconGrid.focus();
    } else {
      list.focus();
    }
  };
  frame.onRestyle = createRestyleBundle([
    [toolbar, () => theme().header],
    [pathLabel, () => theme().header],
    [btnFilter, () => theme().footer],
    [btnSearch, () => theme().footer],
    [btnView, () => theme().footer],
    [filterBox, () => theme().footer],
    [searchBox, () => theme().footer],
    [list, () => ({ ...theme().body, selected: theme().selected })],
    [iconGrid, () => theme().body],
    [preview, () => theme().body],
    [statusBar, () => theme().footer],
    [statusInfo, () => theme().footer],
    [btnSort, () => theme().footer],
    [btnRefresh, () => theme().footer],
  ]).restyle;

  // Expose FinderController for command dispatch
  frame.finder = {
    search: (query: string, glob?: string) => {
      searchQuery = query;
      if (searchMode === "simple") {
        runSimpleSearch(query, glob);
      } else {
        runAdvancedSearch(query);
      }
      params.onStateChanged?.();
    },
    navigateTo: (dirPath: string) => {
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        navigateTo(dirPath);
        params.onStateChanged?.();
      } else {
        params.overlays.flash(`Not a directory: ${dirPath}`);
      }
    },
    toggleView: () => {
      toggleViewMode();
      params.onStateChanged?.();
    },

    refresh: () => {
      navigateTo(currentPath);
      params.onStateChanged?.();
    },
    sortBy: (field: "name" | "size" | "modified" | "type") => {
      sortField = field;
      navigateTo(currentPath);
      params.onStateChanged?.();
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
    fillDivider();
    setViewportContent(preview, previewRawContent);
    params.screen.render();
  });
  navigateTo(initialPath, params.restore?.selectedIndex ?? 0);
  fillDivider();
  renderSearchBox();
  frame.focus();
}


/**
 * Simple browser reader — reads a local file and opens it as a text viewer.
 * Relocated from figlet-windows.ts during host→microapp migration.
 */

