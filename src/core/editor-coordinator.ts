/**
 * Editor Coordinator — owns all editor open/save/dirty/render/keypress behavior.
 *
 * Extracted from app-controller.ts to give editor logic one coherent owner.
 * The controller delegates to this coordinator for all editor operations.
 */

import blessed from "blessed";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { WindowManager } from "./window-manager.js";
import type { RenderScheduler } from "./render-scheduler.js";
import type { WindowRecord, WindowKind } from "./types.js";
import type { OverlayManager } from "./overlay-manager.js";
import type { ContentService } from "../services/content-service.js";
import { openEditorWindow as openTextEditorWindow } from "../windows/text-windows.js";
import { promptForEditorFile, saveEditorWindow } from "../services/file-actions.js";
import {
  deleteBackward as deleteEditorBackwardState,
  deleteForward as deleteEditorForwardState,
  insertText as insertEditorTextState,
  moveCursor as moveEditorCursorState,
  render as renderEditorState,
} from "../services/editor-service.js";

export interface EditorCoordinatorDeps {
  windowManager: WindowManager;
  overlays: OverlayManager;
  content: ContentService;
  screen: blessed.Widgets.Screen;
  isMenuOpen: () => boolean;
  invalidation: RenderScheduler;
  defaultDir: string;
  editorStartDir: string;
}

export class EditorCoordinator {
  constructor(private readonly deps: EditorCoordinatorDeps) {}

  // ── Open paths ──

  /** Open an existing file in the editor. Reads from disk if no initial content provided. */
  openFile(filePath: string, args?: Record<string, unknown>): void {
    const title = typeof args?.title === "string" ? args.title : path.basename(filePath);
    let initial = typeof args?.initial === "string" ? args.initial : undefined;
    if (initial === undefined) {
      const fileExists = fs.existsSync(filePath);
      try {
        initial = fileExists ? fs.readFileSync(filePath, "utf8") : "";
      } catch {
        if (fileExists) {
          this.deps.overlays.flash(`Failed to read file: ${filePath}`);
          return;
        }
        initial = "";
      }
    }
    this.openWindow(filePath, title, initial);
  }

  /** Open the interactive file picker. */
  openPicker(): void {
    promptForEditorFile({
      overlays: this.deps.overlays,
      content: this.deps.content,
      startDir: this.deps.editorStartDir,
      onOpenEditor: (filePath, title, content) => this.openWindow(filePath, title, content),
    });
  }

  /** Open an editor window. Multi-instance. */
  openWindow(filePath?: string, title = "Untitled.txt", initial = "", restore?: { cursor?: number; scrollOffset?: number; figlet?: boolean; viewMode?: "edit" | "view" }): WindowRecord | undefined {
    const wm = this.deps.windowManager;
    const window = openTextEditorWindow({
      windowManager: wm,
      overlays: this.deps.overlays,
      screen: this.deps.screen,
      title,
      filePath,
      initial,
      cursor: restore?.cursor,
      restore: restore ? {
        scrollOffset: restore.scrollOffset,
        figlet: restore.figlet,
        viewMode: restore.viewMode,
      } : undefined,
      renderEditor: (windowId) => {
        const w = wm.getWindowById(windowId);
        if (w) this.render(w);
      },
      onStateChanged: () => this.deps.invalidation.requestSync(),
    });
    // Set initial saved content for dirty tracking
    if (window?.kind === "editor") {
      window.lastSavedContent = initial;
      window.isDirty = false;
    }
    return window;
  }

  // ── Save paths ──

  saveFocused(): void {
    const focused = this.deps.windowManager.getFocusedWindow();
    if (!focused || focused.kind !== "editor" || !focused.editor) {
      this.deps.overlays.flash("Focused window is not an editor.");
      return;
    }
    this.save(focused);
  }

  saveAsFocused(): void {
    const focused = this.deps.windowManager.getFocusedWindow();
    if (!focused || focused.kind !== "editor" || !focused.editor) {
      this.deps.overlays.flash("Focused window is not an editor.");
      return;
    }
    const defaultPath = focused.filePath
      ? focused.filePath
      : path.join(this.deps.defaultDir, focused.title.replace(/^\*/, ""));
    this.deps.overlays.openPathPrompt(
      "Save As",
      defaultPath,
      (value) => this.deps.content.completePath(value),
      (value) => {
        const resolved = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, focused.editor!.value, "utf8");
        } catch (err) {
          this.deps.overlays.flash(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
        focused.filePath = resolved;
        focused.title = path.basename(resolved);
        this.updateTitleBar(focused);
        this.markClean(focused);
        this.deps.invalidation.requestPersist();
        this.deps.overlays.flash(`Saved as ${resolved}`);
      },
    );
  }

  save(window: WindowRecord): void {
    // If onSave callback is set, call it instead of writing to disk
    if (window.onSave && window.editor) {
      window.onSave(window.editor.value);
      this.markClean(window);
      this.deps.invalidation.requestPersist();
      this.deps.overlays.flash(`Saved to source`);
      return;
    }
    saveEditorWindow({
      window,
      overlays: this.deps.overlays,
      content: this.deps.content,
      defaultDir: this.deps.defaultDir,
      onWritten: () => {
        this.markClean(window);
        this.deps.invalidation.requestPersist();
        if (window.filePath) {
          this.deps.overlays.flash(`Saved ${window.filePath}`);
        }
      },
    });
  }

  // ── Keypress handling ──

  handleFocusedKeypress(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {
    const window = this.deps.windowManager.getFocusedWindow();
    if (!window || window.kind !== "editor" || !window.editor) return;
    if (this.deps.isMenuOpen() || this.deps.screen.focused !== window.editor.widget) return;

    if (key.ctrl && key.name === "s") { this.save(window); return; }
    if (key.full === "S-tab") { this.deps.windowManager.focusNextWindow(-1); return; }
    if (key.name === "backspace") { this.deleteBackward(window); return; }
    if (key.name === "delete") { this.deleteForward(window); return; }
    if (key.name === "left") { moveEditorCursorState(window.editor, -1); this.render(window); return; }
    if (key.name === "right") { moveEditorCursorState(window.editor, 1); this.render(window); return; }
    if (key.name === "enter") { this.insertText(window, "\n"); return; }
    if (ch && !key.ctrl && !key.meta) { this.insertText(window, ch); }
  }

  // ── Text mutation ──

  insertText(window: WindowRecord, text: string): void {
    if (!window.editor) return;
    insertEditorTextState(window.editor, text);
    this.markDirty(window);
    this.render(window);
  }

  /** Write text by window id (for control API). Returns false if window not found. */
  writeTextById(id: number, text: string): boolean {
    const window = this.deps.windowManager.getWindowById(id);
    if (!window?.editor) return false;
    insertEditorTextState(window.editor, text);
    this.markDirty(window);
    this.render(window);
    return true;
  }

  // ── Internal ──

  private deleteBackward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor === 0) return;
    deleteEditorBackwardState(window.editor);
    this.markDirty(window);
    this.render(window);
  }

  private deleteForward(window: WindowRecord): void {
    if (!window.editor || window.editor.cursor >= window.editor.value.length) return;
    deleteEditorForwardState(window.editor);
    this.markDirty(window);
    this.render(window);
  }

  private markDirty(window: WindowRecord): void {
    if (window.isDirty) return;
    window.isDirty = true;
    this.updateTitleBar(window);
  }

  private markClean(window: WindowRecord): void {
    window.isDirty = false;
    window.lastSavedContent = window.editor?.value;
    this.updateTitleBar(window);
  }

  private updateTitleBar(window: WindowRecord): void {
    if (!window.titleBar) return;
    const display = window.isDirty ? `*${window.title}` : window.title;
    window.titleBar.setContent(` ${display} `);
    this.deps.invalidation.requestRender();
  }

  private render(window: WindowRecord): void {
    if (!window.editor) return;
    renderEditorState(window.editor);
    this.deps.invalidation.requestSync();
    this.deps.invalidation.requestRender();
  }
}
