/**
 * text-windows.ts — Unified smart editor window.
 *
 * One window, two render modes:
 *   edit — writable editor widget (all file types, default for non-md)
 *   view — formatted read-only scroll view (default for .md/.markdown/.mdx)
 *
 * Keys (view mode): j/k scroll · d/u page · g/G ends · h figlet · e edit · y copy · q close
 * Keys (edit mode): standard editor · v view (md only) · q close
 */

import blessed from "blessed";

import { theme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle } from "../core/ui-parts.js";
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

export interface EditorWindowParams {
  windowManager: WindowManager;
  overlays: OverlayManager;
  screen: blessed.Widgets.Screen;
  title: string;
  filePath?: string;
  initial: string;
  cursor?: number;
  renderEditor: (windowId: number) => void;
  restore?: { scrollOffset?: number; figlet?: boolean; viewMode?: "edit" | "view" };
  onStateChanged?: () => void;
}

export function openEditorWindow(params: EditorWindowParams): WindowRecord | undefined {
  const {
    windowManager, overlays, screen,
    title, filePath, initial, cursor,
    renderEditor, restore, onStateChanged,
  } = params;

  // Determine starting mode: md files default to view unless explicitly overridden
  const isMd = filePath ? isMarkdownFile(filePath) : false;
  const startMode: "edit" | "view" =
    restore?.viewMode ?? (isMd ? "view" : "edit");

  // ── Frame ──────────────────────────────────────────────────────────────────

  const frame = windowManager.createFrame(title, "editor");
  frame.kind = "editor";
  frame.filePath = filePath;

  // Size md files to fill screen comfortably
  if (isMd) {
    const screenW = Number(screen.width);
    const screenH = Number(screen.height);
    const targetW = Math.min(120, Math.max(60, screenW - 10));
    const targetH = Math.max(20, screenH - 6);
    frame.frame.width  = targetW;
    frame.frame.height = targetH;
    if (frame.shadow) { frame.shadow.width = targetW; frame.shadow.height = targetH; }
  }

  // ── Edit mode widgets ──────────────────────────────────────────────────────

  const editorWidget = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 0,
    keys: true, mouse: true, tags: true,
    scrollable: true, alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body,
  });

  frame.editor = {
    widget: editorWidget,
    value: initial,
    cursor: Math.max(0, Math.min(cursor ?? initial.length, initial.length)),
  };

  // ── View mode widgets (created only for md files) ──────────────────────────

  let scrollBox: blessed.Widgets.BoxElement | undefined;
  let statusBar: blessed.Widgets.BoxElement | undefined;
  let figletEnabled = restore?.figlet !== false;
  let cachedLines: string[] = [];
  let lastWidth = 0;
  let lastMtime = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  if (isMd) {
    scrollBox = blessed.box({
      parent: frame.body,
      top: 0, left: 0, right: 0, bottom: 1,
      scrollable: true, alwaysScroll: true,
      keys: false, mouse: true, tags: false,
      style: {
        ...theme().body,
        scrollbar: { fg: theme().muted.fg, bg: theme().body.bg },
        track:     { fg: theme().muted.fg, bg: theme().body.bg },
      },
      scrollbar: { ch: "│", track: { ch: "░" } },
    } as any);

    statusBar = blessed.box({
      parent: frame.body,
      bottom: 0, left: 0, right: 0, height: 1,
      tags: false,
      style: { fg: theme().muted.fg, bg: theme().body.bg },
    });
  }

  // ── Current mode ──────────────────────────────────────────────────────────

  let currentMode: "edit" | "view" = startMode;

  function applyMode(mode: "edit" | "view"): void {
    currentMode = mode;
    if (mode === "view" && scrollBox) {
      editorWidget.hide();
      scrollBox.show();
      statusBar?.show();
      renderView();
      scrollBox.focus();
    } else {
      scrollBox?.hide();
      statusBar?.hide();
      editorWidget.show();
      renderEditor(frame.id);
      editorWidget.focus();
    }
    screen.render();
    onStateChanged?.();
  }

  // ── View-mode rendering ────────────────────────────────────────────────────

  function getInnerWidth(): number {
    const w = Number(frame.body.width);
    const fallback = Math.max(40, Number(screen.width) - 10);
    return Math.max(40, Number.isFinite(w) && w > 2 ? w - 2 : fallback);
  }

  function getHeadingConfig(): FigletHeadingConfig {
    return figletEnabled ? DEFAULT_FIGLET_HEADING_CONFIG : PLAIN_HEADING_CONFIG;
  }

  function renderView(force = false): void {
    if (!filePath || !scrollBox) return;
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
    onStateChanged?.();
  }

  function updateStatus(): void {
    if (!scrollBox || !statusBar) return;
    const total = cachedLines.length;
    const scrollY = (scrollBox as any).childBase ?? 0;
    const viewH = Math.max(1, Number(scrollBox.height));
    const pct = total <= viewH ? 100 : Math.round(Math.min(100, ((scrollY + viewH) / total) * 100));
    const hint = ` j/k  d/u  g/G  h:figlet  e:edit  q:close `;
    const pos  = ` ${filePath?.split("/").pop()} ${scrollY + 1}/${total} (${pct}%) `;
    const barW = Math.max(0, Number(frame.body.width) - 2);
    const gap  = Math.max(0, barW - hint.length - pos.length);
    statusBar.setContent(
      `\x1b[38;5;240m${hint}${" ".repeat(gap)}\x1b[38;5;244m${pos}\x1b[0m`,
    );
  }

  function scrollBy(delta: number): void {
    if (!scrollBox) return;
    (scrollBox as any).scroll(delta);
    updateStatus();
    screen.render();
    onStateChanged?.();
  }

  // ── View-mode keyboard bindings ────────────────────────────────────────────

  if (isMd && scrollBox) {
    const bindScrollKeys = (widget: blessed.Widgets.BlessedElement) => {
      widget.key(["j", "down"],    () => scrollBy(1));
      widget.key(["k", "up"],      () => scrollBy(-1));
      widget.key(["d", "pagedown"],() => scrollBy(Math.floor(Number(scrollBox!.height) / 2)));
      widget.key(["u", "pageup"],  () => scrollBy(-Math.floor(Number(scrollBox!.height) / 2)));
      widget.key(["g", "home"],    () => { (scrollBox as any).scrollTo(0); updateStatus(); screen.render(); });
      widget.key(["G", "end"],     () => { (scrollBox as any).scrollTo(cachedLines.length); updateStatus(); screen.render(); });
      widget.key(["h"],            () => { figletEnabled = !figletEnabled; renderView(true); screen.render(); });
      widget.key(["e"],            () => applyMode("edit"));
      widget.key(["q", "escape"],  () => windowManager.closeWindow(frame.id));

      // y — copy nearest code block to clipboard
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
    bindScrollKeys(frame.body);
    bindScrollKeys(scrollBox);

    // v key in edit mode → switch to view
    editorWidget.key(["v"], () => applyMode("view"));

    // resize debounce
    frame.frame.on("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (currentMode === "view") renderView(); }, 200);
    });
  }

  // ── describeState ──────────────────────────────────────────────────────────

  frame.describeState = () => ({
    appType: "text-editor" as const,
    summary: filePath ? `Editing ${filePath}` : "Unsaved text buffer.",
    filePath: frame.filePath,
    viewMode: currentMode,
    ...(currentMode === "view" && scrollBox
      ? {
          scrollOffset: (scrollBox as any).getScroll?.() ?? 0,
          figlet: figletEnabled,
          rendererMode: figletEnabled ? "figlet" : "plain",
          lineCount: cachedLines.length,
        }
      : {
          lineCount: frame.editor?.value.split("\n").length ?? 0,
          cursor: frame.editor?.cursor ?? 0,
          contentPreview: (frame.editor?.value ?? "").split("\n").slice(0, 8).join("\n"),
        }
    ),
  });

  // ── captureText ────────────────────────────────────────────────────────────

  frame.captureText = () =>
    currentMode === "view" ? cachedLines.join("\n") : frame.editor?.value ?? "";

  // ── writeInput (API / agent control) ──────────────────────────────────────

  frame.writeInput = (input: string) => {
    if (input === "h" && isMd) { figletEnabled = !figletEnabled; if (currentMode === "view") renderView(true); }
    if (input === "e" && isMd) applyMode("edit");
    if (input === "v" && isMd) applyMode("view");
  };

  // ── onRestyle ─────────────────────────────────────────────────────────────

  frame.onRestyle = createRestyleBundle([
    [editorWidget, () => theme().body],
    ...(scrollBox ? [[scrollBox, () => ({
      ...theme().body,
      scrollbar: { fg: theme().muted.fg, bg: theme().body.bg },
      track:     { fg: theme().muted.fg, bg: theme().body.bg },
    })]] : []) as any,
    ...(statusBar ? [[statusBar, () => ({ fg: theme().muted.fg, bg: theme().body.bg })]] : []) as any,
  ]).restyle;

  // ── cleanup ────────────────────────────────────────────────────────────────

  frame.cleanup = () => { if (resizeTimer) clearTimeout(resizeTimer); };

  // ── Initial render ─────────────────────────────────────────────────────────

  // Start with everything hidden, then applyMode shows the right widget
  if (isMd) {
    editorWidget.hide();
    scrollBox?.hide();
    statusBar?.hide();
  }

  windowManager.registerWindow(frame);

  applyMode(startMode);

  if (startMode === "view" && restore?.scrollOffset && scrollBox) {
    setImmediate(() => {
      (scrollBox as any).scrollTo(restore!.scrollOffset);
      updateStatus();
      screen.render();
    });
  }

  return frame;
}

/** Find the code block whose opening fence is closest to scrollTop. */
function nearestCodeBlock(lines: string[], scrollTop: number): string[] | null {
  const fences: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (stripAnsi(lines[i] ?? "").trimStart().startsWith("```")) fences.push(i);
  }
  if (fences.length < 2) return null;
  let bestOpen = fences[0]!;
  for (const f of fences) {
    if (f <= scrollTop + 5) bestOpen = f;
  }
  const closeIdx = fences.find(f => f > bestOpen) ?? -1;
  if (closeIdx === -1) return null;
  return lines.slice(bestOpen + 1, closeIdx).map(stripAnsi);
}
