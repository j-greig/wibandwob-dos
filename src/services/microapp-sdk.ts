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
  createLazyMountedPlayer,
};

// ── ui-parts — lower-level layout/chrome primitives ─────────────────────────
// These are used by host wiring and advanced module internals.
// For third-party microapp authoring, prefer composition helpers exported below
// (`createHeaderBar`, `createStatusBar`, `createButtonBar`, etc).
// `createLayout*` names remain for compatibility but are not the preferred API.
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

// Timers + teardown helpers — use instead of raw setInterval and brittle destroy chains
/** @internal */
export { createTimer, clearTimers, toEvenCellWidth, safeDestroy, safeDestroyAll } from "../core/ui-primitives.js";

// Scroll helpers — use with scrollable blessed boxes
/** @internal */
export { createScrollbar, scrollableStyle } from "../core/ui-primitives.js";

// Form controls — buttons, checkboxes, radio groups, selects, filterable lists, text areas
/** @internal */
export { createButton, createCheckbox, createToggleSwitch, createRadioGroup, createSelect, createSegmentedControl, createFilterableList, createFormField, createTextArea } from "../core/ui-parts-forms.js";
/** @internal */
export type {
  ButtonOptions, ButtonHandle, CheckboxOptions, CheckboxHandle,
  ToggleSwitchOptions, ToggleSwitchHandle,
  RadioOption, RadioGroupOptions, RadioGroupHandle,
  SelectOption, SelectOptions, SelectHandle,
  SegmentedControlOptions, SegmentedControlHandle,
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
export { tween, tweenPingPong, tweenSequence, tweenWindowPosition, tweenWindowSize, EASINGS } from "./motion-service.js";
/** @internal */
export type { EasingFn, TweenOpts, TweenPingPongOpts, TweenSequenceStep, TweenSequenceOpts } from "./motion-service.js";

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

/** @internal — host-only animation wiring; prefer createLazyMountedPlayer (@public) */
export { createEmbeddedLivePlayer } from "./animation-service.js";
/** @internal — host-side content discovery and primer loading; microapps receive content via the host object */
export { ContentService } from "./content-service.js";

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
export { renderFiglet, renderFigletLines, measureFiglet, isFigletAvailable, tryFiglet, responsiveFiglet, DEFAULT_FONT_CASCADE, getFigletCatalogue, getFigletFontChoices, getDefaultFigletFont, getFigletWindowContentSize, setFigletFavourites, toggleFigletFavourite } from "./figlet-service.js";
/** @beta */
export type { FigletMeasurement, FigletWindowContentSize, FigletCatalogue, FontCascadeTier, SetFigletFavouritesResult, ToggleFigletFavouriteResult } from "./figlet-service.js";

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
  createCanvas,
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
  CanvasOptions,
  CanvasHandle,
} from "../sdk/composition-helpers.js";
