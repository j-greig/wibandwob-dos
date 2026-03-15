import type { WindowSnapshot } from "../core/types.js";
import type { WorkspaceService } from "../services/workspace-service.js";

export interface RuntimeWorkspaceResultSuccess {
  ok: true;
  name: string;
  path: string;
  windows: number;
  theme?: string;
}

export interface RuntimeWorkspaceResultFailure {
  ok: false;
  name: string;
  path: string;
  error: string;
}

export type RuntimeWorkspaceResult =
  | RuntimeWorkspaceResultSuccess
  | RuntimeWorkspaceResultFailure;

export interface RuntimeWorkspaceLoadOptions {
  replaceExisting?: boolean;
  persistState?: boolean;
}

export interface RuntimeWorkspaceService {
  readonly currentName: string;
  readonly path: string;
  list(): string[];
  save(name?: string): RuntimeWorkspaceResult;
  autoSave(name?: string): void;
  load(name?: string, options?: RuntimeWorkspaceLoadOptions): RuntimeWorkspaceResult;
  restoreDefault(): RuntimeWorkspaceResult | undefined;
}

interface RuntimeWorkspaceServiceDeps {
  workspace: WorkspaceService;
  snapshotWindows: () => WindowSnapshot[];
  getThemeName: () => string;
  clearWindows: () => void;
  restoreWindows: (snapshots: WindowSnapshot[]) => void;
  applyThemeByName: (name: string) => void;
  persistState: () => void;
}

export function createRuntimeWorkspaceService(
  deps: RuntimeWorkspaceServiceDeps,
): RuntimeWorkspaceService {
  const selectWorkspace = (name?: string): void => {
    if (typeof name === "string") {
      deps.workspace.setCurrentWorkspaceName(name);
    }
  };

  const failure = (error: string): RuntimeWorkspaceResultFailure => ({
    ok: false,
    name: deps.workspace.currentName,
    path: deps.workspace.path,
    error,
  });

  const success = (
    windows: number,
    theme?: string,
  ): RuntimeWorkspaceResultSuccess => ({
    ok: true,
    name: deps.workspace.currentName,
    path: deps.workspace.path,
    windows,
    theme,
  });

  const loadSelected = (
    name?: string,
    options?: RuntimeWorkspaceLoadOptions,
  ): RuntimeWorkspaceResult => {
    selectWorkspace(name);
    if (!deps.workspace.exists()) {
      return failure(`Workspace file not found: ${deps.workspace.path}`);
    }

    let snapshots: WindowSnapshot[] = [];
    let savedTheme: string | undefined;
    try {
      const loaded = deps.workspace.load();
      snapshots = loaded.windows;
      savedTheme = loaded.theme;
    } catch (error) {
      return failure(
        `Cannot parse workspace: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (savedTheme) {
      deps.applyThemeByName(savedTheme);
    }
    if (options?.replaceExisting !== false) {
      deps.clearWindows();
    }
    deps.restoreWindows(snapshots);
    if (options?.persistState !== false) {
      deps.persistState();
    }
    return success(snapshots.length, savedTheme);
  };

  return {
    get currentName() {
      return deps.workspace.currentName;
    },
    get path() {
      return deps.workspace.path;
    },
    list: () => deps.workspace.list(),
    save: (name) => {
      selectWorkspace(name);
      try {
        const snapshots = deps.snapshotWindows();
        const theme = deps.getThemeName();
        deps.workspace.save(snapshots, theme);
        deps.persistState();
        return success(snapshots.length, theme);
      } catch (error) {
        return failure(
          `Cannot save workspace: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    autoSave: (name) => {
      selectWorkspace(name);
      try {
        deps.workspace.save(deps.snapshotWindows(), deps.getThemeName());
      } catch {
        // Best-effort only. Shutdown and reload paths must not block on autosave.
      }
    },
    load: loadSelected,
    restoreDefault: () => {
      if (!deps.workspace.exists()) {
        return undefined;
      }
      return loadSelected(undefined, { replaceExisting: false, persistState: false });
    },
  };
}
