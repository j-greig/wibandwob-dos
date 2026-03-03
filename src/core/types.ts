import blessed from "blessed";
import type { ContentMeasurement } from "../services/content-measurement.js";

export type Box = blessed.Widgets.BoxElement;
export type List = blessed.Widgets.ListElement;
export type Textbox = blessed.Widgets.TextboxElement;
export type LogBox = Box & { log: (text: string) => void };

export type WindowKind =
  | "primer"
  | "editor"
  | "backrooms"
  | "browser"
  | "art"
  | "gallery"
  | "reader"
  | "figlet"
  | "pattern"
  | "chat"
  | "companion"
  | "workspace"
  | "palette"
  | "inspector"
  | "monster-cam";

export interface EditorState {
  widget: Box;
  value: string;
  cursor: number;
}

export interface BrowserEntry {
  label: string;
  filePath: string;
  metadata?: ContentMeasurement;
}

export interface BackroomsChannel {
  theme: string;
  primers: string;
  turns: number;
  model: "haiku" | "sonnet" | "opus";
  mode?: "auto" | "live" | "fake-live";
}

export interface PrimerGroup {
  label: string;
  entries: BrowserEntry[];
}

export interface GalleryTab {
  label: string;
  entries: BrowserEntry[];
}



export interface ChatMessageEntry {
  id: string;
  role: "system" | "user" | "assistant" | "status";
  text: string;
  streaming?: boolean;
}

export interface WindowSnapshot {
  kind: WindowKind;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  filePath?: string;
  focused?: boolean;
  payload?: Record<string, unknown>;
}

/**
 * Every window type that can be persisted to a workspace snapshot.
 * Add new types HERE — the snapshot registry and typecheck will
 * enforce that serialize/restore handlers exist for each one.
 */
export type PersistableAppType =
  | "primer-browser"
  | "farjs-file-manager"
  | "backrooms-log-browser"
  | "chrome-browser"
  | "backrooms-primer-picker"
  | "primer-gallery"
  | "figlet-banner"
  | "text-editor"
  | "generative-art"
  | "companion-widget"
  | "backrooms-tv"
  | "monster-cam"
  | "wibwob-agent"
  | "primer-viewer"
  | "reader-viewer"
  | "pattern-animation";

/**
 * Window types that are transient — never saved to workspace files.
 */
export type TransientAppType =
  | "command-palette"
  | "workspace-manager"
  | "state-inspector";

/**
 * Union of all known appType strings.
 * Use this to type describeState() return values in window factories.
 */
export type AppType = PersistableAppType | TransientAppType;

/**
 * Checked mappings from WindowKind to AppType for generic factories.
 * Add entries HERE when a new generic factory produces a persistable appType.
 * Using these instead of template-literal casts gives real compile-time safety.
 */
export const viewerAppType: Record<"primer" | "reader", PersistableAppType> = {
  primer: "primer-viewer",
  reader: "reader-viewer",
};

export const animationAppType: Record<"pattern", PersistableAppType> = {
  pattern: "pattern-animation",
};

export interface WindowStateDetails {
  appType: AppType;
  summary?: string;
  contentPreview?: string;
  lineCount?: number;
  [key: string]: unknown;
}

export interface DesktopWindowState {
  id: number;
  kind: WindowKind;
  appType: AppType;
  title: string;
  left: number;
  top: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  focused: boolean;
  filePath?: string;
  details: WindowStateDetails;
}

export interface DesktopState {
  timestamp: string;
  app: {
    name: string;
    mode: string;
    cwd: string;
    statePath: string;
    controlApiEnabled?: boolean;
    controlApiPort?: number;
    theme?: string;
  };
  screen: {
    width: number;
    height: number;
    cellAspect: number;
    openWindowCount: number;
  };
  focus: {
    windowId?: number;
    title?: string;
    kind?: WindowKind;
  };
  menu: {
    open: boolean;
    label?: string;
  };
  windows: DesktopWindowState[];
}

/**
 * WindowRecord — the live in-memory representation of an open window.
 *
 * Common fields are required on every window. Kind-specific fields are
 * optional and only populated by the relevant window factory.
 *
 * Type guards below narrow to specific window capabilities:
 *   isEditorWindow(w)  — has editor state, filePath, dirty tracking
 *   isFinderWindow(w)  — has finder controller
 */
export interface WindowRecord {
  id: number;
  kind: WindowKind;
  title: string;
  frame: Box;
  body: Box;
  close: () => void;
  focus: () => void;

  // Chrome elements (set by WindowManager.createFrame)
  titleBar?: Box;
  shadow?: Box;

  // Editor-specific (set by text-windows.ts)
  editor?: EditorState;
  filePath?: string;
  isDirty?: boolean;
  lastSavedContent?: string;

  // Finder-specific (set by content-windows.ts)
  finder?: FinderController;

  // Cross-cutting hooks — any window type may set these
  writeInput?: (input: string) => void;
  cleanup?: () => void;
  refresh?: () => void;
  onRestyle?: () => void;
  captureText?: () => string;
  describeState?: () => WindowStateDetails;
  openContextMenu?: (x?: number, y?: number) => void;
}

// ---------------------------------------------------------------------------
// Type guards — narrow WindowRecord to kind-specific capabilities.
// ---------------------------------------------------------------------------

/** Window with editor state, dirty tracking, and optional file path. */
export interface EditorWindowRecord extends WindowRecord {
  kind: "editor";
  editor: EditorState;
}

/** Window with a FinderController for search/navigate/sort commands. */
export interface FinderWindowRecord extends WindowRecord {
  kind: "browser";
  finder: FinderController;
}

/** Narrow to an editor window with guaranteed editor state. */
export function isEditorWindow(w: WindowRecord): w is EditorWindowRecord {
  return w.kind === "editor" && w.editor !== undefined;
}

/** Narrow to a finder window with guaranteed finder controller. */
export function isFinderWindow(w: WindowRecord): w is FinderWindowRecord {
  return w.kind === "browser" && w.finder !== undefined;
}

/** Controller interface exposed by Finder windows for command dispatch. */
export interface FinderController {
  search: (query: string, glob?: string) => void;
  navigateTo: (directoryPath: string) => void;
  toggleView: () => void;

  refresh: () => void;
  sortBy: (field: "name" | "size" | "modified" | "type") => void;
}

export interface DragState {
  windowId: number;
  originLeft: number;
  originTop: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export interface ResizeState {
  windowId: number;
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
  startX: number;
  startY: number;
}

export interface MenuItem {
  label: string;
  action: () => void;
}

export interface MenuConfig {
  label: string;
  key: string;
  left: number;
  items: MenuItem[];
}
