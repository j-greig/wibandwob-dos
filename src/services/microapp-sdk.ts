import type blessed from "blessed";
import {
  applyRect,
  createNodePart,
} from "../core/ui-parts.js";
import type { Rect, UiPart, StackChild } from "../core/ui-parts.js";
import type { BrowserEntry, GalleryTab } from "../core/types.js";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
} from "./contour-engine.js";
import {
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  type SavedTerrainArtifact,
  type TerrainBiome,
  type TerrainMap,
  type TerrainPoint,
} from "./terrain-model.js";
import {
  BIOME_COLORS,
  BIOME_GLYPHS,
  findTerrainPeak,
  renderTerrainMap,
  type TerrainRenderMode,
} from "./terrain-render.js";
import {
  createLazyMountedPlayer,
  type LazyMountedPlayer,
} from "./animation-service.js";
import { ContentService } from "./content-service.js";
import type {
  MicroappHost,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
} from "./module-loader.js";

export interface AnimationClock {
  readonly tick: number;
  subscribe(handler: (tick: number) => void): () => void;  // returns unsubscribe fn
  play(): void;
  pause(): void;
  destroy(): void;
}

export function createAnimationClock(fps: number): AnimationClock {
  let tick = 0;
  let running = true;
  const handlers = new Set<(tick: number) => void>();
  const interval = setInterval(() => {
    if (!running) return;
    tick++;
    for (const h of handlers) h(tick);
  }, Math.round(1000 / fps));
  return {
    get tick() { return tick; },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    play() { running = true; },
    pause() { running = false; },
    destroy() { clearInterval(interval); handlers.clear(); },
  };
}

// Canonical type-only import surface for module authors.
// Runtime capabilities still flow through the host object itself.
export type {
  MicroappHost,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
  Rect,
  UiPart,
  StackChild,
  LazyMountedPlayer,
  SavedTerrainArtifact,
  TerrainBiome,
  TerrainMap,
  TerrainPoint,
  TerrainRenderMode,
  BrowserEntry,
  GalleryTab,
};

export type AnimatedPanelPlayer = LazyMountedPlayer & {
  attachTarget?(target: blessed.Widgets.BoxElement): void;
};

// Shared runtime helpers that module authors should import from the SDK surface
// rather than reaching directly into core/service paths.
export {
  applyRect,
  createNodePart,
  createContourPlayer,
  createLazyMountedPlayer,
  readNodeViewport,
  terrainNames,
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  BIOME_COLORS,
  BIOME_GLYPHS,
  findTerrainPeak,
  renderTerrainMap,
  ContentService,
};

// Webcam / Monster Cam — portable feed + renderer for embedding in any microapp.
// See modules/sy2-chronicles/index.ts for the canonical MicroappHost pattern.
// ── ui-parts — layout primitives, directly importable ────────────────────────
// These are also available on host.ui.* but can be imported directly for
// cleaner module-level imports. host.ui.createButtonBar(...) and
// import { createButtonBar } from "microapp-sdk" are equivalent.
export {
  createStack,
  createColumns,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createInputLine,
  createMessageHistory,
  createRule,
  createFigletDisplay,
  createAnimatedPanel,
  createButtonBar,
  createBorderedPanel,
} from "../core/ui-parts.js";
export type {
  InputLineProps,
  MessageHistoryEntry,
  MessageHistoryProps,
  BorderedPanelHandle,
  BorderedPanelOpts,
  BorderStyle,
} from "../core/ui-parts.js";

export { createRenderMonitor } from "../core/render-monitor.js";
export type { RenderMonitorHandle, RenderReading } from "../core/render-monitor.js";
export { MonsterCamService } from "./monster-cam-service.js";
export type { MonsterCamFrame } from "./monster-cam-service.js";
export { renderWebcamFrame, gridToBlessedContent } from "./webcam-renderer.js";
export type { WebcamCell, WebcamRenderOptions } from "./webcam-renderer.js";

// Panel layout + grid canvas — primitives for magazine-layout microapps
export { layoutPanels, pointerToContent, hitPanel, measureViewport, COL_GAP } from "../core/panel-layout.js";
export type { PanelDef, PanelNode, LayoutResult } from "../core/panel-layout.js";
export { blankGrid, paintText, paintCentered, paintLines, drawArrow, gridToText, waveLine, bar } from "../core/grid-canvas.js";
