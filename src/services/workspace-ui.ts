import fs from "node:fs";
import path from "node:path";

import type { OverlayManager } from "../core/overlay-manager.js";
import type {
  RuntimeWorkspaceResult,
  RuntimeWorkspaceService,
} from "../application/runtime-workspace-service.js";

export function promptForWorkspaceSave(params: {
  overlays: OverlayManager;
  workspace: Pick<RuntimeWorkspaceService, "currentName" | "save">;
  onResult?: (result: RuntimeWorkspaceResult) => void;
}): void {
  params.overlays.openValuePrompt("Save Workspace As", params.workspace.currentName, (value) => {
    params.onResult?.(params.workspace.save(value));
  });
}

export function promptForWorkspaceLoad(params: {
  overlays: OverlayManager;
  workspace: Pick<RuntimeWorkspaceService, "currentName" | "list" | "load">;
  workspaceDir: string;
  onResult?: (result: RuntimeWorkspaceResult) => void;
}): void {
  const names = params.workspace.list();
  if (names.length === 0) {
    params.overlays.flash(`No saved workspaces found in ${params.workspaceDir}`);
    return;
  }
  const items = names.map((name) => ({
    label: `${name}${name === params.workspace.currentName ? " (current)" : ""}`,
    value: name,
    preview: `${path.join(params.workspaceDir, `${name}.json`)}\n\n${fs.readFileSync(path.join(params.workspaceDir, `${name}.json`), "utf8")}`,
    searchText: name
  }));
  const initialIndex = Math.max(0, names.findIndex((name) => name === params.workspace.currentName));
  params.overlays.openBrowserPrompt("Load Workspace", items, initialIndex, (item) => {
    params.onResult?.(params.workspace.load(item.value));
  });
}
