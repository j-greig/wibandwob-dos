import fs from "node:fs";
import path from "node:path";

import type { DesktopState, DesktopWindowState, WindowRecord } from "../core/types.js";

interface StateServiceOptions {
  appName: string;
  appMode: string;
  cwd: string;
  statePath: string;
}

interface StateDependencies {
  getScreenSize: () => { width: number; height: number };
  getWindows: () => WindowRecord[];
  getFocusedWindow: () => WindowRecord | undefined;
  getOpenMenuLabel: () => string | undefined;
}

export class StateService {
  private latestState: DesktopState;
  private readonly listeners = new Set<(state: DesktopState) => void>();

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
    fs.mkdirSync(path.dirname(this.options.statePath), { recursive: true });
    fs.writeFileSync(this.options.statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
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

    return {
      timestamp: new Date().toISOString(),
      app: {
        name: this.options.appName,
        mode: this.options.appMode,
        cwd: this.options.cwd,
        statePath: this.options.statePath
      },
      screen: {
        width: screen.width,
        height: screen.height,
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
    const details = window.describeState?.() ?? {
      appType: window.kind,
      summary: window.filePath ? `File-backed ${window.kind} window.` : `${window.kind} window.`
    };

    return {
      id: window.id,
      kind: window.kind,
      appType: details.appType,
      title: window.title,
      left: Number(window.frame.left),
      top: Number(window.frame.top),
      width: Number(window.frame.width),
      height: Number(window.frame.height),
      zIndex: index,
      focused: window.id === focusedId,
      filePath: window.filePath,
      details
    };
  }
}
