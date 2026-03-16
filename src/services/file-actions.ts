import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeReadFile, safeWriteFile } from "../core/safe-fs.js";

import { measurePrimerContent, type ContentMeasurement } from "./content-measurement.js";
import type { ContentService } from "./content-service.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { WindowRecord } from "../core/types.js";

export function promptForPrimerFile(params: {
  overlays: OverlayManager;
  content: ContentService;
  repoRoot: string;
  onOpenPrimer: (filePath: string) => void;
}): void {
  // Prefer the private primers collection; fall back to repo root.
  const privateprimers = path.join(params.repoRoot, "modules-private", "wibwob-primers", "primers");
  const startDir = fs.existsSync(privateprimers) ? privateprimers : params.repoRoot;
  params.overlays.openFileBrowserPrompt("Open Primer", startDir, (filePath) => params.onOpenPrimer(filePath), {
    fileFilter: (filePath, isDirectory) => isDirectory || params.content.isTextLikeFile(path.basename(filePath)),
    previewLimit: 5000
  });
}

export function promptForEditorFile(params: {
  overlays: OverlayManager;
  content: ContentService;
  startDir: string;
  onOpenEditor: (filePath: string, title: string, content: string) => void;
}): void {
  params.overlays.openFileBrowserPrompt("Open Text File", params.startDir, (filePath) => {
    const content = safeReadFile(filePath);
    if (content !== undefined) {
      params.onOpenEditor(filePath, path.basename(filePath), content);
    } else {
      params.overlays.flash(`Cannot open text file: ${filePath}`);
    }
  }, {
    fileFilter: (filePath, isDirectory) => isDirectory || params.content.isTextLikeFile(path.basename(filePath)),
    previewLimit: 5000
  });
}

export function openPrimerFile(params: {
  overlays: OverlayManager;
  filePath: string;
  onOpenTextViewer: (
    title: string,
    content: string,
    kind: "primer",
    filePath: string,
    options: { contentMeasurement: ContentMeasurement; frames?: string[][] }
  ) => void;
}): void {
  const rawContent = safeReadFile(params.filePath);
  if (!rawContent) {
    params.overlays.flash(`Cannot read: ${params.filePath}`);
    return;
  }
  try {
    const measured = measurePrimerContent(rawContent);
    params.onOpenTextViewer(path.basename(params.filePath), measured.primaryFrameText, "primer", params.filePath, {
      contentMeasurement: measured.measurement,
      frames: measured.measurement.animated ? measured.frames : undefined
    });
  } catch (error) {
    params.overlays.flash(`Cannot open primer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function saveEditorWindow(params: {
  window: WindowRecord;
  overlays: OverlayManager;
  content: ContentService;
  defaultDir: string;
  onWritten: () => void;
}): void {
  if (!params.window.editor) {
    return;
  }
  if (!params.window.filePath) {
    params.overlays.openPathPrompt(
      "Save Text File Path",
      path.join(params.defaultDir, params.window.title),
      (value) => params.content.completePath(value),
      (value) => {
        const resolved = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
        // Stage the new path/title — only commit after successful write
        const oldPath = params.window.filePath;
        const oldTitle = params.window.title;
        params.window.filePath = resolved;
        params.window.title = path.basename(resolved);
        if (writeEditorWindow(params.window)) {
          params.onWritten();
        } else {
          // Roll back on failure
          params.window.filePath = oldPath;
          params.window.title = oldTitle;
        }
      }
    );
    return;
  }
  if (writeEditorWindow(params.window)) {
    params.onWritten();
  }
}

function writeEditorWindow(window: WindowRecord): boolean {
  if (!window.editor || !window.filePath) {
    return false;
  }
  if (!safeWriteFile(window.filePath, window.editor.value)) {
    return false;
  }
  window.title = path.basename(window.filePath);
  window.titleBar?.setContent(` ${window.title} `);
  return true;
}
