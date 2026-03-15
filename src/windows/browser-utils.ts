/**
 * browser-utils.ts — Shared utilities for content-oriented window factories.
 */
import { clipToVisibleWidth, padToWidth } from "../core/ansi-utils.js";
import type { Box } from "../core/types.js";

/** Percent of window width given to the list/left pane; preview gets the rest. */
export const PREVIEW_SPLIT_RATIO = 42;

/** Strip .txt/.md extension for display. */
export const cleanLabel = (label: string) => label.replace(/\.(txt|md)$/i, "");

/** Truncate a line by visible width and pad to a fixed viewport width. */
export function fitLineToWidth(line: string, width: number): string {
  if (width <= 0) return "";
  return padToWidth(clipToVisibleWidth(line, width), width);
}

/** Convert raw text into viewport-safe lines, accounting for inner width and scrollbar, then setContent. */
export function setViewportContent(viewport: Box, raw: string): void {
  const outer = Math.max(1, Number(viewport.width) || 1);
  const iw = Number((viewport as any).iwidth ?? 0);
  const sb = (viewport as any).scrollbar ? 1 : 0;
  const width = Math.max(1, outer - iw - sb);
  if (width <= 0) return;
  const minRows = Math.max(1, Number(viewport.height) || 1);
  const hasTags = !!(viewport as any).parseTags;
  const rows = raw.replace(/\r\n/g, "\n").split("\n").map((line) =>
    hasTags ? line : fitLineToWidth(line, width)
  );
  while (rows.length < minRows) {
    rows.push(" ".repeat(width));
  }
  viewport.setContent(rows.join("\n"));
}
