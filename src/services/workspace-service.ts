import fs from "node:fs";
import path from "node:path";

import type { WindowSnapshot } from "../core/types.js";
import { safeReadJSON, safeWriteFile } from "../core/safe-fs.js";

/**
 * Workspace file envelope. Backward-compatible: old files are bare arrays.
 *
 * Restore failure modes:
 *   - Windows don't restore: default.json missing/corrupt — check scratch/workspaces/default.json
 *   - Wrong position: geometry saved as blessed "%" strings — use Number(frame.left) not raw frame.left
 *   - Type missing: describeState() absent or returns wrong appType — every persistable window needs it
 *   - Theme not restored: theme field missing from WorkspaceFile — pass currentTheme to save()
 *   - Focus wrong: focus() called mid-restore — move focus() call after the full restore loop
 *   - Alt instance uses main workspace: SCRATCH_DIR not set — set SCRATCH_DIR=scratch/alt
 */
export interface WorkspaceFile {
  version: 2;
  theme?: string;
  windows: WindowSnapshot[];
}

export class WorkspaceService {
  private currentWorkspaceName = "default";

  constructor(private readonly workspaceDir: string) {}

  get currentName(): string {
    return this.currentWorkspaceName;
  }

  get path(): string {
    return path.join(this.workspaceDir, `${this.currentWorkspaceName}.json`);
  }

  setCurrentWorkspaceName(name: string): void {
    this.currentWorkspaceName = this.sanitizeName(name);
  }

  save(snapshots: WindowSnapshot[], theme?: string): void {
    const file: WorkspaceFile = { version: 2, theme, windows: snapshots };
    safeWriteFile(this.path, JSON.stringify(file, null, 2));
  }

  load(): { windows: WindowSnapshot[]; theme?: string } {
    const raw = safeReadJSON<WorkspaceFile | WindowSnapshot[]>(this.path);
    if (!raw) return { windows: [] };
    // Backward compat: old files are bare WindowSnapshot[]
    if (Array.isArray(raw)) return { windows: raw };
    return { windows: (raw as WorkspaceFile).windows ?? [], theme: (raw as WorkspaceFile).theme };
  }

  exists(): boolean {
    return fs.existsSync(this.path);
  }

  list(): string[] {
    if (!fs.existsSync(this.workspaceDir)) {
      return [];
    }
    return fs
      .readdirSync(this.workspaceDir)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.replace(/\.json$/, ""))
      .sort((a, b) => a.localeCompare(b));
  }

  private sanitizeName(name: string): string {
    const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return cleaned || "default";
  }
}
