/**
 * WindowFacade — single contract for all window operations.
 *
 * Every consumer (control API, agent tools, workspace restore,
 * app controller internals) holds a WindowFacade reference.
 * No more bespoke wrapper interfaces.
 *
 * captureText always returns raw text. File export is the
 * caller's concern.
 */

import type { WindowRecord } from "./types.js";

export interface WindowFacade {
  // Query
  getWindows(): WindowRecord[];
  getWindowById(id: number): WindowRecord | undefined;
  getLastWindow(): WindowRecord | undefined;
  getFocusedWindow(): WindowRecord | undefined;

  // Geometry
  moveWindow(id: number, left: number, top: number): boolean;
  resizeWindow(id: number, width: number, height: number): boolean;
  toggleMaximize(id: number): boolean;
  focusWindow(id: number): boolean;
  closeWindow(id: number): boolean;

  // Content
  sendInput(id: number, input: string, sender?: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureText(id: number): string | undefined;

  // Clickable registration
  registerClickable(id: number, node: import("./types.js").Box, label: string): void;
  getClickables(id: number): Array<{ label: string; row: number; col: number; width: number }>;
}
