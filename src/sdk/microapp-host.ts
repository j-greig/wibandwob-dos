import type blessed from "blessed";

import type { DynamicCommandDefinition } from "../core/command-registry.js";
import type { ThemeVariant, ThemeTokens } from "../core/theme/types.js";
import {
  createAnimatedPanel,
  createLayoutButtonBar,
  createFigletDisplay,
  createHeaderBar,
  createRow,
  createRule,
  createStack,
  createLayoutStatusBar,
  createTextBlock,
  applyRect,
} from "../core/ui-parts.js";
import type { FlexChild, GridChild, LayoutPart, Rect } from "../core/ui-parts.js";
import type { WindowFacade } from "../core/window-facade.js";
import type { WindowManager } from "../core/window-manager.js";
import type { OverlayManager } from "../core/overlay-manager.js";
import type { CommandRegistry } from "../core/command-registry.js";
import type { WindowRecord, WindowSnapshot } from "../core/types.js";
import type {
  Chatspot,
  WorldChannel,
  WorldChatChangeEvent,
} from "../services/world-chat-service.js";
import type { WorldChatTransportStatus } from "../services/world-chat-transport.js";

export interface MicroappHost {
  createWindow(init: {
    title: string;
    width?: number;
    height?: number;
    left?: number;
    top?: number;
  }): MicroappWindowHandle;

  registerCommand(def: {
    id: string;
    label: string;
    description?: string;
    action: (args?: Record<string, unknown>) => void;
    multiInstance?: boolean;
    direct?: boolean;
    menu?: { category: string; order: number; label?: string }[];
    palette?: { order: number; label?: string };
  }): void;

  registerSnapshot(handlers: {
    serialize: (window: WindowRecord) => Record<string, unknown> | undefined;
    restore: (snapshot: WindowSnapshot, payload: Record<string, unknown>) => void;
  }): void;

  registerTheme(variant: ThemeVariant): void;
  runCommand(localId: string, args?: Record<string, unknown>): void;
  runGlobalCommand(id: string, args?: Record<string, unknown>): void;

  readonly screen: blessed.Widgets.Screen;
  readonly geometry: { width: number; height: number; cellAspect: number };
  readonly theme: () => ThemeTokens;
  readonly windows: WindowFacade;
  readonly worldChat: WorldChatHostAccess;
  readonly ui: {
    createStack: typeof createStack;
    createRow: typeof createRow;
    createHeaderBar: typeof createHeaderBar;
    createStatusBar: typeof createLayoutStatusBar;
    createLayoutStatusBar: typeof createLayoutStatusBar; // legacy alias
    createTextBlock: typeof createTextBlock;
    createRule: typeof createRule;
    createFigletDisplay: typeof createFigletDisplay;
    createAnimatedPanel: typeof createAnimatedPanel;
    createButtonBar: typeof createLayoutButtonBar;
    createLayoutButtonBar: typeof createLayoutButtonBar; // legacy alias
    applyRect: typeof applyRect;
  };

  pickFile(label: string, startDir: string, onSelect: (filePath: string) => void, options?: {
    fileFilter?: (filePath: string, isDirectory: boolean) => boolean;
    previewLimit?: number;
    directoriesOnly?: boolean;
  }): void;
  flash(message: string): void;
  promptValue(label: string, defaultValue: string, onSubmit: (value: string) => void): void;
  readonly repoRoot: string;
}

export type MicroappSnapshotWindow = { describeState?: () => Record<string, unknown> };

export interface MicroappWindowHandle {
  readonly id: number;
  readonly body: blessed.Widgets.BoxElement;

  onCleanup(fn: () => void): void;
  onRestyle(fn: () => void): void;
  onResize(fn: () => void): void;
  onInput(fn: (input: string) => void): void;
  describeState(fn: () => MicroappStateDetails): void;
  captureText(fn: () => string): void;

  focus(): void;
  close(): void;
  setFocusTarget(widget: blessed.Widgets.BlessedElement): void;
  setTitle(title: string): void;
}

export interface MicroappStateDetails {
  summary?: string;
  contentPreview?: string;
  [key: string]: unknown;
}

export interface WorldChatHostAccess {
  ensureWorld(worldKey: string, width: number, height: number): Chatspot[];
  nearestChatspot(x: number, y: number): Chatspot | undefined;
  listChannels(): WorldChannel[];
  readChannel(channelId: string): WorldChannel | undefined;
  joinChannel(agentId: string, channelId: string): WorldChannel | undefined;
  sendMessage(agentId: string, channelId: string, text: string): WorldChannel | undefined;
  getTransportStatus(): WorldChatTransportStatus;
  subscribe(listener: (event: WorldChatChangeEvent) => void): () => void;
}

export interface MicroappHostDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  commands: CommandRegistry;
  geometry: { width: number; height: number; cellAspect: number };
  focusOrCreate: (appType: string, createFn: () => void, multiInstance?: boolean) => void;
  worldChat: WorldChatHostAccess;
  overlays?: OverlayManager;
  repoRoot?: string;
}

export type { Rect, LayoutPart, FlexChild, GridChild, DynamicCommandDefinition };
