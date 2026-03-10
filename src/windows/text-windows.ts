import blessed from "blessed";

import { theme } from "../core/theme/resolver.js";
import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
import type { WindowManager } from "../core/window-manager.js";

export function openEditorWindow(params: {
  windowManager: WindowManager;
  title: string;
  filePath?: string;
  initial: string;
  cursor?: number;
  renderEditor: (windowId: number) => void;
}): void {
  const frame = params.windowManager.createFrame(params.title, "editor");
  const editorWidget = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body
  });
  frame.kind = "editor";
  frame.filePath = params.filePath;
  frame.editor = {
    widget: editorWidget,
    value: params.initial,
    cursor: Math.max(0, Math.min(params.cursor ?? params.initial.length, params.initial.length))
  };
  frame.describeState = () => ({
    appType: "text-editor",
    summary: params.filePath ? `Editing ${params.filePath}` : "Unsaved text buffer.",
    filePath: frame.filePath,
    lineCount: frame.editor?.value.split("\n").length ?? 0,
    cursor: frame.editor?.cursor ?? 0,
    contentPreview: (frame.editor?.value ?? "").split("\n").slice(0, 8).join("\n")
  });
  frame.setFocusTarget(editorWidget);
  frame.onRestyle = () => {
    safeSetStyle(editorWidget, theme().body);
  };
  params.windowManager.registerWindow(frame);
  params.renderEditor(frame.id);
  frame.focus();
}
