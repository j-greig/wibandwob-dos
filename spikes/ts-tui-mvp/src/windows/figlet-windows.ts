import fs from "node:fs";
import path from "node:path";

import blessed from "blessed";

import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowRecord } from "../core/types.js";
import type { WindowManager } from "../core/window-manager.js";
import { createScrollbar } from "../core/ui-primitives.js";
import { getDefaultFigletFont, getFigletCatalogue, getFigletFontChoices, measureFiglet } from "../services/figlet-service.js";

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
  const toolbar = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    style: { fg: "black", bg: "cyan" }
  });
  const viewer = blessed.box({
    parent: frame.body,
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    mouse: true,
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: createScrollbar(),
    style: { fg: "white", bg: "black" }
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
    toolbar.setContent(
      ` Text: ${currentText}\n Font: ${currentFont}${meta ? ` (${meta.height}h x ${meta.width}w)` : ""}  e edit text  f pick font `
    );
    syncTitle();
    params.onSyncState();
    params.screen.render();
  };

  const editText = () => {
    params.overlays.openValuePrompt("Edit FIGlet Text", currentText, (value) => {
      currentText = value;
      rerenderFiglet();
    });
  };

  const pickFont = () => {
    params.onOpenFontPicker(currentText, currentFont, (font) => {
      currentFont = font;
      rerenderFiglet();
    });
  };

  frame.kind = "figlet";
  frame.describeState = () => ({
    appType: "figlet-banner",
    summary: "Rendered figlet banner window using the shared WibWob font catalogue.",
    inputText: currentText,
    font: currentFont,
    lineCount: lastMeasurement.height,
    contentWidth: lastMeasurement.width,
    contentHeight: lastMeasurement.height,
    contentPreview: viewer.getContent().split("\n").slice(0, 8).join("\n")
  });
  frame.focus = () => {
    params.windowManager.focusWindow(frame);
    viewer.focus();
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
  const oneRowHeight = measured.fontHeight > 0 && measured.height > measured.fontHeight ? measured.fontHeight : measured.height;
  params.applyMeasuredWindowSize(frame, "figlet", {
    width: Math.max(measured.width, 32),
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
