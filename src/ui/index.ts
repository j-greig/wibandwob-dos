/**
 * src/ui/ — WibWob-DOS Terminal Design System
 *
 * Layers:
 *   types.ts     — Rect, LayoutPart, FlexBasis, TrackSize, AxisAlign
 *   layout.ts    — Stack, Row, Grid, breakpoints, rect helpers
 *   chrome.ts    — HeaderBar, StatusBar, TextBlock, InputLine, Rule, etc.
 *   containers.ts — ScrollViewport, BorderedPanel, Tabs, SidebarPanel, etc.
 *   data.ts      — KeyValuePanel, LogView, DataTable
 *   feedback.ts  — ProgressBar, Spinner, Toast
 *   forms.ts     — Button, Checkbox, RadioGroup, Select, FilterableList, etc.
 *   patterns.ts  — Pattern generators, data simulation, colour helpers
 *
 * Microapp authors: import from ../../src/services/microapp-sdk.js
 */
export * from "./types.js";
export * from "./layout.js";
export * from "./chrome.js";
export * from "./containers.js";
export * from "./data.js";
export * from "./feedback.js";
export * from "./forms.js";
export * from "./patterns.js";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — cross-cutting utilities for blessed list widgets
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely read the `selected` index from a blessed List widget.
 * blessed lists expose `.selected` at runtime but it's not in the type defs.
 * This helper replaces the repetitive `(list as List & { selected: number }).selected ?? 0`
 * cast pattern scattered across window files.
 *
 * §6 Say Things Once — one cast, used everywhere.
 */
export function getSelectedIndex(list: import("blessed").Widgets.ListElement): number {
  return (list as import("blessed").Widgets.ListElement & { selected: number }).selected ?? 0;
}
