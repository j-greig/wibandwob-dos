import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import {
  createRuntimeWorkspaceService,
} from "../application/runtime-workspace-service.js";
import type { WindowSnapshot } from "../core/types.js";
import { WorkspaceService } from "../services/workspace-service.js";

const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempWorkspaceService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wibwob-runtime-workspace-"));
  tempDirs.push(dir);
  return new WorkspaceService(dir);
}

function makeSnapshots(): WindowSnapshot[] {
  return [
    {
      kind: "editor",
      title: "Notes",
      left: 2,
      top: 3,
      width: 40,
      height: 12,
      focused: true,
      payload: { appType: "text-editor" },
    },
  ];
}

describe("runtime workspace service", () => {
  test("save and load share one canonical workspace owner", () => {
    const workspace = makeTempWorkspaceService();
    const restored: WindowSnapshot[][] = [];
    const appliedThemes: string[] = [];
    let persistCalls = 0;
    let cleared = 0;

    const runtimeWorkspace = createRuntimeWorkspaceService({
      workspace,
      snapshotWindows: () => makeSnapshots(),
      getThemeName: () => "wibwob-dark",
      clearWindows: () => {
        cleared += 1;
      },
      restoreWindows: (snapshots) => {
        restored.push(snapshots);
      },
      applyThemeByName: (name) => {
        appliedThemes.push(name);
      },
      persistState: () => {
        persistCalls += 1;
      },
    });

    const saveResult = runtimeWorkspace.save("My Workspace");
    expect(saveResult.ok).toBe(true);
    expect(runtimeWorkspace.currentName).toBe("my-workspace");
    expect(fs.existsSync(runtimeWorkspace.path)).toBe(true);
    expect(persistCalls).toBe(1);

    const loadResult = runtimeWorkspace.load("My Workspace");
    expect(loadResult.ok).toBe(true);
    expect(cleared).toBe(1);
    expect(JSON.stringify(appliedThemes)).toBe(JSON.stringify(["wibwob-dark"]));
    expect(JSON.stringify(restored)).toBe(JSON.stringify([makeSnapshots()]));
    expect(persistCalls).toBe(2);
  });

  test("restoreDefault is silent when no default workspace exists", () => {
    const workspace = makeTempWorkspaceService();
    const runtimeWorkspace = createRuntimeWorkspaceService({
      workspace,
      snapshotWindows: () => [],
      getThemeName: () => "wibwob-dark",
      clearWindows: () => undefined,
      restoreWindows: () => undefined,
      applyThemeByName: () => undefined,
      persistState: () => undefined,
    });

    expect(runtimeWorkspace.restoreDefault()).toBeUndefined();
  });
});
