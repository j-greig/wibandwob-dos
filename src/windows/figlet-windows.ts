import fs from "node:fs";
import path from "node:path";

import blessed from "blessed";

import type { OverlayManager } from "../core/overlay-manager.js";
import { theme } from "../core/theme/resolver.js";
import type { WindowRecord } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import { createScrollbar, safeSetStyle } from "../core/ui-primitives.js";
import { getDefaultFigletFont, getFigletCatalogue, getFigletFontChoices, measureFiglet, renderFiglet } from "../services/figlet-service.js";

export function promptForFigletText(
  overlays: OverlayManager,
  onOpenFontPicker: (text: string, font: string) => void
): void {
  overlays.openValuePrompt("Figlet Text", "WIB WOB", (value) => onOpenFontPicker(value, getDefaultFigletFont()));
}

export function openFigletFontPicker(params: {
  overlays: OverlayManager;
  text: string;
  currentFont: string;
  onSelect?: (font: string) => void;
  onOpenWindow: (text: string, font: string) => void;
}): void {
  const choices = getFigletFontChoices();
  const initialIndex = Math.max(0, choices.findIndex((choice) => choice.value === params.currentFont));
  params.overlays.openListPrompt("FIGlet Font Picker", choices, initialIndex, (item) => {
    if (params.onSelect) {
      params.onSelect(item.value);
      return;
    }
    params.onOpenWindow(params.text, item.value);
  }, {
    onPreview: (item) => renderFiglet(params.text || "WIB WOB", item.value)
  });
}

export function openFigletWindow(params: {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  applyMeasuredWindowSize: (frame: WindowRecord, kind: "figlet", content: { width: number; height: number }) => void;
  text: string;
  initialFont?: string;
  onOpenFontPicker: (text: string, currentFont: string, onSelect?: (font: string) => void) => void;
  onSyncState: () => void;
}): void {
  const title = `Banner: ${params.text.slice(0, 18) || "Banner"}`;
  const frame = params.windowManager.createFrame(title, "figlet");
  // --- Toolbar: input box + buttons ---
  const toolbar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: theme().header
  });
  const toolbarLabel = blessed.box({
    parent: toolbar,
    top: 0,
    left: 0,
    width: 6,
    height: 1,
    content: " Text:",
    style: theme().header
  });
  const textInput = blessed.textbox({
    parent: toolbar,
    top: 0,
    left: 6,
    right: 24,
    height: 1,
    mouse: true,
    keys: true,
    inputOnFocus: true,
    style: theme().input,
    value: params.text
  });
  const fontBtn = blessed.box({
    parent: toolbar,
    top: 0,
    right: 12,
    width: 12,
    height: 1,
    mouse: true,
    clickable: true,
    content: " [F] Font ",
    style: { ...theme().footer, hover: theme().selected }
  });
  const editBtn = blessed.box({
    parent: toolbar,
    top: 0,
    right: 0,
    width: 12,
    height: 1,
    mouse: true,
    clickable: true,
    content: " [E] Edit ",
    style: { ...theme().footer, hover: theme().selected }
  });
  const viewer = blessed.box({
    parent: frame.body,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: theme().body
  });

  let currentText = params.text;
  let currentFont = params.initialFont ?? getDefaultFigletFont();
  let lastMeasurement = measureFiglet(currentText, currentFont, 0);

  const syncTitle = () => {
    frame.title = `Banner: ${currentText.slice(0, 18) || "Banner"}`;
    frame.titleBar?.setContent(` ${frame.title} `);
  };

  const rerenderFiglet = () => {
    const availableWidth = Math.max(20, Number(viewer.width));
    const measured = measureFiglet(currentText, currentFont, availableWidth);
    lastMeasurement = measured;
    viewer.setContent(measured.rendered);
    const catalogue = getFigletCatalogue();
    const meta = catalogue.fontMetadata[currentFont];
    fontBtn.setContent(` [F] ${currentFont.slice(0, 8)} `);
    syncTitle();
    params.onSyncState();
    params.screen.render();
  };

  const submitText = () => {
    const val = textInput.getValue().trim();
    if (val && val !== currentText) {
      currentText = val;
      rerenderFiglet();
    }
  };

  const editText = () => {
    textInput.focus();
    textInput.readInput();
  };

  const pickFont = () => {
    params.onOpenFontPicker(currentText, currentFont, (font) => {
      currentFont = font;
      rerenderFiglet();
    });
  };

  // Submit on Enter in textbox
  textInput.on("submit", () => {
    submitText();
    viewer.focus();
  });
  // Cancel on Escape in textbox
  textInput.on("cancel", () => {
    textInput.setValue(currentText);
    viewer.focus();
    params.screen.render();
  });
  // Button clicks
  editBtn.on("click", editText);
  fontBtn.on("click", pickFont);

  frame.kind = "figlet";
  frame.describeState = () => ({
    appType: "figlet-banner",
    summary: "Rendered figlet banner window using the shared WibWob font catalogue.",
    inputText: currentText,
    font: currentFont,
    lineCount: lastMeasurement.measurement.lineCount,
    contentWidth: lastMeasurement.measurement.columnWidth,
    contentHeight: lastMeasurement.measurement.lineCount,
    contentPreview: viewer.getContent().split("\n").slice(0, 8).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    viewer.focus();
  };
  frame.onRestyle = () => {
    toolbar.style = theme().header;
    toolbarLabel.style = theme().header;
    textInput.style = theme().input;
    fontBtn.style = { ...theme().footer, hover: theme().selected };
    editBtn.style = { ...theme().footer, hover: theme().selected };
    safeSetStyle(viewer, theme().body);
  };

  frame.frame.key(["e"], editText);
  frame.frame.key(["f"], pickFont);
  viewer.key(["e"], editText);
  viewer.key(["f"], pickFont);
  frame.frame.on("resize", rerenderFiglet);

  params.windowManager.registerWindow(frame);
  frame.focus();
  rerenderFiglet();

  const measured = measureFiglet(currentText, currentFont, 0);
  lastMeasurement = measured;
  const mh = measured.measurement.lineCount;
  const mw = measured.measurement.columnWidth;
  const oneRowHeight = measured.fontHeight > 0 && mh > measured.fontHeight ? measured.fontHeight : mh;
  params.applyMeasuredWindowSize(frame, "figlet", {
    width: Math.max(mw, 32),
    height: Math.max(oneRowHeight, 5)
  });
}

export function openBrowserReaderWindow(params: {
  filePath: string;
  onOpenTextViewer: (title: string, content: string, kind: "reader", filePath?: string) => void;
  onError: (message: string) => void;
}): void {
  try {
    const content = fs.readFileSync(params.filePath, "utf8");
    params.onOpenTextViewer(`Browser: ${path.basename(params.filePath)}`, `Location: ${params.filePath}\n\n${content}`, "reader", params.filePath);
  } catch (error) {
    params.onError(`Cannot open browser reader: ${error instanceof Error ? error.message : String(error)}`);
  }
}
