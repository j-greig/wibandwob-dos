/**
 * zine-widgets.ts — Thin wrappers around blessed primitives for zine canvas.
 *
 * Centralises all direct blessed usage so index.ts stays SDK-only.
 * Migration target: replace these with SDK Handle equivalents when available.
 */

import blessed from "blessed";

export type BoxElement = blessed.Widgets.BoxElement;
export type ListElement = blessed.Widgets.ListElement;
export type Screen = blessed.Widgets.Screen;
export type IKeyEventArg = blessed.Widgets.Events.IKeyEventArg;

export interface BoxOptions {
  parent?: BoxElement | Screen;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  width?: number | string;
  height?: number | string;
  content?: string;
  tags?: boolean;
  scrollable?: boolean;
  alwaysScroll?: boolean;
  scrollbar?: Record<string, unknown>;
  mouse?: boolean;
  keys?: boolean;
  style?: Record<string, unknown>;
  border?: Record<string, unknown> | string;
  label?: string;
}

export function createBox(opts: BoxOptions = {}): BoxElement {
  return blessed.box(opts as any);
}

export interface ListOptions {
  parent?: BoxElement;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  width?: number | string;
  height?: number | string;
  items?: string[];
  mouse?: boolean;
  keys?: boolean;
  tags?: boolean;
  style?: Record<string, unknown>;
  border?: Record<string, unknown> | string;
}

export function createList(opts: ListOptions = {}): ListElement {
  return blessed.list(opts as any);
}
