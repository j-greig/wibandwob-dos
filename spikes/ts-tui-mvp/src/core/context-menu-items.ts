import { execSync } from "node:child_process";
import type { MenuItem, WindowRecord } from "./types.js";

/**
 * Reusable file-path context menu items.
 * Use on any widget that displays a file path — log browser header,
 * editor title bar, primer viewer, etc.
 */
export function createFilePathMenuItems(filePath: string): MenuItem[] {
  const items: MenuItem[] = [
    {
      label: "Copy Path to Clipboard",
      action: () => {
        try {
          if (process.platform === "darwin") {
            execSync(`printf '%s' ${JSON.stringify(filePath)} | pbcopy`);
          } else {
            execSync(`printf '%s' ${JSON.stringify(filePath)} | xclip -selection clipboard 2>/dev/null || printf '%s' ${JSON.stringify(filePath)} | xsel --clipboard 2>/dev/null`);
          }
        } catch { /* clipboard not available — silent fail */ }
      }
    }
  ];
  if (process.platform === "darwin") {
    items.push({
      label: "Reveal in Finder",
      action: () => {
        try { execSync(`open -R ${JSON.stringify(filePath)}`); } catch { /* noop */ }
      }
    });
  }
  return items;
}

export interface SystemContextActions {
  openPrimerBrowser: () => void;
  openTextFile: () => void;
  openBackrooms: () => void;
  openPiChat: () => void;
  openWorkspaceManager: () => void;
  commandItems: MenuItem[];
}

export function createWindowContextMenuItems(
  window: WindowRecord,
  actions: {
    commandItems: MenuItem[];
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
  if (window.filePath) {
    items.push(...createFilePathMenuItems(window.filePath));
  }
  items.push(...actions.commandItems, { label: "Close Window", action: () => window.close() });
  return items;
}

export function createSystemContextMenuItems(actions: SystemContextActions): MenuItem[] {
  return [
    { label: "Open Primer Browser", action: actions.openPrimerBrowser },
    { label: "Open Text File", action: actions.openTextFile },
    { label: "Open Backrooms TV", action: actions.openBackrooms },
    { label: "Open Workspace Manager", action: actions.openWorkspaceManager },
    ...actions.commandItems,
    { label: "Open Pi Terminal (Legacy)", action: actions.openPiChat }
  ];
}
