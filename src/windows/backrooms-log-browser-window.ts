import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";

import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
import { createSelectableList } from "../core/ui-parts.js";
import { createFilePathMenuItems } from "../core/context-menu-items.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import { theme } from "../core/theme/resolver.js";
import type { WindowManager } from "../core/window-manager.js";
import type { WindowRecord } from "../core/types.js";

interface LogEntry {
  name: string;
  path: string;
  mtime: number;
  size: number;
  live: boolean;
}

function scanLogs(logsDir: string): LogEntry[] {
  if (!fs.existsSync(logsDir)) return [];
  return fs.readdirSync(logsDir)
    .filter(f => f.endsWith(".txt"))
    .map(f => {
      const full = path.join(logsDir, f);
      const stat = fs.statSync(full);
      const ageSec = (Date.now() - stat.mtimeMs) / 1000;
      return {
        name: f.replace(/\.txt$/, ""),
        path: full,
        mtime: stat.mtimeMs,
        size: stat.size,
        live: ageSec < 30
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Strip ISO timestamp prefix from log filenames for display. */
function displayName(name: string): string {
  // Filenames like "2026-02-28T14-36-18-164Z_liminal-fluorescent-maze"
  return name.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z?_/, "");
}

function formatEntry(entry: LogEntry, width: number): string {
  const time = new Date(entry.mtime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const status = entry.live ? " ●" : "";
  const fixedWidth = 7 + status.length + 1;
  const slug = displayName(entry.name);
  const slugWidth = Math.max(8, width - fixedWidth);
  const display = slug.length > slugWidth
    ? slug.slice(0, slugWidth - 1) + "…"
    : slug.padEnd(slugWidth, " ");
  return `${time} ${display}${status}`;
}

export function openBackroomsLogBrowserWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  logsDir: string;
  onOpenReplay: (logPath: string, theme: string) => void;
  onSaveSnippet: (title: string, content: string) => void;
  onStateChanged?: () => void;
}): void {
  const frame = params.windowManager.createFrame("Backrooms Logs", "browser");

  let entries = scanLogs(params.logsDir);
  let selectedIndex = 0;
  let previewContent = "";
  let previewScrollPositions = new Map<string, number>();

  const LIST_WIDTH = "25%";
  const DIVIDER_LEFT = "25%";
  const CONTENT_LEFT = "25%+1";

  // Left pane — log list
  const listHandle = createSelectableList({
    parent: frame.body,
    top: 0,
    left: 0,
    width: LIST_WIDTH,
    bottom: 0,
    style: { ...theme().body, selected: theme().selected, item: theme().body },
  });
  const list = listHandle.node;

  // Divider
  const divider = blessed.box({
    parent: frame.body,
    top: 0,
    left: DIVIDER_LEFT,
    width: 1,
    bottom: 0,
    content: "",
    style: theme().muted
  });

  // Header row 1 — title/theme
  const titleBar = blessed.box({
    parent: frame.body,
    top: 0,
    left: CONTENT_LEFT,
    right: 0,
    height: 1,
    style: { ...theme().body, bold: true },
    content: ""
  });

  // Header row 2 — file path (right-clickable)
  const pathBar = blessed.box({
    parent: frame.body,
    top: 1,
    left: CONTENT_LEFT,
    right: 0,
    height: 1,
    mouse: true,
    style: theme().muted,
    content: ""
  });

  // Click path bar → copy path to clipboard. Simple, no overlay.
  let currentPath = "";
  pathBar.on("click", () => {
    if (currentPath) {
      const items = createFilePathMenuItems(currentPath);
      // Execute the first action (Copy Path) directly
      items[0]?.action();
      params.overlays.flash("Path copied to clipboard");
    }
  });

  // Right pane — preview
  const preview = blessed.box({
    parent: frame.body,
    top: 2,
    left: CONTENT_LEFT,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: false,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    content: "",
    style: theme().body
  });

  function refreshList() {
    entries = scanLogs(params.logsDir);
    const listWidth = Math.max(20, Math.floor(Number(frame.body.width) * 0.25));
    (list as any).setItems(entries.map(e => formatEntry(e, listWidth)));
    if (entries.length > 0) {
      list.select(Math.min(selectedIndex, entries.length - 1));
    }
    params.onStateChanged?.();
    params.screen.render();
  }

  function loadPreview() {
    const entry = entries[selectedIndex];
    if (!entry) {
      titleBar.setContent("");
      pathBar.setContent("");
      preview.setContent("(no logs)");
      previewContent = "";
      currentPath = "";
      params.screen.render();
      return;
    }
    titleBar.setContent(` ${displayName(entry.name)}`);
    pathBar.setContent(` ${entry.path}`);
    currentPath = entry.path;
    try {
      previewContent = fs.readFileSync(entry.path, "utf8");
    } catch {
      previewContent = "(could not read file)";
    }
    preview.setContent(previewContent);

    if (entry.live) {
      // Auto-scroll to bottom for live files
      preview.setScrollPerc(100);
    } else {
      // Restore saved scroll position
      const saved = previewScrollPositions.get(entry.path);
      if (saved !== undefined) {
        (preview as any).scrollTo(saved);
      } else {
        (preview as any).scrollTo(0);
      }
    }
    params.screen.render();
  }

  // Save scroll position when navigating away
  function saveScrollPos() {
    const entry = entries[selectedIndex];
    if (entry && !entry.live) {
      previewScrollPositions.set(entry.path, (preview as any).getScroll?.() ?? 0);
    }
  }

  list.on("select item", (_item: any, index: number) => {
    saveScrollPos();
    selectedIndex = index;
    loadPreview();
    params.onStateChanged?.();
  });

  // Keybindings
  list.key(["enter"], () => {
    const entry = entries[selectedIndex];
    if (entry) {
      params.onOpenReplay(entry.path, entry.name);
    }
  });

  list.key(["s"], () => {
    const entry = entries[selectedIndex];
    if (entry && previewContent) {
      params.onSaveSnippet(entry.name, previewContent);
    }
  });

  list.key(["r"], refreshList);
  list.key(["escape", "q"], () => frame.close());

  // Auto-refresh every 2 seconds
  const refreshTimer = setInterval(() => {
    const prevCount = entries.length;
    entries = scanLogs(params.logsDir);
    if (entries.length !== prevCount) {
      refreshList();
    }
    // Re-read preview if current file is live
    const entry = entries[selectedIndex];
    if (entry?.live) {
      loadPreview();
    }
  }, 2000);

  frame.cleanup = () => {
    clearInterval(refreshTimer);
  };

  frame.describeState = () => {
    const entry = entries[selectedIndex];
    return {
      appType: "backrooms-log-browser",
      summary: `Backrooms log browser with ${entries.length} entries.`,
      selectedIndex,
      selectedTheme: entry?.name ?? "",
      selectedPath: entry?.path ?? "",
      selectedStatus: entry?.live ? "live" : "done",
      entryCount: entries.length,
      previewLines: previewContent.split("\n").length,
      contentPreview: previewContent.split("\n").slice(0, 20).join("\n")
    };
  };

  frame.captureText = () => previewContent;

  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    list.focus();
  };

  frame.onRestyle = () => {
    safeSetStyle(list, {
      ...theme().body,
      selected: theme().selected,
      item: theme().body
    });
    divider.style = theme().muted;
    titleBar.style = { ...theme().body, bold: true };
    pathBar.style = theme().muted;
    safeSetStyle(preview, theme().body);
  };

  params.windowManager.registerWindow(frame);
  refreshList();
  loadPreview();
  frame.focus();
}
