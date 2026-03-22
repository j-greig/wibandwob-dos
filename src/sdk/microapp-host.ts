/**
 * microapp-host.ts — Host interface for microapp authors.
 *
 * MicroappHost is passed to your setup(host) function. It provides window creation,
 * command registration, theming, persistence, and desktop utilities.
 *
 * Import the type only:
 *   import type { MicroappHost } from "../../src/services/microapp-sdk.js";
 *
 * See SDK-MICROAPP-DEV.md for the full tutorial.
 */
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
  /** Create a desktop window. Returns a handle with `.body` (blessed BoxElement) to render into. */
  createWindow(init: {
    title: string;
    width?: number;
    height?: number;
    left?: number;
    top?: number;
  }): MicroappWindowHandle;

  /** Register a command. `id` is prefixed: microapp.<appId>.<id>. */
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

  /** Workspace persistence — serialize state on save, restore on workspace reload. Pair with `"persist": true` in microapp.json. */
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
  /**
   * Layout primitives accessor. Prefer top-level SDK imports over host.ui.*
   * — this accessor mixes CompositionHelpers (createHeaderBar) with LayoutParts
   * (createStack), which are NOT interchangeable. See GOTCHAS.md.
   */
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

/**
 * Window handle returned by `host.createWindow()`.
 *
 * Four hooks are required — prefer `registerMicroappHooks(win, {...})` from the SDK
 * to wire all four in one typed call. Missing hooks fail silently at runtime.
 */
export interface MicroappWindowHandle {
  readonly id: number;
  /** The blessed BoxElement to render into. Pass as `parent` to CompositionHelpers. */
  readonly body: blessed.Widgets.BoxElement;

  /** Called on window close. Stop all timers, destroy all handles. */
  onCleanup(fn: () => void): void;
  /** Called on theme switch. Re-apply `host.theme()` colours to every styled node. */
  onRestyle(fn: () => void): void;
  /** Called on window resize. Recalculate layouts if needed. */
  onResize(fn: () => void): void;
  /** Receives text injected via the API (agent input). NOT keyboard input. */
  onInput(fn: (input: string) => void): void;
  /** Structured state for `/state` API. Include a meaningful `summary` field. */
  describeState(fn: () => MicroappStateDetails): void;
  /** Plain text for `wibwob read <id>`. Return non-empty text even on blank state. */
  captureText(fn: () => string): void;

  focus(): void;
  close(): void;
  setFocusTarget(widget: blessed.Widgets.BlessedElement): void;
  setTitle(title: string): void;

  /**
   * Register a blessed node as a named clickable region on this window.
   * Positions appear in `wibwob state` under `details.clickables`.
   * Call this for any button, tab, or control an agent might want to click by label.
   * Composition helpers (createButtonBar, createTabs) call this automatically.
   * @public
   */
  registerClickable(node: blessed.Widgets.BlessedElement, label: string): void;
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
  focusOrCreate: (appType: string, createFn: () => void, multiInstance?: boolean) => { focused: boolean; windowId?: number };
  worldChat: WorldChatHostAccess;
  overlays?: OverlayManager;
  repoRoot?: string;
}

export type { Rect, LayoutPart, FlexChild, GridChild, DynamicCommandDefinition };
