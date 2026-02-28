import blessed from "blessed";

export type Box = blessed.Widgets.BoxElement;
export type List = blessed.Widgets.ListElement;
export type Textbox = blessed.Widgets.TextboxElement;
export type LogBox = Box & { log: (text: string) => void };

export type WindowKind =
  | "primer"
  | "editor"
  | "terminal"
  | "backrooms"
  | "browser"
  | "art"
  | "gallery"
  | "reader"
  | "figlet"
  | "pattern"
  | "orbit"
  | "glitch"
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
  metadata?: {
    contentWidth?: number;
    contentHeight?: number;
    recommendedWidth?: number;
    recommendedHeight?: number;
    animated?: boolean;
    frameCount?: number;
  };
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

export interface TerminalState {
  mode: "legacy" | "xterm-bridge";
  viewport?: Box;
  transcript?: LogBox;
  input?: Textbox;
  scrollViewport?: (delta: number) => void;
}

export interface ChatState {
  transcript: LogBox;
  input: Textbox;
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
  terminal?: TerminalState;
  chat?: ChatState;
  writeInput?: (input: string) => void;
  cleanup?: () => void;
  refresh?: () => void;
  describeState?: () => WindowStateDetails;
  openContextMenu?: (x?: number, y?: number) => void;
}

export interface DragState {
  windowId: number;
  offsetX: number;
  offsetY: number;
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
