import fs from "node:fs";
import path from "node:path";

import type { AppType, DesktopState, DesktopWindowState, WindowRecord, WindowStateDetails } from "../core/types.js";
import { themeName } from "../core/theme/resolver.js";
import { capabilityService } from "./capability-service.js";

interface StateServiceOptions {
  appName: string;
  appMode: string;
  cwd: string;
  statePath: string;
  instanceLabel?: string;
  sessionId: string;
  getControlApiStatus?: () => { enabled: boolean; port?: number };
}

interface StateDependencies {
  getScreenSize: () => { width: number; height: number; cellAspect: number };
  getWindows: () => WindowRecord[];
  getFocusedWindow: () => WindowRecord | undefined;
  getOpenMenuLabel: () => string | undefined;
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
export class StateService {
  private static readonly AUTO_SAVE_DEBOUNCE_MS = 2000;

  private latestState: DesktopState;
  private readonly listeners = new Set<(state: DesktopState) => void>();
  private autoSaveTimer?: ReturnType<typeof setTimeout>;

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
      this.writeStateAtomically(nextState);
    }
    for (const listener of this.listeners) {
      listener(nextState);
    }
    return nextState;
  }

  scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = undefined;
      this.persistAndNotify();
    }, StateService.AUTO_SAVE_DEBOUNCE_MS);
  }

  private writeStateAtomically(state: DesktopState): void {
    fs.mkdirSync(path.dirname(this.options.statePath), { recursive: true });
    const tempPath = `${this.options.statePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, this.options.statePath);
  }

  private buildState(): DesktopState {
    const screen = this.dependencies.getScreenSize();
    const windows = this.dependencies.getWindows();
    const focused = this.dependencies.getFocusedWindow();
    const openMenuLabel = this.dependencies.getOpenMenuLabel();

    return {
      timestamp: new Date().toISOString(),
      app: {
        name: this.options.appName,
        mode: this.options.appMode,
        cwd: this.options.cwd,
        statePath: this.options.statePath,
        instanceLabel: this.options.instanceLabel,
        sessionId: this.options.sessionId,
        controlApiEnabled: this.options.getControlApiStatus?.().enabled,
        controlApiPort: this.options.getControlApiStatus?.().port,
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
      windows: windows.map((window, index) => this.describeWindow(window, index, focused?.id))
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

    return {
      id: window.id,
      kind: window.kind,
      appType: details.appType,
      title: window.title,
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
