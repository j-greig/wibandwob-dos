/**
 * canvas-types.ts — Shared types for .canvas.yaml documents.
 *
 * Used by content-loader (parsing), ZINE (rendering), and any future
 * microapp that consumes canvas documents.
 */

import type { CEPanelDef } from "../../modules/sy2-chronicles/panel-types.js";

/** Column definition in a canvas document. */
export interface CanvasColumnDef {
  /** Header text displayed above the column. */
  header?: string;
}

/** Parsed .canvas.yaml document. */
export interface CanvasDocument {
  /** Document title (from meta.title). */
  title: string;
  /** Whether to show column headers (from meta.columnHeaders). */
  columnHeaders: boolean;
  /** Per-column definitions keyed by column index. */
  columns: Map<number, CanvasColumnDef>;
  /** Panel definitions. */
  panels: CEPanelDef[];
}
