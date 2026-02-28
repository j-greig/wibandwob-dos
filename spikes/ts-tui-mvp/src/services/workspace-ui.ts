import fs from "node:fs";
import path from "node:path";

import type { OverlayManager } from "../core/overlay-manager.js";
import type { WorkspaceService } from "./workspace-service.js";

export function promptForWorkspaceSave(params: {
  overlays: OverlayManager;
  workspace: WorkspaceService;
  onSave: () => void;
  onAfterChange?: () => void;
}): void {
  params.overlays.openValuePrompt("Save Workspace As", params.workspace.currentName, (value) => {
    params.workspace.setCurrentWorkspaceName(value);
    params.onSave();
    params.onAfterChange?.();
  });
}

export function promptForWorkspaceLoad(params: {
  overlays: OverlayManager;
  workspace: WorkspaceService;
  workspaceDir: string;
  onLoad: () => void;
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
    params.workspace.setCurrentWorkspaceName(item.value);
    params.onLoad();
  });
}
