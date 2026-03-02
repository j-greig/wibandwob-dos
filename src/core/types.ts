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
  | "inspector";

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



export type TaskLoopStatus = "pending" | "passed";

export interface ChatTaskItem {
  title: string;
  description: string;
  status: TaskLoopStatus;
}

export interface ChatTaskStory {
  title: string;
  description: string;
  status: TaskLoopStatus;
  items: ChatTaskItem[];
}

export interface ChatTaskLoop {
  stories: ChatTaskStory[];
}

export interface ChatMessageEntry {
  id: string;
  role: "system" | "user" | "assistant" | "status";
  text: string;
  streaming?: boolean;
}

export interface ChatState {
  mode: "synthetic" | "pi-sdk";
  transcript: Box;
  input: Box | Textbox;
  getTranscriptLines: () => string[];
  getDraft: () => string;
  setDraft: (value: string) => void;
  submit: (value?: string) => void;
  taskLoop?: ChatTaskLoop;
  messages?: ChatMessageEntry[];
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

export interface WindowStateDetails {
  appType: string;
  summary?: string;
  contentPreview?: string;
  lineCount?: number;
  [key: string]: unknown;
}

export interface DesktopWindowState {
  id: number;
  kind: WindowKind;
  appType: string;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
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

export interface WindowRecord {
  id: number;
  kind: WindowKind;
  title: string;
  frame: Box;
  body: Box;
  close: () => void;
  focus: () => void;
  titleBar?: Box;
  editor?: EditorState;
  filePath?: string;
  isDirty?: boolean;
  lastSavedContent?: string;
  chat?: ChatState;
  writeInput?: (input: string) => void;
  cleanup?: () => void;
  refresh?: () => void;
  captureText?: () => string;
  describeState?: () => WindowStateDetails;
  openContextMenu?: (x?: number, y?: number) => void;
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
