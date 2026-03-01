import type { MenuItem, WindowRecord } from "./types.js";

export interface SystemContextActions {
  openPrimerBrowser: () => void;
  openTextFile: () => void;
  openBackrooms: () => void;
  openXTermShell: () => void;
  openWibWobChat: () => void;
  openWibWobAgent: () => void;
  openPiChat: () => void;
  openWorkspaceManager: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
}

export function createWindowContextMenuItems(
  window: WindowRecord,
  actions: {
    tileWindows: () => void;
    cascadeWindows: () => void;
    saveEditor?: () => void;
    saveAsEditor?: () => void;
  }
): MenuItem[] {
  const items: MenuItem[] = [
    { label: `Focus ${window.title}`, action: () => window.focus() },
  ];
  if (window.kind === "editor" && actions.saveEditor) {
    items.push({ label: "Save", action: actions.saveEditor });
  }
  if (window.kind === "editor" && actions.saveAsEditor) {
    items.push({ label: "Save As...", action: actions.saveAsEditor });
  }
  items.push(
    { label: "Tile Windows", action: actions.tileWindows },
    { label: "Cascade Windows", action: actions.cascadeWindows },
    { label: "Close Window", action: () => window.close() }
  );
  return items;
}

export function createSystemContextMenuItems(actions: SystemContextActions): MenuItem[] {
  return [
    { label: "Open Primer Browser", action: actions.openPrimerBrowser },
    { label: "Open Text File", action: actions.openTextFile },
    { label: "Open Backrooms TV", action: actions.openBackrooms },
    { label: "Open XTerm Shell", action: actions.openXTermShell },
    { label: "Open Wib&Wob Chat", action: actions.openWibWobChat },
    { label: "Open Pi Terminal (Legacy)", action: actions.openPiChat },
    { label: "Open Workspace Manager", action: actions.openWorkspaceManager },
    { label: "Tile Windows", action: actions.tileWindows },
    { label: "Cascade Windows", action: actions.cascadeWindows }
  ];
}
