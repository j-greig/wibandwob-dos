/**
 * file-manager/window.ts — File Manager v3: Column Browser
 *
 * Entry point that creates the window and wires all extracted modules:
 * types, icons, git, preview, search, keys, columns.
 *
 * Replaces the 1858-line file-manager-window.ts god function.
 */
import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn as spawnProc } from "node:child_process";
import { copyToClipboard } from "../../core/clipboard.js";
import { safeReadFile } from "../../core/safe-fs.js";
import { theme } from "../../core/theme/resolver.js";
import { createScrollbar } from "../../core/ui-primitives.js";
import { createRestyleBundle, type RestyleEntry } from "../../ui/containers.js";
import { setViewportContent } from "../browser-utils.js";

import type { FileManagerParams, FileEntry, FileAction, SortField } from "./types.js";
import { SORT_CYCLE } from "./types.js";
import { formatSize, escapeBlessedTags } from "./icons.js";
import { createGitState, refreshGitStatus, gitSummary } from "./git.js";
import { renderEmptyPreview, renderDirectoryPreview, renderFilePreview } from "./preview.js";
import { createSearchEngine } from "./search.js";
import { keyToAction, isJumpChar, isActionChar } from "./keys.js";
import {
  createColumn, calculateColumnLayout, buildEntries, formatColumnItem,
  type ColumnWidget,
} from "./columns.js";

const IS_MAC = process.platform === "darwin";

// ── Main factory ─────────────────────────────────────────────────────────────

export function openFileManagerV3(params: FileManagerParams): void {
  const startPath = params.restore?.currentPath ?? params.startPath;
  const git = createGitState();
  let sortField: SortField = params.restore?.sortField ?? "name";
  let columnWidgets: ColumnWidget[] = [];
  let activeColumnIndex = 0;
  let previewContent = "";

  // ── Frame ──────────────────────────────────────────────────────────────────
  const frame = params.windowManager.createFrame("File Manager", "browser");
  {
    const screenW = Number(params.screen.width);
    const screenH = Number(params.screen.height);
    frame.frame.width = Math.min(180, Math.max(80, Math.floor(screenW * 0.85)));
    frame.frame.height = Math.max(30, screenH - 6);
  }

  // ── Breadcrumb bar ─────────────────────────────────────────────────────────
  const breadcrumb = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    mouse: true,
    style: { ...theme().footer, bold: true },
  });

  // ── Columns container ──────────────────────────────────────────────────────
  const columnsContainer = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    bottom: 1,
  });

  // ── Preview pane (rightmost) ───────────────────────────────────────────────
  const previewHeader = blessed.box({
    parent: columnsContainer,
    top: 0,
    right: 0,
    width: "40%",
    height: 1,
    tags: true,
    style: { ...theme().footer, bold: true },
  });

  const previewBox = blessed.box({
    parent: columnsContainer,
    top: 1,
    right: 0,
    width: "40%",
    bottom: 0,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    tags: true,
    style: theme().body,
  });

  // ── Status bar ─────────────────────────────────────────────────────────────
  // ── Status bar: info left, buttons right ─────────────────────────────────
  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: theme().footer,
  });
  const statusInfo = blessed.box({
    parent: statusBar,
    top: 0,
    left: 0,
    right: 42,
    height: 1,
    tags: true,
    style: theme().footer,
  });
  // Clickable button bar (right side)
  const btnStyle = { fg: theme().accent.fg, bg: theme().footer.bg ?? theme().body.bg };
  const buttons = [
    { label: " \u2195Sort ", action: () => dispatchAction("sort-cycle"), width: 7 },
    { label: " \u21BBRefr ", action: () => dispatchAction("refresh"), width: 7 },
    { label: " Edit ", action: () => dispatchAction("edit"), width: 6 },
    { label: " Ext\u2197 ", action: () => dispatchAction("external-editor"), width: 6 },
    { label: " Yank ", action: () => dispatchAction("yank-contents"), width: 6 },
    { label: " Copy ", action: () => dispatchAction("copy-path"), width: 6 },
  ];
  let btnRight = 0;
  const buttonWidgets: blessed.Widgets.BoxElement[] = [];
  for (const btn of [...buttons].reverse()) {
    const w = blessed.box({
      parent: statusBar,
      top: 0,
      right: btnRight,
      width: btn.width,
      height: 1,
      content: btn.label,
      mouse: true,
      clickable: true,
      style: btnStyle,
    });
    w.on("click", btn.action);
    buttonWidgets.push(w);
    btnRight += btn.width;
  }

  // ── Search engine ──────────────────────────────────────────────────────────
  const search = createSearchEngine({
    onResults: (results) => {
      // TODO: display incremental search results
    },
    onComplete: (results) => {
      if (results.length === 0) {
        params.overlays.flash("No matches found");
      } else {
        params.overlays.flash(`${results.length} matches`);
      }
    },
    onError: (msg) => params.overlays.flash(msg),
  });

  // ── Git ────────────────────────────────────────────────────────────────────
  refreshGitStatus(git, startPath);

  // ── Column management ──────────────────────────────────────────────────────

  function navigateTo(dirPath: string, depth: number): void {
    // Remove columns deeper than `depth`
    while (columnWidgets.length > depth) {
      const removed = columnWidgets.pop()!;
      removed.destroy();
    }

    refreshGitStatus(git, dirPath);
    const bodyWidth = Number(columnsContainer.width) || 80;
    const previewW = Math.max(20, Math.floor(bodyWidth * 0.4));
    const layout = calculateColumnLayout(depth + 1, bodyWidth, previewW);

    // Create the new column
    const colLeft = (depth - layout.scrollOffset) * layout.columnWidth;
    const col = createColumn({
      parent: columnsContainer,
      screen: params.screen,
      git,
      sortField,
      onSelect: handleSelect,
      onOpenFile: (_, entry) => { params.onOpenFile(entry.fullPath); },
      onNavigateInto: handleNavigateInto,
      onNavigateUp: handleNavigateUp,
      onKeypress: handleColumnKeypress,
    }, depth, dirPath, Math.max(0, colLeft), layout.columnWidth);

    columnWidgets.push(col);
    wireContextMenuToColumn(col);
    activeColumnIndex = depth;

    // Reposition all visible columns
    repositionColumns();

    // Focus the new column
    col.list.focus();
    updateBreadcrumb();
    updateStatusBar();
    params.screen.render();
    params.onStateChanged();
  }

  function repositionColumns(): void {
    const bodyWidth = Number(columnsContainer.width) || 80;
    const previewW = Math.max(20, Math.floor(bodyWidth * 0.4));
    const layout = calculateColumnLayout(columnWidgets.length, bodyWidth, previewW);

    for (let i = 0; i < columnWidgets.length; i++) {
      const widget = columnWidgets[i]!;
      const visIdx = i - layout.scrollOffset;
      if (visIdx < 0 || visIdx >= layout.visibleColumns) {
        widget.list.hide();
      } else {
        widget.list.left = visIdx * layout.columnWidth;
        widget.list.width = layout.columnWidth;
        widget.list.show();
        // Dim non-active columns
        if (i === activeColumnIndex) {
          widget.list.style = { ...theme().body, selected: theme().selected, item: theme().body };
        } else {
          widget.list.style = { ...theme().body, selected: { ...theme().body, bold: true }, item: theme().body };
        }
        // Re-render items for new width (silent to prevent select→reposition loop)
        const entries = widget.state.entries;
        widget.setItemsSilent(entries.map(e => formatColumnItem(e, git, layout.columnWidth)));
        widget.list.select(widget.state.selectedIndex);
      }
    }

    // Position preview pane
    previewHeader.left = layout.previewLeft;
    previewHeader.width = bodyWidth - layout.previewLeft;
    previewBox.left = layout.previewLeft;
    previewBox.width = bodyWidth - layout.previewLeft;
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleSelect(columnIndex: number, entry: FileEntry): void {
    activeColumnIndex = columnIndex;
    // Remove any columns to the right
    while (columnWidgets.length > columnIndex + 1) {
      const removed = columnWidgets.pop()!;
      removed.destroy();
    }
    repositionColumns();

    if (entry.isDirectory) {
      const result = renderDirectoryPreview(entry.fullPath, Number(previewBox.height) || 20);
      previewHeader.setContent(` ${result.header}`);
      previewContent = result.content;
      setViewportContent(previewBox, previewContent);
    } else {
      const result = renderFilePreview(entry, Math.max(1, (Number(previewBox.width) || 40) - 2));
      previewHeader.setContent(` ${result.header}`);
      previewContent = result.content;
      setViewportContent(previewBox, previewContent);
    }
    updateBreadcrumb();
    updateStatusBar();
    params.screen.render();
  }

  function handleNavigateInto(columnIndex: number, dirPath: string): void {
    navigateTo(dirPath, columnIndex + 1);
  }

  function handleNavigateUp(): void {
    if (columnWidgets.length <= 1) return;
    const removed = columnWidgets.pop()!;
    removed.destroy();
    activeColumnIndex = columnWidgets.length - 1;
    repositionColumns();
    columnWidgets[activeColumnIndex]?.list.focus();
    updateBreadcrumb();
    updateStatusBar();
    params.screen.render();
  }

  // ── Action dispatch ────────────────────────────────────────────────────────

  function getSelectedEntry(): FileEntry | null {
    const col = columnWidgets[activeColumnIndex];
    if (!col) return null;
    return col.state.entries[col.state.selectedIndex] ?? null;
  }

  function getSelectedPath(): string | null {
    return getSelectedEntry()?.fullPath ?? null;
  }

  function dispatchAction(action: FileAction | string): void {
    const entry = getSelectedEntry();
    const filePath = entry?.fullPath ?? null;

    switch (action) {
      case "open":
        if (entry?.isDirectory) {
          handleNavigateInto(activeColumnIndex, entry.fullPath);
        } else if (filePath) {
          params.onOpenFile(filePath);
        }
        break;
      case "view":
        if (filePath && !entry?.isDirectory) params.onViewFile(filePath);
        break;
      case "edit":
        if (filePath && !entry?.isDirectory) params.onOpenFile(filePath);
        break;
      case "copy-path":
        if (filePath && copyToClipboard(filePath)) {
          params.overlays.flash(`Copied: ${path.basename(filePath)}`);
        }
        break;
      case "yank-contents":
        if (filePath && !entry?.isDirectory) {
          try {
            const content = fs.readFileSync(filePath, "utf8");
            if (copyToClipboard(content)) {
              params.overlays.flash(`Yanked ${content.split("\n").length} lines`);
            }
          } catch { params.overlays.flash("Could not read file"); }
        }
        break;
      case "external-editor":
        if (filePath) openInExternalEditor(filePath);
        break;
      case "reveal":
        if (filePath && IS_MAC) {
          try { execFileSync("open", ["-R", filePath]); } catch {}
        }
        break;
      case "quicklook":
        if (filePath && IS_MAC) {
          try { spawnProc("qlmanage", ["-p", filePath], { stdio: "ignore", detached: true }).unref(); } catch {}
        }
        break;
      case "navigate-up":
        handleNavigateUp();
        break;
      case "navigate-into":
        if (entry?.isDirectory) handleNavigateInto(activeColumnIndex, entry.fullPath);
        break;
      case "search-start": {
        const col = columnWidgets[activeColumnIndex];
        if (col) {
          params.overlays.flash("Search: type query (TODO: search overlay)");
        }
        break;
      }
      case "toggle-view":
        params.overlays.flash("Column view only (icon view removed in v3)");
        break;
      case "sort-cycle": {
        const idx = SORT_CYCLE.indexOf(sortField);
        sortField = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]!;
        // Rebuild all columns with new sort
        const paths = columnWidgets.map(w => ({ path: w.state.path, sel: w.state.selectedIndex }));
        destroyAllColumns();
        for (let i = 0; i < paths.length; i++) {
          navigateTo(paths[i]!.path, i);
        }
        break;
      }
      case "refresh": {
        const currentCol = columnWidgets[activeColumnIndex];
        if (currentCol) navigateTo(currentCol.state.path, activeColumnIndex);
        break;
      }
      case "context-menu": {
        // Show context menu near the active column's selected item
        const col = columnWidgets[activeColumnIndex];
        if (col) {
          const x = Number(col.list.aleft || 0) + 2;
          const y = Number(col.list.atop || 0) + (col.state.selectedIndex - (col.list.childBase || 0)) + 1;
          showContextMenu(x, y);
        }
        break;
      }
    }
  }

  function openInExternalEditor(filePath: string): void {
    const editors = [
      { cmd: "cursor", name: "Cursor" },
      { cmd: "code", name: "VS Code" },
      { cmd: "zed", name: "Zed" },
      { cmd: "subl", name: "Sublime" },
    ];
    for (const editor of editors) {
      try {
        execFileSync("which", [editor.cmd], { stdio: "ignore" });
        spawnProc(editor.cmd, [filePath], { stdio: "ignore", detached: true }).unref();
        params.overlays.flash(`Opened in ${editor.name}`);
        return;
      } catch {}
    }
    const env = process.env.VISUAL || process.env.EDITOR;
    if (env) {
      try {
        spawnProc(env, [filePath], { stdio: "ignore", detached: true }).unref();
        params.overlays.flash(`Opened in ${env}`);
        return;
      } catch {}
    }
    params.overlays.flash("No external editor found");
  }

  // ── Keyboard handler (forwarded from each column's list widget) ─────────────

  function handleColumnKeypress(ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg): void {
    // Left: go to parent column or navigate up
    if (key.name === "left") {
      if (activeColumnIndex > 0) {
        activeColumnIndex--;
        columnWidgets[activeColumnIndex]?.list.focus();
        const entry = getSelectedEntry();
        if (entry) handleSelect(activeColumnIndex, entry);
        params.screen.render();
      } else {
        handleNavigateUp();
      }
      return;
    }
    // Right: drill into selected dir or move to next column
    if (key.name === "right") {
      const entry = getSelectedEntry();
      if (entry?.isDirectory && entry.label !== "../") {
        handleNavigateInto(activeColumnIndex, entry.fullPath);
      } else if (activeColumnIndex < columnWidgets.length - 1) {
        activeColumnIndex++;
        columnWidgets[activeColumnIndex]?.list.focus();
        params.screen.render();
      }
      return;
    }

    // Action dispatch (e, Y, E, c, o, v, etc.)
    const action = keyToAction(ch, key);
    if (action) {
      dispatchAction(action);
      return;
    }

    // Jump-to-letter
    if (ch && isJumpChar(ch) && !isActionChar(ch)) {
      const col = columnWidgets[activeColumnIndex];
      if (!col) return;
      const entries = col.state.entries;
      const startIdx = col.state.selectedIndex + 1;
      const normalized = ch.toLowerCase();
      const ordered = [...entries.slice(startIdx), ...entries.slice(0, startIdx)];
      const match = ordered.find(e => e.label.toLowerCase().startsWith(normalized));
      if (match) {
        const idx = entries.indexOf(match);
        col.list.select(idx);
        col.state.selectedIndex = idx;
        handleSelect(activeColumnIndex, match);
      }
    }
  }

  // ── Context menu ────────────────────────────────────────────────────────────

  let contextMenuBox: blessed.Widgets.BoxElement | null = null;

  function closeContextMenu(): void {
    if (!contextMenuBox) return;
    const box = contextMenuBox;
    contextMenuBox = null; // null BEFORE destroy to prevent re-entry from blur
    box.destroy();
    params.screen.render();
  }

  function showContextMenu(x: number, y: number): void {
    closeContextMenu();
    const entry = getSelectedEntry();
    if (!entry) return;

    const items = [
      { label: " Open               \u21B5 ", action: () => dispatchAction("open") },
      { label: " Edit                e ", action: () => dispatchAction("edit") },
      ...(IS_MAC ? [{ label: " Quick Look        SPC ", action: () => dispatchAction("quicklook") }] : []),
      { label: " Copy Path           c ", action: () => dispatchAction("copy-path") },
      ...(!entry.isDirectory ? [{ label: " Yank Contents       Y ", action: () => dispatchAction("yank-contents") }] : []),
      { label: " External Editor     E ", action: () => dispatchAction("external-editor") },
      ...(IS_MAC ? [{ label: " Reveal in Finder    o ", action: () => dispatchAction("reveal") }] : []),
    ];

    const menuW = 26;
    const menuH = items.length + 2;
    const screenW = Number(params.screen.width) || 80;
    const screenH = Number(params.screen.height) || 24;
    const menuX = Math.min(x, screenW - menuW - 1);
    const menuY = Math.min(y, screenH - menuH - 1);

    contextMenuBox = blessed.box({
      parent: params.screen,
      top: menuY,
      left: menuX,
      width: menuW,
      height: menuH,
      border: { type: "line" },
      style: { ...theme().body, border: theme().windowBorderFocused },
      tags: true,
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
      tags: true,
      items: items.map(i => i.label),
      style: { ...theme().body, selected: theme().selected },
    } as blessed.Widgets.ListOptions<blessed.Widgets.ListElementStyle>);

    menuList.on("select", (_item: blessed.Widgets.BlessedElement, idx: number) => {
      items[idx]?.action();
      closeContextMenu();
    });
    menuList.on("keypress", (_ch: string, key: { name: string }) => {
      if (key.name === "escape" || key.name === "q") closeContextMenu();
    });
    menuList.on("blur", () => closeContextMenu());

    contextMenuBox.setFront();
    menuList.focus();
    params.screen.render();
  }

  // Wire right-click on each column
  function wireContextMenuToColumn(col: ColumnWidget): void {
    col.list.on("element click", (_el: blessed.Widgets.BlessedElement, mouse: { button?: string | number; x?: number; y?: number }) => {
      if (mouse && (mouse.button === "right" || mouse.button === 2)) {
        showContextMenu(mouse.x ?? 0, mouse.y ?? 0);
      }
    });
  }

  // ── UI updates ─────────────────────────────────────────────────────────────

  /** Segment boundaries for click detection: [{start, end, columnIndex}] */
  let breadcrumbSegments: Array<{ start: number; end: number; index: number }> = [];

  function updateBreadcrumb(): void {
    const parts: string[] = [];
    breadcrumbSegments = [];
    let cursor = 3; // " ⌂ " prefix
    for (let i = 0; i < columnWidgets.length; i++) {
      const name = path.basename(columnWidgets[i]!.state.path) || columnWidgets[i]!.state.path;
      const start = cursor;
      cursor += name.length;
      breadcrumbSegments.push({ start, end: cursor, index: i });
      if (i === activeColumnIndex) {
        parts.push(`{bold}${escapeBlessedTags(name)}{/bold}`);
      } else {
        parts.push(`{gray-fg}${escapeBlessedTags(name)}{/gray-fg}`);
      }
      if (i < columnWidgets.length - 1) {
        cursor += 3; // " / "
      }
    }
    breadcrumb.setContent(` \u2302 ${parts.join(" / ")}`);
  }

  breadcrumb.on("click", (data: { x?: number }) => {
    if (!data.x) return;
    const relX = data.x - (Number(breadcrumb.aleft) || 0);
    for (const seg of breadcrumbSegments) {
      if (relX >= seg.start && relX < seg.end) {
        // Collapse to this column depth
        while (columnWidgets.length > seg.index + 1) {
          const removed = columnWidgets.pop()!;
          removed.destroy();
        }
        activeColumnIndex = seg.index;
        repositionColumns();
        columnWidgets[activeColumnIndex]?.list.focus();
        updateBreadcrumb();
        updateStatusBar();
        // Update preview for selected item in this column
        const entry = getSelectedEntry();
        if (entry) handleSelect(activeColumnIndex, entry);
        params.screen.render();
        break;
      }
    }
  });

  function updateStatusBar(): void {
    const col = columnWidgets[activeColumnIndex];
    if (!col) return;
    const entries = col.state.entries.filter(e => e.label !== "../");
    const dirs = entries.filter(e => e.isDirectory).length;
    const files = entries.filter(e => !e.isDirectory).length;
    const totalSize = entries.filter(e => !e.isDirectory).reduce((s, e) => s + e.size, 0);
    const gs = gitSummary(git);
    const sortLabel = sortField.charAt(0).toUpperCase() + sortField.slice(1);
    statusInfo.setContent(
      ` ${entries.length} items | ${dirs} dirs, ${files} files (${formatSize(totalSize)})${gs} | \u2195${sortLabel}`,
    );
  }

  function destroyAllColumns(): void {
    for (const w of columnWidgets) w.destroy();
    columnWidgets = [];
  }

  // ── Frame wiring ───────────────────────────────────────────────────────────

  frame.describeState = () => ({
    appType: "file-manager" as const,
    summary: `Column browser: ${columnWidgets.map(w => path.basename(w.state.path)).join(" / ")}`,
    currentPath: columnWidgets[activeColumnIndex]?.state.path ?? startPath,
    columns: columnWidgets.map(w => ({ path: w.state.path, selectedIndex: w.state.selectedIndex })),
    sortField,
    selectedFile: getSelectedPath(),
  });

  frame.captureText = () => {
    const col = columnWidgets[activeColumnIndex];
    if (!col) return "";
    return col.state.entries.map(e => e.label).join("\n");
  };

  frame.finder = {
    search: (query, glob) => {
      const col = columnWidgets[activeColumnIndex];
      if (col) search.start(query, col.state.path, glob);
    },
    navigateTo: (dirPath) => navigateTo(dirPath, 0),
    toggleView: () => {},
    refresh: () => dispatchAction("refresh"),
    sortBy: (field) => { sortField = field; dispatchAction("refresh"); },
    getSelectedPath: () => getSelectedPath(),
    edit: () => dispatchAction("edit"),
    yankContents: () => dispatchAction("yank-contents"),
    copyPath: () => dispatchAction("copy-path"),
    openExternal: () => dispatchAction("external-editor"),
    quicklook: () => dispatchAction("quicklook"),
    reveal: () => dispatchAction("reveal"),
  };

  frame.onRestyle = createRestyleBundle([
    [breadcrumb, () => ({ ...theme().footer, bold: true })],
    [previewHeader, () => ({ ...theme().footer, bold: true })],
    [previewBox, () => theme().body],
    [statusBar, () => theme().footer],
    [statusInfo, () => theme().footer],
    ...buttonWidgets.map(w => [w, () => ({ fg: theme().accent.fg, bg: theme().footer.bg ?? theme().body.bg })] as RestyleEntry),
  ] as RestyleEntry[]).restyle;

  frame.cleanup = () => {
    frame.frame.removeAllListeners("resize");
    search.destroy();
    closeContextMenu();
    destroyAllColumns();
  };

  // Show empty preview
  const empty = renderEmptyPreview();
  previewHeader.setContent(` ${empty.header}`);
  setViewportContent(previewBox, empty.content);

  // Restore columns from saved state, or navigate to start path
  const savedColumns = params.restore?.columns;
  if (savedColumns && savedColumns.length > 0) {
    for (let i = 0; i < savedColumns.length; i++) {
      const saved = savedColumns[i]!;
      if (fs.existsSync(saved.path)) {
        navigateTo(saved.path, i);
        // Restore selection
        const col = columnWidgets[i];
        if (col && saved.selectedIndex !== undefined) {
          col.list.select(Math.min(saved.selectedIndex, col.state.entries.length - 1));
          col.state.selectedIndex = col.list.selected;
        }
      }
    }
    // Trigger preview for the last column's selection
    if (columnWidgets.length > 0) {
      const lastCol = columnWidgets[columnWidgets.length - 1]!;
      const entry = lastCol.state.entries[lastCol.state.selectedIndex];
      if (entry) handleSelect(columnWidgets.length - 1, entry);
    }
  } else {
    navigateTo(startPath, 0);
  }

  // Resize handler
  frame.frame.on("resize", () => {
    repositionColumns();
    params.screen.render();
  });
}
