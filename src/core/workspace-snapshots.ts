/**
 * Workspace snapshot save/restore.
 *
 * Delegates to snapshot-registry.ts for per-appType serialize/restore logic.
 * The registry uses a `satisfies Record<PersistableAppType, SnapshotHandler>`
 * assertion so the compiler refuses to build if any persistable window type
 * is missing a handler.
 */

import { registrySerialize, registryRestore } from "./snapshot-registry.js";
import type { SnapshotRestoreActions } from "./snapshot-registry.js";
import type { WindowRecord, WindowSnapshot } from "./types.js";

// Re-export so existing consumers can import from here
export type { SnapshotRestoreActions as WorkspaceRestoreActions };

export function serializeWindowSnapshot(window: WindowRecord, focusedId?: number): WindowSnapshot {
  return {
    kind: window.kind,
    title: window.title,
    left: Number(window.frame.left),
    top: Number(window.frame.top),
    width: Number(window.frame.width),
    height: Number(window.frame.height),
    filePath: window.filePath,
    focused: window.id === focusedId,
    payload: registrySerialize(window),
  };
}

export function restoreWindowSnapshot(
  snapshot: WindowSnapshot,
  actions: SnapshotRestoreActions
): WindowRecord | undefined {
  if (!registryRestore(snapshot, actions)) return undefined;

  const restored = actions.windows.getLastWindow();
  if (restored) {
    actions.windows.moveWindow(restored.id, snapshot.left, snapshot.top);
    actions.windows.resizeWindow(restored.id, snapshot.width, snapshot.height);
  }
  return restored;
}
