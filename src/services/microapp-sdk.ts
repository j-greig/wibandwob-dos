/**
 * microapp-sdk.ts — the ONE canonical import surface for microapp authors.
 *
 * Modules should import types and helpers from this file:
 *   import type { MicroappHost } from "../../src/services/microapp-sdk.js";
 *   import { createTimer, clamp } from "../../src/services/microapp-sdk.js";
 *
 * Do NOT import directly from src/core/* or other src/services/* files
 * unless the SDK genuinely does not re-export what you need.
 *
 * If something is missing, add the re-export here rather than bypassing.
 */
import type blessed from "blessed";
import {
  applyRect,
  createNodePart,
} from "../core/ui-parts.js";
import type { Rect, LayoutPart, FlexChild, GridChild, FlexBasis, TrackSize, AxisAlign, Alignment, Gap, LinearLayoutOptions } from "../core/ui-parts.js";
import type { BrowserEntry, GalleryTab } from "../core/types.js";
import {
  createContourPlayer,
  readNodeViewport,
  terrainNames,
  renderContour,
} from "./contour-engine.js";
import {
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  type SavedTerrainArtifact,
  type TerrainBiome,
  type TerrainMap,
  type TerrainObject,
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
  createEmbeddedLivePlayer,
  createLazyMountedPlayer,
  type AnimatedSurfaceTarget,
  type LazyMountedPlayer,
} from "./animation-service.js";
import { ContentService } from "./content-service.js";
import type {
  MicroappHost,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
} from "../sdk/microapp-host.js";

/** @public */
export {
  createAnimationClock,
  createLayoutReporter,
} from "../sdk/runtime-helpers.js";
/** @public */
export {
  fetchRuntimeCommands,
  fetchRuntimeHealth,
  fetchRuntimeInspection,
  getRuntimeControlApiBaseUrl,
} from "../sdk/runtime-client.js";

/** @public */
export type {
  AnimationClock,
  LayoutRegionRect,
  LayoutRegionSnapshot,
  LayoutReport,
  LayoutReporter,
} from "../sdk/runtime-helpers.js";
/** @public */
export type {
  RuntimeCommandsEnvelope,
  RuntimeHealthEnvelope,
  RuntimeInspectionEnvelope,
} from "../sdk/runtime-client.js";

// Canonical type-only import surface for microapp authors.
// Runtime capabilities still flow through the host object itself.
/** @public */
export type {
  MicroappHost,
  MicroappSnapshotWindow,
  MicroappWindowHandle,
  Rect,
  LayoutPart,
  FlexChild,
  LinearLayoutOptions,
  GridChild,
  FlexBasis,
  TrackSize,
  AxisAlign,
  Alignment,
  Gap,
  LazyMountedPlayer,
  SavedTerrainArtifact,
  TerrainBiome,
  TerrainMap,
  TerrainObject,
  TerrainPoint,
  TerrainRenderMode,
  BrowserEntry,
  GalleryTab,
};

/** @public */
export type AnimatedPanelPlayer = LazyMountedPlayer & {
  attachTarget?(target: blessed.Widgets.BoxElement): void;
};

// Shared runtime helpers that microapp authors should import from the SDK surface
// rather than reaching directly into core/service paths.
/** @public */
export {
  applyRect,
  createNodePart,
  createContourPlayer,
  createEmbeddedLivePlayer,
  createLazyMountedPlayer,
  readNodeViewport,
  terrainNames,
  renderContour,
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
// See microapps/sy2-chronicles/index.ts for the canonical MicroappHost pattern.
// ── ui-parts — layout primitives, directly importable ────────────────────────
// These are also available on host.ui.* but can be imported directly for
// cleaner module-level imports. host.ui.createLayoutButtonBar(...) and
// import { createLayoutButtonBar } from "microapp-sdk" are equivalent.
/** @internal */
export {
  clamp,
  createStack,
  createRow,
  createGrid,
  createScrollViewport,
  pickBreakpoint,
  DEFAULT_BREAKPOINTS,
  createLayoutHeaderBar,
  createLayoutStatusBar,
  createTextBlock,
  createLayoutInputLine,
  createMessageHistory,
  createLayoutRule,
  createFigletDisplay,
  createAnimatedPanel,
  createLayoutButtonBar,
  createBorderedPanel,
  createCollapsibleBlock,
  createContentStack,
  createSidebarPanel,
  resolveSidebarWidth,
  createSelectableList,
  createInlineSearch,
  createRestyleBundle,
  deferRender,
  // Tabbed container
  createLayoutTabs,
  // Pattern generators
  PATTERNS,
  patternBlockGradient,
  patternDiagonalHatch,
  patternDiamondGrid,
  patternBraille,
  patternCrossStitch,
  patternWave,
  patternHashInterference,
  patternCheckerboard,
  patternPipeMaze,
  patternBrailleDensity,
  patternConcentricRings,
  // Data simulation helpers
  sinWave,
  randHistory,
  xLabels,
  // Colour helpers
  hslToRgb,
  ansiGradientLine,
} from "../core/ui-parts.js";
/** @internal */
export type {
  InputLineProps,
  MessageHistoryEntry,
  MessageHistoryProps,
  BorderedPanelHandle,
  BorderedPanelOpts,
  BorderStyle,
  CollapsibleBlockProps,
  CollapsibleBlockHandle,
  ContentStackChild,
  ContentStackHandle,
  SidebarPanel,
  SidebarPanelOptions,
  SidebarWidth,
  SidebarWidthFixed,
  SidebarWidthPercent,
  SelectableListOptions,
  SelectableListHandle,
  InlineSearchOptions,
  InlineSearchHandle,
  RestyleEntry,
  RestyleBundleHandle,
  // Tabs
  TabDef as LayoutTabDef,
  TabbedContainerHandle,
  // Grid
  GridOptions,
  GridHandle,
  // Responsive
  BreakpointName,
  BreakpointEntry,
  // Scroll viewport
  ScrollViewportOptions,
  ScrollViewportHandle,
  // Patterns
  PatternGenerator,
} from "../core/ui-parts.js";

// ═══════════════════════════════════════════════════════════════════════════
// CORE MODULE AUTHORING — start here when building a new microapp
// ═══════════════════════════════════════════════════════════════════════════

// Timers — use instead of raw setInterval for proper cleanup
/** @internal */
export { createTimer, clearTimers } from "../core/ui-primitives.js";

// Scroll helpers — use with scrollable blessed boxes
/** @internal */
export { createScrollbar, scrollableStyle } from "../core/ui-primitives.js";

// Form controls — buttons, checkboxes, radio groups, selects, filterable lists, text areas
/** @internal */
export { createButton, createCheckbox, createRadioGroup, createSelect, createFilterableList, createFormField, createTextArea } from "../core/ui-parts-forms.js";
/** @internal */
export type {
  ButtonOptions, ButtonHandle, CheckboxOptions, CheckboxHandle,
  RadioOption, RadioGroupOptions, RadioGroupHandle,
  SelectOption, SelectOptions, SelectHandle,
  ChangeEvent, SelectEvent,
  FilterableItem, FilterableListOptions, FilterableListHandle,
  FormFieldOptions, FormFieldHandle,
  TextAreaOptions, TextAreaHandle,
} from "../core/ui-parts-forms.js";

// Feedback components — progress bars, spinners, toasts
/** @internal */
export { createProgressBar, createSpinner, createToast } from "../core/ui-parts-feedback.js";
/** @internal */
export type {
  ProgressBarOptions, ProgressBarHandle,
  SpinnerOptions, SpinnerHandle,
  ToastSeverity, ToastOptions, ToastHandle,
} from "../core/ui-parts-feedback.js";

// Data display components — key-value panels, log views, data tables
/** @internal */
export { createKeyValuePanel, createLogView, createDataTable } from "../core/ui-parts-data.js";
/** @internal */
export type {
  KVEntry, KeyValuePanelOptions, KeyValuePanelHandle,
  LogSeverity, LogEntry, LogViewOptions, LogViewHandle,
  DataColumn, DataTableOptions, DataTableHandle,
} from "../core/ui-parts-data.js";

// Motion / tween — animate values, window position and size smoothly
/** @internal */
export { tween, tweenWindowPosition, tweenWindowSize, EASINGS } from "./motion-service.js";
/** @internal */
export type { EasingFn, TweenOpts } from "./motion-service.js";

// Render monitoring — track frame rate and render pressure
/** @internal */
export { createRenderMonitor } from "../core/render-monitor.js";
/** @internal */
export type { RenderMonitorHandle, RenderReading } from "../core/render-monitor.js";

// Tree widget — hierarchical nav/explorer for sidebars
/** @internal */
export { createTreeWidget } from "../core/tree-widget.js";
/** @internal */
export type { TreeNode, TreeWidgetHandle } from "../core/tree-widget.js";

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION — for microapps with live/animated content
// ═══════════════════════════════════════════════════════════════════════════

/** @beta */
export type { AnimatedSurfaceTarget } from "./animation-service.js";

// ═══════════════════════════════════════════════════════════════════════════
// GRID CANVAS + ASCII COMPOSITION — for microapps that draw ASCII art
// ═══════════════════════════════════════════════════════════════════════════

/** @beta */
export { blankGrid, paintText, paintCentered, paintLines, drawArrow, gridToText, waveLine, bar } from "../core/grid-canvas.js";
/** @beta */
export { composeAsciiLayers, renderAsciiTextBlock } from "./ascii-composition.js";
/** @beta */
export type { AsciiBlendMode, AsciiCompositionNodeSpec, AsciiCompositionRole } from "./ascii-composition.js";

// ═══════════════════════════════════════════════════════════════════════════
// TEXT RENDERING — markdown and figlet
// ═══════════════════════════════════════════════════════════════════════════

/** @beta */
export { renderMarkdown, renderMarkdownFile, PLAIN_HEADING_CONFIG, DEFAULT_FIGLET_HEADING_CONFIG } from "./markdown-service.js";
/** @beta */
export type { RenderMarkdownOptions, FigletHeadingConfig } from "./markdown-service.js";
/** @beta */
export { renderFiglet, renderFigletLines, measureFiglet, isFigletAvailable, tryFiglet, responsiveFiglet, DEFAULT_FONT_CASCADE, getFigletCatalogue, getFigletFontChoices, getDefaultFigletFont, getFigletWindowContentSize } from "./figlet-service.js";
/** @beta */
export type { FigletMeasurement, FigletWindowContentSize, FigletCatalogue, FontCascadeTier } from "./figlet-service.js";

// ═══════════════════════════════════════════════════════════════════════════
// PANEL LAYOUT — for magazine-style multi-panel microapps (zine, sy2)
// ═══════════════════════════════════════════════════════════════════════════

/** @beta */
export { layoutPanels, layoutColumns, pointerToContent, hitPanel, measureViewport, COL_GAP } from "../core/panel-layout.js";
/** @beta */
export type { PanelDef, PanelNode, LayoutResult, ColumnLayoutResult, ColumnLayoutOptions, ColumnHeader } from "../core/panel-layout.js";
/** @beta */
export type { ZineItem, ZineLayoutResult, ZineItemType, CanvasDocument, CanvasColumnDef, CEPanelDef, PanelType } from "../core/canvas-types.js";
/** @beta */
export type { ZineSourceType } from "../core/canvas-types.js";

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED / BUILT-IN MODULE INTERNALS
// Below here are exports used by specific built-in modules (Monster Cam,
// GlitchBox, Terrain Lab, etc). Third-party modules typically do not need
// these. They are exported to avoid direct src/core/* imports.
// ═══════════════════════════════════════════════════════════════════════════

// Empty state placeholders (used by primer-browser, file-manager, etc)
/** @beta */
export {
  EMPTY_PRIMER_SELECTED,
  EMPTY_FILE_SELECTED,
  EMPTY_MATCHES,
  EMPTY_PLACEHOLDER,
  EMPTY_NO_MESSAGE,
} from "../core/empty-states.js";

// Monster Cam / webcam
/** @beta */
export { MonsterCamService } from "./monster-cam-service.js";
/** @beta */
export type { MonsterCamFrame } from "./monster-cam-service.js";
/** @beta */
export { renderWebcamFrame, gridToBlessedContent } from "./webcam-renderer.js";
/** @beta */
export type { WebcamCell, WebcamRenderOptions } from "./webcam-renderer.js";

// Skeleton / pose rendering (GlitchBox)
/** @beta */
export { landmarksFromPreset, POSE_PRESETS, POSE_CONNECTIONS, renderSkeletonAt } from "../core/skeleton-renderer.js";
/** @beta */
export type { NormalisedLandmarks } from "../core/skeleton-renderer.js";

// Plasma engine
/** @beta */
export { createPlasmaPlayer, moodNames, RENDER_MODES, extractMoodFromText, getMood } from "./plasma-engine.js";
/** @beta */
export type { PlasmaModifiers, PlasmaRenderMode, PlasmaPlayer, PlasmaMood, MoodAnalysis } from "./plasma-engine.js";

// Contour / terrain engine
/** @beta */
export { renderContourFromHills } from "./contour-engine.js";
/** @beta */
export type { ContourMode, ContourPlayer } from "./contour-engine.js";

// ═══════════════════════════════════════════════════════════════════════════
// SYNTAX HIGHLIGHTING — for code-editing microapps
// ═══════════════════════════════════════════════════════════════════════════

/** @public */
export { highlightCode, HIGHLIGHTED_LANGUAGES } from "./syntax-highlight.js";

// ═══════════════════════════════════════════════════════════════════════════
// THEME TYPES — for modules that register custom themes
// ═══════════════════════════════════════════════════════════════════════════

/** @public */
export type { ThemeVariant } from "../core/theme/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// SDK COMPOSITION HELPERS — themed UI primitives for microapp authors
// ═══════════════════════════════════════════════════════════════════════════

/** @public */
export {
  createStatusBar,
  createTextViewer,
  createListPanel,
  createSplitView,
  createButtonBar,
  createHeaderBar,
  createScrollView,
  createTabs,
  createRule,
  createInputLine,
} from "../sdk/composition-helpers.js";

/** @public */
export type {
  StatusBarOptions,
  StatusBarHandle,
  TextViewerOptions,
  TextViewerHandle,
  ListPanelOptions,
  ListPanelHandle,
  SplitViewOptions,
  SplitViewHandle,
  ButtonBarButton,
  ButtonBarOptions,
  ButtonBarHandle,
  HeaderBarOptions,
  HeaderBarHandle,
  ScrollViewOptions,
  ScrollViewHandle,
  HandleTabDef as TabDef,
  TabsOptions,
  TabsHandle,
  RuleOptions,
  RuleHandle,
  InputLineOptions,
  InputLineHandle,
} from "../sdk/composition-helpers.js";
