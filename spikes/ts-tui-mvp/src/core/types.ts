import blessed from "blessed";

export type Box = blessed.Widgets.BoxElement;
export type List = blessed.Widgets.ListElement;
export type Textbox = blessed.Widgets.TextboxElement;
export type LogBox = Box & { log: (text: string) => void };

export type WindowKind =
  | "primer"
  | "editor"
  | "terminal"
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
  transcript: LogBox;
  input: Textbox;
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
  };
  screen: {
    width: number;
    height: number;
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
  describeState?: () => WindowStateDetails;
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
