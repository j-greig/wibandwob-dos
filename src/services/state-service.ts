import fs from "node:fs";
import { safeReadFile, safeWriteFile } from "../core/safe-fs.js";
import path from "node:path";

import type { AppType, DesktopState, DesktopWindowState, TuiSkin, WindowRecord, WindowStateDetails } from "../core/types.js";
import type { RuntimeNodeDescriptor } from "../runtime/runtime-node.js";
import { themeName } from "../core/theme/resolver.js";
import { capabilityService } from "./capability-service.js";

interface StateServiceOptions {
  appName: string;
  appMode: string;
  cwd: string;
  runtimeNode: RuntimeNodeDescriptor;
  getMicroappReloadEpoch?: () => number;
  getControlApiStatus?: () => {
    enabled: boolean;
    port?: number;
    host?: string;
    baseUrl?: string;
  };
}

interface StateDependencies {
  getScreenSize: () => { width: number; height: number; cellAspect: number };
  getWindows: () => WindowRecord[];
  getFocusedWindow: () => WindowRecord | undefined;
  getOpenMenuLabel: () => string | undefined;
  getEffectiveSkin?: () => TuiSkin;
}

/**
 * Canonical live desktop state snapshot.
 *
 * Caching model: StateService maintains a cached `latestState` built from
 * window manager and screen dependencies. The cache is NOT automatically
 * invalidated — callers must trigger `sync()` after state-visible mutations.
 *
 * Two sync modes:
 * - `sync()` — rebuilds state in memory only. Cheap. Use after window
 *   mutations that should be visible via GET /state immediately.
 * - `persistAndNotify()` — rebuilds, writes to disk, and fires listeners.
 *   Heavier. Use for workspace-level events (save, load, theme change).
 *
 * Window factories that mutate state-visible fields (Finder: toggleView,
 * sortBy, search, navigateTo; Chrome browser: navigate) should accept an
 * `onStateChanged` callback and call it after mutations. The controller
 * wires this to `syncState()` which calls `sync()`.
 */
export type RuntimeEvent =
  | { type: "window-opened";    windowId: number; appType: string; title: string }
  | { type: "window-closed";    windowId: number; appType: string }
  | { type: "state-changed";    windowCount: number }
  | { type: "command-completed"; commandId: string; windowId?: number }
  | { type: "command-failed";   commandId: string; error: string }
  | { type: "microapp-reloaded"; microappId: string };

export class StateService {
  private latestState: DesktopState;
  private readonly listeners = new Set<(state: DesktopState) => void>();
  private readonly eventListeners = new Set<(event: RuntimeEvent) => void>();

  emitEvent(event: RuntimeEvent): void {
    for (const l of this.eventListeners) { try { l(event); } catch { /* ignore */ } }
  }

  subscribeEvents(listener: (event: RuntimeEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  constructor(
    private readonly options: StateServiceOptions,
    private readonly dependencies: StateDependencies
  ) {
    this.latestState = this.buildState();
  }

  getState(): DesktopState {
    return this.latestState;
  }

  subscribe(listener: (state: DesktopState) => void): () => void {
    this.listeners.add(listener);
    listener(this.latestState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sync(): DesktopState {
    const nextState = this.buildState();
    this.latestState = nextState;
    return nextState;
  }

  persistAndNotify(): DesktopState {
    const nextState = this.buildState();
    this.latestState = nextState;
    // Don't persist corrupt state from headless/piped runs — min sane terminal is 20×6
    if (nextState.screen.width >= 20 && nextState.screen.height >= 6) {
      fs.mkdirSync(path.dirname(this.options.runtimeNode.statePath), { recursive: true });
      safeWriteFile(this.options.runtimeNode.statePath, `${JSON.stringify(nextState, null, 2)}\n`);
    }
    for (const listener of this.listeners) {
      listener(nextState);
    }
    return nextState;
  }

  private buildState(): DesktopState {
    const screen = this.dependencies.getScreenSize();
    const windows = this.dependencies.getWindows();
    const focused = this.dependencies.getFocusedWindow();
    const openMenuLabel = this.dependencies.getOpenMenuLabel();

    const controlApi = this.options.getControlApiStatus?.();

    return {
      timestamp: new Date().toISOString(),
      app: {
        name: this.options.appName,
        mode: this.options.appMode,
        cwd: this.options.cwd,
        statePath: this.options.runtimeNode.statePath,
        scratchBase: this.options.runtimeNode.scratchBase,
        capturesDir: this.options.runtimeNode.capturesDir,
        workspacesDir: this.options.runtimeNode.workspacesDir,
        logsDir: this.options.runtimeNode.logsDir,
        instanceLabel: this.options.runtimeNode.instanceLabel,
        instanceId: this.options.runtimeNode.instanceId,
        deployProfile: process.env.WIBWOB_DEPLOY_PROFILE ?? null,
        controlApiEnabled: controlApi?.enabled,
        controlApiRequestedPort: this.options.runtimeNode.requestedApiPort,
        controlApiPort: controlApi?.port,
        controlApiHost: controlApi?.host ?? this.options.runtimeNode.host,
        controlApiBaseUrl: controlApi?.baseUrl,
        microappReloadEpoch: this.options.getMicroappReloadEpoch?.(),
        theme: themeName(),
        capabilities: capabilityService.snapshot()
      },
      screen: {
        width: screen.width,
        height: screen.height,
        cellAspect: screen.cellAspect,
        openWindowCount: windows.length
      },
      focus: {
        windowId: focused?.id,
        title: focused?.title,
        kind: focused?.kind
      },
      menu: {
        open: Boolean(openMenuLabel),
        label: openMenuLabel
      },
      windows: windows.map((window, index) => this.describeWindow(window, index, focused?.id)),
      skin: this.dependencies.getEffectiveSkin?.(),
    };
  }

  private describeWindow(window: WindowRecord, index: number, focusedId?: number): DesktopWindowState {
    const described = window.describeState?.();
    if (!described) {
      console.warn(`[state-service] Window "${window.title}" (kind=${window.kind}) has no describeState — appType will fall back to kind`);
    }
    const details: WindowStateDetails = described ?? {
      appType: window.kind as AppType,
      summary: window.filePath ? `File-backed ${window.kind} window.` : `${window.kind} window.`
    };

    // S04: surface missing hooks for broken microapps
    if (window.missingHooks?.length) {
      details.missingHooks = window.missingHooks;
    }

    // Inject clickable positions lazily (blessed node coords valid after render)
    if (window.clickables?.length) {
      const bodyTop = Number(window.body.atop) || 0;
      const bodyLeft = Number(window.body.aleft) || 0;
      details.clickables = window.clickables.map(({ label, node }) => ({
        label,
        row: (Number(node.atop) || 0) - bodyTop,
        col: (Number(node.aleft) || 0) - bodyLeft,
        width: Number(node.width) || 0,
      }));
    }

    return {
      id: window.id,
      appType: details.appType,
      title: window.title,
      _deprecated_kind: window.kind,
      left: Number(window.frame.left) || 0,
      top: Number(window.frame.top) || 0,
      width: Number(window.frame.width) || null,
      height: Number(window.frame.height) || null,
      zIndex: index,
      focused: window.id === focusedId,
      maximized: !!window.savedBounds,
      filePath: window.filePath,
      details
    };
  }
}
