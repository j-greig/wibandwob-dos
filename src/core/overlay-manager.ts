/**
 * Shared transient UI primitives: flash toasts, value/path prompts,
 * list pickers, browser prompts with search and preview, and file
 * browser dialogs. Prevents window code from creating one-off
 * interaction flows.
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";

import { theme } from "./theme/resolver.js";
import { createModal, createButtonBar, showToast, type ModalPosition } from "./modal.js";
import type { Box, List, Textbox } from "./types.js";

interface BrowserPromptItem {
  label: string;
  value: string;
  preview?: string;
  searchText?: string;
  isDirectory?: boolean;
}

/** Shared transient-UI manager for prompts, browsers, pickers, and notifications. */
export class OverlayManager {
  /** Default toast position for flash notifications. */
  private toastPosition: ModalPosition = "s";

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly restoreWindowFocus: () => void
  ) {}

  /** Set the default compass position for flash/toast notifications. */
  setToastPosition(position: ModalPosition): void {
    this.toastPosition = position;
  }

  /** Show a transient toast notification at the default or overridden compass position. */
  flash(message: string, position?: ModalPosition): void {
    showToast({
      screen: this.screen,
      message,
      position: position ?? this.toastPosition,
      duration: 2200
    });
  }

  /** Show a modal text input. Submits only if the trimmed value is non-empty. */
  openValuePrompt(label: string, initialValue: string, onSubmit: (value: string) => void): void {
    const t = theme();
    const promptWidth = Math.min(60, Math.floor(Number(this.screen.width) * 0.5));
    const modal = createModal({
      screen: this.screen,
      width: promptWidth,
      height: 7,
      position: "c",
      label,
      style: {
        ...t.body,
        border: t.windowBorderFocused
      }
    });
    const input: Textbox = blessed.textbox({
      parent: modal.box,
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      mouse: true,
      keys: true,
      style: t.selected
    });

    const closePrompt = () => {
      buttonBar.destroy();
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    const submitValue = () => {
      const nextValue = (input.getValue() ?? "").trim();
      closePrompt();
      if (nextValue) {
        onSubmit(nextValue);
      }
    };

    const buttonBar = createButtonBar({
      parent: modal.box,
      bottom: 1,
      screen: this.screen,
      align: "right",
      buttons: [
        { label: "OK", variant: "primary", action: submitValue },
        { label: "Cancel", action: closePrompt }
      ]
    });

    input.setValue(initialValue);
    input.on("submit", () => submitValue());
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
      if (key.name === "tab") {
        buttonBar.focus(0);
      }
    });

    this.screen.render();
    input.focus();
    input.readInput();
  }

  /** Show a modal text input with tab-completion for filesystem paths. */
  openPathPrompt(
    label: string,
    initialValue: string,
    completePath: (value: string) => string,
    onSubmit: (value: string) => void
  ): void {
    const t = theme();
    const pathWidth = Math.min(80, Math.floor(Number(this.screen.width) * 0.5));
    const modal = createModal({
      screen: this.screen,
      width: pathWidth,
      height: 8,
      position: "c",
      label,
      tags: true,
      style: {
        ...t.body,
        border: t.windowBorderFocused
      }
    });
    const input: Textbox = blessed.textbox({
      parent: modal.box,
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: t.selected
    });
    blessed.box({
      parent: modal.box,
      top: 3,
      left: 1,
      right: 1,
      height: 1,
      content: " Tab complete path ",
      style: {
        fg: "black",
        bg: "white"
      }
    });

    const closePrompt = () => {
      input.removeAllListeners("submit");
      input.removeAllListeners("cancel");
      input.removeAllListeners("keypress");
      buttonBar.destroy();
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    const submitValue = () => {
      const nextValue = (input.getValue() ?? "").trim();
      closePrompt();
      if (nextValue) {
        onSubmit(nextValue);
      }
    };

    const buttonBar = createButtonBar({
      parent: modal.box,
      bottom: 1,
      screen: this.screen,
      align: "right",
      buttons: [
        { label: "OK", variant: "primary", action: submitValue },
        { label: "Cancel", action: closePrompt }
      ]
    });

    input.setValue(initialValue);
    input.key(["tab"], () => {
      const currentValue = input.getValue();
      const completedValue = completePath(currentValue);
      if (completedValue !== currentValue) {
        input.setValue(completedValue);
        this.screen.render();
      }
    });
    input.on("submit", () => submitValue());
    input.on("cancel", closePrompt);
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
    });

    this.screen.render();
    input.focus();
    input.readInput();
  }

  /** Show a list picker, adapting generic items onto the richer browser prompt API. Supports optional lazy previews. */
  openListPrompt<T extends { label: string; value?: string; preview?: string; searchText?: string }>(
    label: string,
    items: T[],
    initialIndex: number,
    onSubmit: (item: T, index: number) => void,
    options?: { onPreview?: (item: T, index: number) => string | undefined }
  ): void {
    this.openBrowserPrompt(
      label,
      items.map((item, index) => ({
        label: item.label,
        value: "value" in item && typeof item.value === "string" ? item.value : String(index),
        preview: item.preview,
        searchText: item.searchText ?? item.label
      })),
      initialIndex,
      (item, index) => onSubmit(items[index], index),
      options?.onPreview
        ? { onPreview: (browserItem, _index) => {
            const originalIndex = items.findIndex(
              (it) => ("value" in it && typeof it.value === "string" ? it.value : "") === browserItem.value
            );
            return originalIndex >= 0 ? options.onPreview!(items[originalIndex], originalIndex) : undefined;
          }}
        : undefined
    );
  }

  /** Compact centre-screen picker for short enumerations (theme list, font list, etc.). */
  openCenteredListPrompt<T extends { label: string }>(
    label: string,
    items: T[],
    initialIndex: number,
    onSubmit: (item: T, index: number) => void,
    onCancel?: () => void
  ): void {
    const width = Math.max(24, Math.max(...items.map((item) => item.label.length), 0) + 4);
    const modal = createModal({
      screen: this.screen,
      width,
      height: Math.max(3, items.length + 2),
      position: "c",
      label,
      grabKeys: true,
      style: {
        ...theme().body,
        border: theme().windowBorderFocused
      }
    });
    const list = blessed.list({
      parent: modal.box,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      mouse: true,
      keys: true,
      vi: true,
      items: items.map((item) => item.label),
      style: {
        ...theme().body,
        selected: theme().selected
      }
    }) as List & { selected?: number };

    let closed = false;

    const closePrompt = (cancelled: boolean) => {
      if (closed) {
        return;
      }
      closed = true;
      list.removeAllListeners("select");
      list.removeAllListeners("keypress");
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
      if (cancelled) {
        onCancel?.();
      }
    };

    const applySelection = () => {
      if (closed) {
        return;
      }
      const index = list.selected ?? 0;
      const item = items[index];
      closePrompt(false);
      if (item) {
        onSubmit(item, index);
      }
    };

    list.select(Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1))));
    list.on("select", () => applySelection());
    list.on("keypress", (_, key) => {
      if (key.name === "escape" || key.name === "q") {
        closePrompt(true);
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        applySelection();
      }
    });

    list.focus();
    this.screen.render();
  }

  /** Split-pane search/list/preview browser. Reusable primitive for large item sets with optional debounced preview. */
  openBrowserPrompt(
    label: string,
    items: BrowserPromptItem[],
    initialIndex: number,
    onSubmit: (item: BrowserPromptItem, index: number) => void,
    options?: { onPreview?: (item: BrowserPromptItem, index: number) => string | undefined }
  ): void {
    const modal = createModal({
      screen: this.screen,
      width: "82%",
      height: "70%",
      position: "c",
      label,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" }
      }
    });

    const searchBox: Textbox = blessed.textbox({
      parent: modal.box,
      top: 0,
      left: 0,
      width: "38%",
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "white", bg: "blue" }
    });
    const list = blessed.list({
      parent: modal.box,
      top: 1,
      left: 0,
      width: "38%",
      bottom: 1,
      mouse: true,
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      items: [],
      style: {
        fg: "white",
        bg: "black",
        selected: { fg: "black", bg: "white" }
      }
    }) as List;
    const preview = blessed.box({
      parent: modal.box,
      top: 0,
      left: "38%",
      right: 0,
      bottom: 1,
      mouse: true,
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: "white",
        bg: "black",
      }
    });

    blessed.box({
      parent: modal.box,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      content: " Enter choose  / search  Esc cancel  letters jump ",
      style: { fg: "black", bg: "white" }
    });

    let searchValue = "";
    let filteredItems = [...items];

    const closePrompt = () => {
      searchBox.removeAllListeners("submit");
      searchBox.removeAllListeners("keypress");
      list.removeAllListeners("select");
      list.removeAllListeners("keypress");
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    const renderList = (selectedIndex = 0) => {
      list.setItems(filteredItems.map((item) => item.label));
      if (filteredItems.length > 0) {
        list.select(Math.max(0, Math.min(selectedIndex, filteredItems.length - 1)));
      } else {
        list.select(0);
      }
      updatePreview((list as List & { selected: number }).selected ?? 0);
      this.screen.render();
    };

    let previewTimer: ReturnType<typeof setTimeout> | undefined;

    const updatePreview = (index: number) => {
      const item = filteredItems[index];
      if (!item) {
        preview.setContent(searchValue ? `No matches for "${searchValue}".` : "No item selected.");
        return;
      }
      // If a lazy onPreview callback is provided, debounce it (80ms)
      if (options?.onPreview) {
        if (previewTimer) clearTimeout(previewTimer);
        preview.setContent(item.preview ?? item.label);
        previewTimer = setTimeout(() => {
          const content = options.onPreview!(item, index);
          if (content !== undefined) {
            preview.setContent(content);
            this.screen.render();
          }
        }, 80);
        return;
      }
      preview.setContent(item.preview ?? item.label);
    };

    const applyFilter = () => {
      const lowered = searchValue.toLowerCase();
      filteredItems = items.filter((item) => (item.searchText ?? item.label).toLowerCase().includes(lowered));
      renderList(0);
    };

    const focusSearch = () => {
      searchBox.focus();
      searchBox.readInput();
      this.screen.render();
    };

    const jumpToLetter = (letter: string) => {
      const upper = letter.toUpperCase();
      const index = filteredItems.findIndex((item) => item.label.charAt(0).toUpperCase() === upper);
      if (index >= 0) {
        list.select(index);
        updatePreview(index);
        this.screen.render();
      }
    };

    searchBox.setValue(searchValue);
    searchBox.on("submit", (value) => {
      searchValue = (value ?? "").trim();
      applyFilter();
      list.focus();
    });
    searchBox.on("keypress", (_, key) => {
      if (key.name === "escape") {
        list.focus();
        this.screen.render();
        return;
      }
      if (key.name === "enter") {
        searchValue = searchBox.getValue().trim();
        applyFilter();
        list.focus();
        return;
      }
      setTimeout(() => {
        searchValue = searchBox.getValue().trim();
        applyFilter();
      }, 0);
    });

    list.on("select", (_, index) => {
      const item = filteredItems[index];
      if (item) {
        closePrompt();
        onSubmit(item, index);
      }
    });
    list.on("click", () => {
      setTimeout(() => {
        updatePreview((list as List & { selected: number }).selected ?? 0);
        this.screen.render();
      }, 0);
    });
    list.on("keypress", (ch, key) => {
      if (key.name === "escape") {
        closePrompt();
        return;
      }
      if (key.name === "slash") {
        focusSearch();
        return;
      }
      if (["up", "down", "j", "k", "pageup", "pagedown", "home", "end"].includes(key.name ?? "")) {
        setTimeout(() => {
          updatePreview((list as List & { selected: number }).selected ?? 0);
          this.screen.render();
        }, 0);
        return;
      }
      if (ch && /^[a-z]$/i.test(ch)) {
        jumpToLetter(ch);
      }
    });

    renderList(Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1))));
    list.focus();
  }

  /** File browser with directory navigation, filtering, preview, and directoriesOnly/fileFilter options. */
  openFileBrowserPrompt(
    label: string,
    initialDirectory: string,
    onSubmit: (filePath: string) => void,
    options?: {
      directoriesOnly?: boolean;
      fileFilter?: (filePath: string, isDirectory: boolean) => boolean;
      previewLimit?: number;
    }
  ): void {
    const modal = createModal({
      screen: this.screen,
      width: "88%",
      height: "76%",
      position: "c",
      label,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" }
      }
    });
    const pathBar = blessed.box({
      parent: modal.box,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: "black", bg: "cyan" }
    });
    const searchBox: Textbox = blessed.textbox({
      parent: modal.box,
      top: 1,
      left: 0,
      width: "38%",
      height: 1,
      inputOnFocus: true,
      mouse: true,
      style: { fg: "white", bg: "blue" }
    });
    const list = blessed.list({
      parent: modal.box,
      top: 2,
      left: 0,
      width: "38%",
      bottom: 1,
      mouse: true,
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      items: [],
      style: {
        fg: "white",
        bg: "black",
        selected: { fg: "black", bg: "white" }
      }
    }) as List;
    const preview = blessed.box({
      parent: modal.box,
      top: 1,
      left: "38%",
      right: 0,
      bottom: 1,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      style: { fg: "white", bg: "black" }
    });
    blessed.box({
      parent: modal.box,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      content: " Enter open  Backspace/Left up  / search  Esc cancel  letters jump ",
      style: { fg: "black", bg: "white" }
    });

    let currentDirectory = path.resolve(initialDirectory);
    let searchValue = "";
    let visibleEntries: BrowserPromptItem[] = [];

    const closePrompt = () => {
      searchBox.removeAllListeners("submit");
      searchBox.removeAllListeners("keypress");
      list.removeAllListeners("select");
      list.removeAllListeners("keypress");
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    const buildPreview = (entry: BrowserPromptItem | undefined) => {
      if (!entry) {
        preview.setContent("No file selected.");
        return;
      }
      if (entry.isDirectory) {
        preview.setContent(`${entry.value}\n\n[directory]`);
        return;
      }
      try {
        const content = fs.readFileSync(entry.value, "utf8");
        const limit = options?.previewLimit ?? 4000;
        const clipped = content.length > limit ? `${content.slice(0, limit)}\n\n[preview truncated]` : content;
        preview.setContent(`${entry.value}\n\n${clipped}`);
      } catch (error) {
        preview.setContent(`${entry.value}\n\nCannot preview file.\n${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const loadDirectory = (directory: string, selectName?: string) => {
      currentDirectory = path.resolve(directory);
      pathBar.setContent(` ${currentDirectory} `);
      const directoryEntries: BrowserPromptItem[] = fs
        .readdirSync(currentDirectory, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => {
          const fullPath = path.join(currentDirectory, entry.name);
          const isDirectory = entry.isDirectory();
          return {
            label: isDirectory ? `[DIR] ${entry.name}` : entry.name,
            value: fullPath,
            isDirectory,
            searchText: entry.name
          } satisfies BrowserPromptItem;
        })
        .filter((entry) => options?.fileFilter ? options.fileFilter(entry.value, Boolean(entry.isDirectory)) : true)
        .sort((a, b) => {
          if (Boolean(a.isDirectory) !== Boolean(b.isDirectory)) {
            return a.isDirectory ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });
      const parentDir = path.dirname(currentDirectory);
      const parentEntry: BrowserPromptItem = {
        label: "[DIR] ..",
        value: parentDir,
        isDirectory: true,
        searchText: ".."
      };
      const withParent: BrowserPromptItem[] = currentDirectory !== parentDir
        ? [parentEntry, ...directoryEntries]
        : directoryEntries;
      const lowered = searchValue.toLowerCase();
      visibleEntries = withParent.filter((entry) => (entry.searchText ?? entry.label).toLowerCase().includes(lowered));
      list.setItems(visibleEntries.map((entry) => entry.label));
      const nextIndex = selectName ? Math.max(0, visibleEntries.findIndex((entry) => path.basename(entry.value) === selectName)) : 0;
      if (visibleEntries.length > 0) {
        list.select(nextIndex < 0 ? 0 : nextIndex);
      } else {
        list.select(0);
      }
      buildPreview(visibleEntries[(list as List & { selected: number }).selected ?? 0]);
      this.screen.render();
    };

    const jumpToLetter = (letter: string) => {
      const upper = letter.toUpperCase();
      const index = visibleEntries.findIndex((entry) => {
        const name = entry.label.replace(/^\[DIR\]\s*/, "");
        return name.charAt(0).toUpperCase() === upper;
      });
      if (index >= 0) {
        list.select(index);
        buildPreview(visibleEntries[index]);
        this.screen.render();
      }
    };

    const focusSearch = () => {
      searchBox.focus();
      searchBox.readInput();
      this.screen.render();
    };

    searchBox.setValue(searchValue);
    searchBox.on("submit", (value) => {
      searchValue = (value ?? "").trim();
      loadDirectory(currentDirectory);
      list.focus();
    });
    searchBox.on("keypress", (_, key) => {
      if (key.name === "escape") {
        list.focus();
        this.screen.render();
        return;
      }
      if (key.name === "enter") {
        searchValue = searchBox.getValue().trim();
        loadDirectory(currentDirectory);
        list.focus();
        return;
      }
      setTimeout(() => {
        searchValue = searchBox.getValue().trim();
        loadDirectory(currentDirectory);
      }, 0);
    });

    list.on("select", (_, index) => {
      const entry = visibleEntries[index];
      if (!entry) {
        return;
      }
      if (entry.isDirectory) {
        loadDirectory(entry.value);
        return;
      }
      closePrompt();
      onSubmit(entry.value);
    });
    list.on("keypress", (ch, key) => {
      if (key.name === "escape") {
        closePrompt();
        return;
      }
      if (key.name === "slash") {
        focusSearch();
        return;
      }
      if (key.name === "left" || key.name === "backspace") {
        loadDirectory(path.dirname(currentDirectory), path.basename(currentDirectory));
        return;
      }
      if (["up", "down", "j", "k", "pageup", "pagedown", "home", "end"].includes(key.name ?? "")) {
        setTimeout(() => {
          buildPreview(visibleEntries[(list as List & { selected: number }).selected ?? 0]);
          this.screen.render();
        }, 0);
        return;
      }
      if (ch && /^[a-z]$/i.test(ch)) {
        jumpToLetter(ch);
      }
    });

    loadDirectory(currentDirectory);
    list.focus();
  }
}
