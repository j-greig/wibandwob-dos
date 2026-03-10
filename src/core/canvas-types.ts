/**
 * canvas-types.ts — Shared types for .canvas.yaml documents.
 *
 * Used by content-loader (parsing), ZINE (rendering), and any future
 * microapp that consumes canvas documents.
 */

import type { CEPanelDef } from "../../modules/sy2-chronicles/panel-types.js";

// ── ZineItem: unified layout primitive ────────────────────────────────────

/** Item types that the ZINE layout engine can position. */
export type ZineItemType = "panel" | "header" | "divider" | "spacer";

/** Editor hint for double-click dispatch. Maps to a global command id. */
export type ZineSourceType = "text" | "figlet" | "ascii-art";

/** A positioned rectangle on the ZINE canvas. */
export interface ZineItem {
  id: string;
  type: ZineItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  col?: number;
  title?: string;
  content?: (tick: number, w: number, h: number) => string;
  live?: boolean;
  /** What kind of editor should open on double-click. */
  sourceType?: ZineSourceType;
  headerText?: string;
  ruleChar?: string;
}

/** Result from ZINE column layout — a flat list of positioned items. */
export interface ZineLayoutResult {
  items: ZineItem[];
  contentWidth: number;
  contentHeight: number;
}

// ── Canvas document types ─────────────────────────────────────────────────

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
