import fs from "node:fs";
import path from "node:path";

import type { WindowSnapshot } from "../core/types.js";

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

  save(snapshots: WindowSnapshot[]): void {
    fs.mkdirSync(this.workspaceDir, { recursive: true });
    fs.writeFileSync(this.path, JSON.stringify(snapshots, null, 2), "utf8");
  }

  load(): WindowSnapshot[] {
    return JSON.parse(fs.readFileSync(this.path, "utf8")) as WindowSnapshot[];
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
