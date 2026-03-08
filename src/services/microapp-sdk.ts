import type blessed from "blessed";
import {
  applyRect,
  createNodePart,
} from "../core/ui-parts.js";
import type { Rect, UiPart, StackChild } from "../core/ui-parts.js";
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
import type {
  MicroappHost,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
} from "./module-loader.js";

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
};
