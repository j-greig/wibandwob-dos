/**
 * ui-parts-types.ts — Shared types for ui-parts and its sub-modules.
 *
 * Extracted to break circular dependency: ui-parts.ts re-exports from
 * ui-parts-{data,feedback,forms}.ts, which need Rect/LayoutPart from ui-parts.ts.
 * Now both sides import from this file instead.
 */
import type blessed from "blessed";

/** A positioned rectangle for layout. */
export type Rect = { top: number; left: number; width: number; height: number };

/** @primitive */
export type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

/** @primitive */
export type FlexBasis = number | `${number}fr`;

/** @primitive */
export type TrackSize = number | `${number}fr`;

/** @primitive — reserved for future use; not yet applied by layout functions. */
export type AxisAlign = "start" | "center" | "end";
