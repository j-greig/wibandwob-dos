import type blessed from "blessed";
import {
  applyRect,
  createNodePart,
} from "../core/ui-parts.js";
import type { Rect, UiPart, StackChild } from "../core/ui-parts.js";
import type { BrowserEntry, GalleryTab } from "../core/types.js";
import type { StylePair } from "../core/theme/types.js";
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

export interface MicroappThemeVars {
  color?: string;
  background?: string;
  borderColor?: string;
  accentColor?: string;
  accentBackground?: string;
  mutedColor?: string;
}

export interface ResolvedMicroappTheme {
  body: StylePair;
  panel: StylePair & { borderFg?: string };
  accent: StylePair;
  muted: StylePair;
}

export function createMicroappTheme(
  host: MicroappHost,
  vars: MicroappThemeVars = {},
): ResolvedMicroappTheme {
  const base = host.theme();
  const body = {
    ...(base.body ?? {}),
    fg: vars.color ?? base.body?.fg,
    bg: vars.background ?? base.body?.bg,
  } satisfies StylePair;

  return {
    body,
    panel: {
      ...(base.bodyAlt ?? body),
      fg: vars.color ?? base.bodyAlt?.fg ?? body.fg,
      bg: vars.background ?? base.bodyAlt?.bg ?? body.bg,
      borderFg: vars.borderColor ?? base.selected?.fg ?? base.bodyAlt?.fg,
    },
    accent: {
      ...(base.selected ?? body),
      fg: vars.accentColor ?? base.selected?.fg ?? base.body?.fg,
      bg: vars.accentBackground ?? base.selected?.bg ?? base.bodyAlt?.bg,
    },
    muted: {
      ...(base.bodyAlt ?? body),
      fg: vars.mutedColor ?? base.bodyAlt?.fg ?? base.body?.fg,
      bg: vars.background ?? base.bodyAlt?.bg ?? base.body?.bg,
    },
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
