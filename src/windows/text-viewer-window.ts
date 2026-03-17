/**
 * text-viewer-window.ts — Shared text viewer for primer and reader kinds.
 * Optionally animates when multiple frames are provided.
 */
import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { createRestyleBundle } from "../core/ui-parts.js";
import type { ContentMeasurement } from "../services/content-measurement.js";
import { createPreRenderedPlayer, type FramePlayer } from "../services/animation-service.js";
import type { WindowKind, WindowRecord } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import { setViewportContent } from "./browser-utils.js";

/** ViewerKind — the subset of WindowKind valid for the content viewer factory. */
export type ViewerKind = "primer" | "reader";

export function openTextViewerWindow(params: {
  windowManager: WindowManager;
  applyMeasuredWindowSize: (frame: WindowRecord, kind: ViewerKind, content: { width: number; height: number }) => void;
  title: string;
  content: string;
  kind: ViewerKind;
  filePath?: string;
  measurement?: ContentMeasurement;
  /** All animation frames as line arrays. If present and length > 1, viewer animates. */
  frames?: string[][];
}): void {
  const frame = params.windowManager.createFrame(params.title, params.kind);
  let currentContent = params.content;
  const viewer = blessed.box({
    parent: frame.body,
    top: 0, left: 0, right: 0, bottom: 0,
    mouse: true, keys: true, vi: true,
    scrollable: true, alwaysScroll: true,
    scrollbar: createScrollbar(),
    tags: true,
    content: "",
    style: theme().body
  });
  frame.kind = params.kind;
  frame.filePath = params.filePath;
  const m = params.measurement;

  // --- Animation setup ---
  const animFrames = params.frames && params.frames.length > 1 ? params.frames : null;
  const baseTitle = params.title;
  let player: FramePlayer | null = null;

  const updateTitle = () => {
    if (!player || !frame.titleBar) return;
    const counter = `${player.currentFrame + 1}/${player.totalFrames}`;
    const pauseTag = player.paused ? " ⏸" : "";
    frame.titleBar.setContent(` ${counter} ${baseTitle}${pauseTag} `);
  };

  if (animFrames) {
    player = createPreRenderedPlayer({
      frames: animFrames,
      fps: m?.fps ?? 4,
      onFrame: (content, _index, _total) => {
        currentContent = content;
        setViewportContent(viewer, currentContent);
        updateTitle();
        viewer.screen.render();
      },
    });
    updateTitle();
    player.play();
  }

  frame.describeState = () => ({
    appType: params.kind === "primer" ? "primer-viewer" : "reader-viewer",
    summary: params.filePath ? `Viewing ${params.filePath}` : `Viewing ${params.kind} content.`,
    filePath: params.filePath,
    lineCount: m?.lineCount ?? 0,
    contentWidth: m?.columnWidth ?? 0,
    contentHeight: m?.lineCount ?? 0,
    recommendedWidth: m?.recommendedWidth,
    recommendedHeight: m?.recommendedHeight,
    animated: m?.animated,
    fps: player?.fps,
    frameCount: m?.frameCount,
    currentFrame: player?.currentFrame,
    paused: player?.paused,
    skippedCommentLines: m?.skippedCommentLines,
    contentPreview: params.content.split("\n").slice(0, 8).join("\n")
  });
  frame.captureText = () => params.content;
  frame.setFocusTarget(viewer);
  frame.refresh = () => setViewportContent(viewer, currentContent);
  frame.onRestyle = createRestyleBundle([
    [viewer, () => theme().body],
  ]).restyle;

  if (player) {
    viewer.on("keypress", (_ch: string, key: { name?: string }) => {
      if (key.name === "space") {
        player!.togglePause();
        updateTitle();
        viewer.screen.render();
      }
    });
  }

  frame.cleanup = () => {
    player?.destroy();
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
