/**
 * markdown-viewer-window.ts — Scrollable markdown viewer window.
 *
 * Opens any .md file with figlet headings, ANSI inline styles, code blocks.
 * Keys: j/k scroll · d/u page · g/G ends · h toggle figlet · q close
 *
 * Prototype reference: wibwob-sdk/modules/pi-markdown-reader/index.ts
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import type { WindowManager } from "../core/window-manager.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowRecord } from "../core/types.js";
import {
  renderMarkdownFile,
  isMarkdownFile,
  getFileMtime,
  DEFAULT_FIGLET_HEADING_CONFIG,
  PLAIN_HEADING_CONFIG,
  type FigletHeadingConfig,
} from "../services/markdown-service.js";
import { stripAnsi } from "../core/ansi-utils.js";

export interface MarkdownViewerParams {
  windowManager: WindowManager;
  overlays: OverlayManager;
  screen: blessed.Widgets.Screen;
  filePath: string;
  restore?: { scrollOffset?: number; figlet?: boolean };
  onStateChanged?: () => void;
}

export function openMarkdownViewerWindow(
  params: MarkdownViewerParams,
): WindowRecord | undefined {
  const { windowManager, overlays, screen, filePath, restore, onStateChanged } = params;

  if (!filePath || !isMarkdownFile(filePath)) {
    overlays.flash(`Not a markdown file: ${filePath}`);
    return undefined;
  }

  // ── Window frame ─────────────────────────────────────────────────────────────

  const record = windowManager.createFrame("Markdown", "markdown-viewer");

  const screenW = Number(screen.width);
  const screenH = Number(screen.height);
  const targetW = Math.min(120, Math.max(60, screenW - 10));
  const targetH = Math.max(20, screenH - 6);
  // Size before registerWindow — record not yet in manager array
  record.frame.width  = targetW;
  record.frame.height = targetH;
  if (record.shadow) { record.shadow.width = targetW; record.shadow.height = targetH; }

  // ── State ───────────────────────────────────────────────────────────────────

  let figletEnabled = restore?.figlet !== false;
  let cachedLines: string[] = [];
  let lastWidth = 0;
  let lastMtime = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Scroll box ───────────────────────────────────────────────────────────────

  const scrollBox = blessed.box({
    parent: record.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    scrollable: true,
    alwaysScroll: true,
    keys: false,
    mouse: true,
    tags: false,
    style: {
      ...theme().body,
      scrollbar: { fg: theme().muted.fg, bg: theme().body.bg },
      track: { fg: theme().muted.fg, bg: theme().body.bg },
    },
    scrollbar: { ch: "│", track: { ch: "░" } },
  } as any);

  // ── Status bar ───────────────────────────────────────────────────────────────

  const statusBar = blessed.box({
    parent: record.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: false,
    style: { fg: theme().muted.fg, bg: theme().body.bg },
  });

  // ── Rendering ────────────────────────────────────────────────────────────────

  function getInnerWidth(): number {
    const w = Number(record.body.width);
    const fallback = Math.max(40, Number(screen.width) - 10);
    return Math.max(40, Number.isFinite(w) && w > 2 ? w - 2 : fallback);
  }

  function getHeadingConfig(): FigletHeadingConfig {
    return figletEnabled ? DEFAULT_FIGLET_HEADING_CONFIG : PLAIN_HEADING_CONFIG;
  }

  function render(force = false): void {
    const contentWidth = getInnerWidth();
    const mtime = getFileMtime(filePath);

    if (!force && contentWidth === lastWidth && mtime === lastMtime) return;

    try {
      cachedLines = renderMarkdownFile(filePath, contentWidth, {
        headingConfig: getHeadingConfig(),
      });
      lastWidth = contentWidth;
      lastMtime = mtime;
    } catch (err: any) {
      overlays.flash(`Could not render ${filePath}: ${err?.message ?? err}`);
      cachedLines = [`Error reading file: ${err?.message ?? err}`];
    }

    scrollBox.setContent(cachedLines.join("\n"));
    updateStatus();
    screen.render();
    onStateChanged?.();
  }

  function updateStatus(): void {
    const total = cachedLines.length;
    const scrollY = (scrollBox as any).childBase ?? 0;
    const viewH = Math.max(1, Number(scrollBox.height));
    const pct =
      total <= viewH
        ? 100
        : Math.round(Math.min(100, ((scrollY + viewH) / total) * 100));
    const hint = ` j/k  d/u  g/G  h:figlet  q:close `;
    const pos = ` ${filePath.split("/").pop()} ${scrollY + 1}/${total} (${pct}%) `;
    const barW = Math.max(0, Number(record.body.width) - 2);
    const gap = Math.max(0, barW - hint.length - pos.length);
    statusBar.setContent(
      `\x1b[38;5;240m${hint}${" ".repeat(gap)}\x1b[38;5;244m${pos}\x1b[0m`,
    );
  }

  function scrollBy(delta: number): void {
    (scrollBox as any).scroll(delta);
    updateStatus();
    screen.render();
    onStateChanged?.();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────

  const bindScroll = (widget: blessed.Widgets.BlessedElement) => {
    widget.key(["j", "down"], () => scrollBy(1));
    widget.key(["k", "up"], () => scrollBy(-1));
    widget.key(["d", "pagedown"], () =>
      scrollBy(Math.floor(Number(scrollBox.height) / 2)),
    );
    widget.key(["u", "pageup"], () =>
      scrollBy(-Math.floor(Number(scrollBox.height) / 2)),
    );
    widget.key(["g", "home"], () => {
      (scrollBox as any).scrollTo(0);
      updateStatus();
      screen.render();
    });
    widget.key(["G", "end"], () => {
      (scrollBox as any).scrollTo(cachedLines.length);
      updateStatus();
      screen.render();
    });
    widget.key(["h"], () => {
      figletEnabled = !figletEnabled;
      render(true);
    });
    widget.key(["q", "escape"], () => windowManager.closeWindow(record.id));

    // y — copy nearest code block to clipboard (macOS pbcopy / xclip)
    widget.key(["y"], () => {
      const scrollTop = (scrollBox as any).childBase ?? 0;
      const block = nearestCodeBlock(cachedLines, scrollTop);
      if (!block) { overlays.flash("No code block in view"); return; }
      const raw = block.map(stripAnsi).join("\n");
      try {
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        const cmd = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
        execSync(cmd, { input: raw });
        overlays.flash(`Copied ${block.length} lines`);
      } catch {
        overlays.flash("Copy failed — pbcopy/xclip not available");
      }
    });
  };

  /** Find the code block whose opening fence is closest to scrollTop. */
  function nearestCodeBlock(lines: string[], scrollTop: number): string[] | null {
    // Find all fence start positions (``` lines)
    const fences: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (stripAnsi(lines[i] ?? "").trimStart().startsWith("```")) fences.push(i);
    }
    if (fences.length < 2) return null;
    // Find opening fence nearest to scroll position
    let bestOpen = fences[0]!;
    for (const f of fences) {
      if (f <= scrollTop + 5) bestOpen = f;
    }
    // Find the matching closing fence
    const closeIdx = fences.find(f => f > bestOpen) ?? -1;
    if (closeIdx === -1) return null;
    // Return the lines between the fences (excluding fence lines themselves)
    return lines.slice(bestOpen + 1, closeIdx).map(stripAnsi);
  }

  bindScroll(record.body);
  bindScroll(scrollBox);

  // ── Resize ────────────────────────────────────────────────────────────────────

  record.frame.on("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 200);
  });

  // ── describeState ─────────────────────────────────────────────────────────────

  record.describeState = () => ({
    appType: "markdown-viewer",
    filePath,
    scrollOffset: (scrollBox as any).getScroll?.() ?? 0,
    figlet: figletEnabled,
    rendererMode: figletEnabled ? "figlet" : "plain",
    summary: `Markdown: ${filePath.split("/").pop()} (line ${((scrollBox as any).childBase ?? 0) + 1}/${cachedLines.length})`,
  });

  record.filePath = filePath;

  // ── captureText ───────────────────────────────────────────────────────────────

  record.captureText = () => cachedLines.join("\n");

  // writeInput — allows API/command to send 'h' to toggle figlet
  record.writeInput = (input: string) => {
    if (input === "h") { figletEnabled = !figletEnabled; render(true); }
  };

  // ── onRestyle ────────────────────────────────────────────────────────────────

  record.onRestyle = () => {
    scrollBox.style = {
      ...theme().body,
      scrollbar: { fg: theme().muted.fg, bg: theme().body.bg },
      track: { fg: theme().muted.fg, bg: theme().body.bg },
    };
    statusBar.style = { fg: theme().muted.fg, bg: theme().body.bg };
    lastWidth = 0;
    render();
  };

  // ── cleanup ───────────────────────────────────────────────────────────────────

  record.cleanup = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
  };

  // ── Initial render ────────────────────────────────────────────────────────────

  render(true);

  const savedOffset = restore?.scrollOffset ?? 0;
  if (savedOffset > 0) {
    setImmediate(() => {
      (scrollBox as any).scrollTo(savedOffset);
      updateStatus();
      screen.render();
    });
  }

  windowManager.registerWindow(record);
  windowManager.focusWindow(record.id);
  scrollBox.focus();

  return record;
}
