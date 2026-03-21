import { beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DATA_ROOT,
  ensureDirectoryExists,
  resolveDataRoot,
  resolveInstancePaths,
} from "../../core/config.js";

const originalEnv = { ...process.env };
const originalCwd = process.cwd();

describe("config runtime", () => {
  beforeEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    delete process.env.WIBWOB_DATA_DIR;
    delete process.env.WIBWOB_PROJECT_MODE;
  });

  test("resolveDataRoot: WIBWOB_DATA_DIR takes precedence", () => {
    process.env.WIBWOB_DATA_DIR = "/tmp/custom-wibwob";
    expect(resolveDataRoot()).toBe(path.resolve("/tmp/custom-wibwob"));
  });

  test("resolveDataRoot: WIBWOB_PROJECT_MODE=1 forces <cwd>/.wibwob", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-project-mode-"));
    process.chdir(temp);
    process.env.WIBWOB_PROJECT_MODE = "1";
    expect(resolveDataRoot()).toBe(path.join(process.cwd(), ".wibwob"));
  });

  test("resolveDataRoot: existing .wibwob in cwd implies project-local mode", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-project-dotdir-"));
    process.chdir(temp);
    fs.mkdirSync(path.join(process.cwd(), ".wibwob"), { recursive: true });
    expect(resolveDataRoot()).toBe(path.join(process.cwd(), ".wibwob"));
  });

  test("resolveDataRoot: fallback is ~/.wibwob (or ~/.wibwob-data if ~/.wibwob is a file)", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-global-fallback-"));
    process.chdir(temp);

    const globalDir = path.join(os.homedir(), ".wibwob");
    const expected = (() => {
      try {
        return fs.statSync(globalDir).isDirectory()
          ? globalDir
          : path.join(os.homedir(), ".wibwob-data");
      } catch {
        return globalDir;
      }
    })();

    expect(resolveDataRoot()).toBe(expected);
  });

  test("resolveDataRoot: existing .wibwob file in cwd does not imply project-local mode", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-project-dotfile-"));
    process.chdir(temp);
    const dotPath = path.join(process.cwd(), ".wibwob");
    fs.writeFileSync(dotPath, "not a dir");

    const resolved = resolveDataRoot();
    expect(resolved).not.toBe(dotPath);
  });

  test("resolveDataRoot: dev/local guard falls back when ~/.wibwob is a file", () => {
    // Run in a temp dir without .wibwob to isolate from project-local mode detection
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ww-dev-guard-fallback-"));
    process.chdir(temp);
    process.env.NODE_ENV = "development";
    const globalDir = path.join(os.homedir(), ".wibwob");
    const fallbackDir = path.join(os.homedir(), ".wibwob-data");

    const originalStatSync = fs.statSync;
    (fs as unknown as { statSync: typeof fs.statSync }).statSync = ((target: fs.PathLike) => {
      if (String(target) === globalDir) {
        return { isDirectory: () => false } as fs.Stats;
      }
      return originalStatSync(target);
    }) as typeof fs.statSync;

    try {
      expect(resolveDataRoot()).toBe(fallbackDir);
    } finally {
      (fs as unknown as { statSync: typeof fs.statSync }).statSync = originalStatSync;
    }
  });

  test("resolveInstancePaths: returns canonical instance-scoped layout", () => {
    const instanceId = "abc12345";
    const paths = resolveInstancePaths(instanceId);

    expect(paths.instanceRoot).toBe(path.join(DATA_ROOT, "instances", instanceId));
    expect(paths.workspacesDir).toBe(path.join(paths.instanceRoot, "workspaces"));
    expect(paths.exportsDir).toBe(path.join(paths.instanceRoot, "exports"));
    expect(paths.logsDir).toBe(path.join(paths.instanceRoot, "logs"));
    expect(paths.statePath).toBe(path.join(paths.instanceRoot, "state.json"));
    expect(paths.pidPath).toBe(path.join(paths.instanceRoot, "wibwob.pid"));
  });

  test("ensureDirectoryExists: creates missing nested directories", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-mkdir-"));
    const target = path.join(root, "a", "b", "c");
    ensureDirectoryExists(target);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.statSync(target).isDirectory()).toBe(true);
  });

  test("ensureDirectoryExists: maps EROFS to actionable error", () => {
    const original = fs.mkdirSync;
    (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = (() => {
      const err = Object.assign(new Error("read only"), { code: "EROFS" as const });
      throw err;
    }) as unknown as typeof fs.mkdirSync;

    try {
      let message = "";
      try {
        ensureDirectoryExists("/readonly/path");
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message.includes("read-only filesystem")).toBe(true);
    } finally {
      (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = original;
    }
  });

  test("ensureDirectoryExists: maps EACCES to actionable error", () => {
    const original = fs.mkdirSync;
    (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = (() => {
      const err = Object.assign(new Error("permission denied"), { code: "EACCES" as const });
      throw err;
    }) as unknown as typeof fs.mkdirSync;

    try {
      let message = "";
      try {
        ensureDirectoryExists("/no-permission/path");
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message.includes("Permission denied")).toBe(true);
    } finally {
      (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = original;
    }
  });

  test("ensureDirectoryExists: maps EEXIST non-directory to actionable error", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ww-e053-exist-file-"));
    const target = path.join(root, "not-a-dir");
    fs.writeFileSync(target, "x");

    let message = "";
    try {
      ensureDirectoryExists(target);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message.includes("not a directory")).toBe(true);
  });
});
