/**
 * WibWob SDK — single import surface for microapp authors.
 *
 * import { Button, List, createStack, MicroappHost } from '../src/core/sdk'
 */

// Core types from microapp SDK
export type {
  MicroappHost,
  MicroappWindowHandle,
  MicroappSnapshotWindow,
  AnimatedPanelPlayer,
  AnimationClock,
} from "../../services/microapp-sdk.js";

export {
  createAnimationClock,
  createContourPlayer,
  createLazyMountedPlayer,
  readNodeViewport,
  terrainNames,
} from "../../services/microapp-sdk.js";

// UiPart primitives
export type { Rect, UiPart, StackChild } from "../ui-parts.js";
export { createStack, createColumns } from "../ui-parts.js";
export { createHeaderBar, createStatusBar, createTextBlock } from "../ui-parts.js";
export { createRule, createFigletDisplay, createAnimatedPanel } from "../ui-parts.js";
export { createButtonBar, applyRect, createNodePart } from "../ui-parts.js";

// Design tokens
export { getTokens } from "./tokens.js";
export type { DesignTokens } from "./tokens.js";

// Window ports
export type { WindowPort, PortConnection } from "../window-port.js";
export { ConnectionService } from "../window-port.js";

// --- Elements: Interactive Primitives ---
export { createButton } from "./components/button.js";
export type { ButtonProps } from "./components/button.js";
export { createToggle } from "./components/toggle.js";
export type { ToggleProps } from "./components/toggle.js";
export { createTextInput } from "./components/text-input.js";
export type { TextInputProps } from "./components/text-input.js";
export { createProgressBar } from "./components/progress-bar.js";
export type { ProgressBarProps } from "./components/progress-bar.js";
export { createSpinner } from "./components/spinner.js";
export type { SpinnerProps } from "./components/spinner.js";
export { createBadge } from "./components/badge.js";
export type { BadgeProps } from "./components/badge.js";

// --- Elements: Data Display ---
export { createList } from "./components/list.js";
export type { ListProps } from "./components/list.js";
export { createTable } from "./components/table.js";
export type { TableProps, TableColumn } from "./components/table.js";
export { createTree } from "./components/tree.js";
export type { TreeProps, TreeNode } from "./components/tree.js";
export { createSparkline } from "./components/sparkline.js";
export type { SparklineProps } from "./components/sparkline.js";
export { createGauge } from "./components/gauge.js";
export type { GaugeProps } from "./components/gauge.js";

// --- Elements: Layout + Overlay ---
export { createTabs } from "./components/tabs.js";
export type { TabsProps, TabDef } from "./components/tabs.js";
export { createAccordion } from "./components/accordion.js";
export type { AccordionProps, AccordionSection } from "./components/accordion.js";
export { createSplitPane } from "./components/split-pane.js";
export type { SplitPaneProps } from "./components/split-pane.js";
export { createModal } from "./components/modal.js";
export type { ModalProps, ModalButton } from "./components/modal.js";
export { createNotification } from "./components/notification.js";
export type { NotificationProps } from "./components/notification.js";

// --- Elements: DAW + Music Viz ---
export { createPianoRoll } from "./components/daw/piano-roll.js";
export type { PianoRollProps } from "./components/daw/piano-roll.js";
export { createWaveform } from "./components/daw/waveform.js";
export type { WaveformProps } from "./components/daw/waveform.js";
export { createLevelMeter } from "./components/daw/level-meter.js";
export type { LevelMeterProps } from "./components/daw/level-meter.js";
export { createStepMatrix } from "./components/daw/step-matrix.js";
export type { StepMatrixProps } from "./components/daw/step-matrix.js";
export { createKnob } from "./components/daw/knob.js";
export type { KnobProps } from "./components/daw/knob.js";
export { createPatchCable } from "./components/daw/patch-cable.js";
export type { PatchCableProps } from "./components/daw/patch-cable.js";
export { createSpectrum } from "./components/daw/spectrum.js";
export type { SpectrumProps } from "./components/daw/spectrum.js";
