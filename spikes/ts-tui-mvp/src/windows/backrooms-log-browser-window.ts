import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";

import { createScrollbar } from "../core/ui-primitives.js";
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

function formatEntry(entry: LogEntry, width: number): string {
  const time = new Date(entry.mtime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const kb = (entry.size / 1024).toFixed(1).padStart(6) + "kb";
  const status = entry.live ? " LIVE" : " DONE";
  const fixedWidth = 7 + 1 + kb.length + status.length + 2; // time + space + size + status + padding
  const slugWidth = Math.max(8, width - fixedWidth);
  const slug = entry.name.length > slugWidth
    ? entry.name.slice(0, slugWidth - 1) + "…"
    : entry.name.padEnd(slugWidth, " ");
  return `${time}  ${slug}  ${kb}${status}`;
}

export function openBackroomsLogBrowserWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  logsDir: string;
  onOpenReplay: (logPath: string, theme: string) => void;
  onSaveSnippet: (title: string, content: string) => void;
}): void {
  const frame = params.windowManager.createFrame("Backrooms Logs", "browser");

  let entries = scanLogs(params.logsDir);
  let selectedIndex = 0;
  let previewContent = "";
  let previewScrollPositions = new Map<string, number>();

  // Left pane — log list
  const list = blessed.list({
    parent: frame.body,
    top: 0,
    left: 0,
    width: "40%",
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: createScrollbar(),
    style: {
      fg: "white",
      bg: "black",
      selected: { fg: "black", bg: "cyan" },
      item: { fg: "white", bg: "black" }
    },
    items: []
  }) as blessed.Widgets.ListElement;

  // Divider
  blessed.box({
    parent: frame.body,
    top: 0,
    left: "40%",
    width: 1,
    bottom: 0,
    content: "",
    style: { fg: "#444444", bg: "#222222" }
  });

  // Header above preview
  const header = blessed.box({
    parent: frame.body,
    top: 0,
    left: "40%+1",
    right: 0,
    height: 1,
    style: { fg: "cyan", bg: "#111111" },
    content: ""
  });

  // Right pane — preview
  const preview = blessed.box({
    parent: frame.body,
    top: 1,
    left: "40%+1",
    right: 0,
    bottom: 0,
    mouse: true,
    keys: false,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    content: "",
    style: { fg: "#d0d0d0", bg: "black" }
  });

  function refreshList() {
    entries = scanLogs(params.logsDir);
    const listWidth = Math.max(20, Math.floor(Number(frame.body.width) * 0.4));
    (list as any).setItems(entries.map(e => formatEntry(e, listWidth)));
    if (entries.length > 0) {
      list.select(Math.min(selectedIndex, entries.length - 1));
    }
    params.screen.render();
  }

  function loadPreview() {
    const entry = entries[selectedIndex];
    if (!entry) {
      header.setContent("");
      preview.setContent("(no logs)");
      previewContent = "";
      params.screen.render();
      return;
    }
    header.setContent(` ${entry.name}  ${entry.path}`);
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

  params.windowManager.registerWindow(frame);
  refreshList();
  loadPreview();
  frame.focus();
}
