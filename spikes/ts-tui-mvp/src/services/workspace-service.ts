import fs from "node:fs";
import path from "node:path";

import type { WindowSnapshot } from "../core/types.js";

export class WorkspaceService {
  constructor(private readonly workspacePath: string) {}

  get path(): string {
    return this.workspacePath;
  }

  save(snapshots: WindowSnapshot[]): void {
    fs.mkdirSync(path.dirname(this.workspacePath), { recursive: true });
    fs.writeFileSync(this.workspacePath, JSON.stringify(snapshots, null, 2), "utf8");
  }

  load(): WindowSnapshot[] {
    return JSON.parse(fs.readFileSync(this.workspacePath, "utf8")) as WindowSnapshot[];
  }

  exists(): boolean {
    return fs.existsSync(this.workspacePath);
  }
}
