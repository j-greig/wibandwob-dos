/**
 * browser-reader-window.ts — Read a file and open it in the text viewer.
 * Thin facade: reads file, delegates to onOpenTextViewer.
 */
import fs from "node:fs";
import path from "node:path";
import { safeReadFile, safeWriteFile } from "../core/safe-fs.js";

export function openBrowserReaderWindow(params: {
  filePath: string;
  onOpenTextViewer: (title: string, content: string, kind: "reader", filePath?: string) => void;
  onError: (message: string) => void;
}): void {
  try {
    const content = safeReadFile(params.filePath) ?? "";
    params.onOpenTextViewer(
      `Browser: ${path.basename(params.filePath)}`,
      `Location: ${params.filePath}\n\n${content}`,
      "reader",
      params.filePath,
    );
  } catch (error) {
    params.onError(`Cannot open browser reader: ${error instanceof Error ? error.message : String(error)}`);
  }
}
