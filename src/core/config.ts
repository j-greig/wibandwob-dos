import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const PRIMER_ROOTS = ["microapps", "microapps-private", "docs"] as const;

const APP_FILE = fileURLToPath(import.meta.url);
const CONFIG_ROOT = path.dirname(APP_FILE);
export const SRC_ROOT = path.resolve(CONFIG_ROOT, "..");
/** Post-migration: app root and repo root are the same directory. */
export const APP_ROOT = path.resolve(SRC_ROOT, "..");
export const REPO_ROOT = APP_ROOT;
export const PI_DIR = path.join(APP_ROOT, ".pi");
export const PI_APPEND_SYSTEM_PATH = path.join(PI_DIR, "APPEND_SYSTEM.md");
export const PI_THEME_PATH = path.join(PI_DIR, "themes", "wibwob-tv.json");

// ─────────────────────────────────────────────────────────────────────────
// Runtime Data Root — mutable runtime-owned data location
// Resolution order per e053 spec:
//   1. WIBWOB_DATA_DIR (env)
//   2. project .wibwob/ (explicit mode OR cwd has .wibwob)
//   3. ~/.wibwob/ (default stable location)
//   4. OS temp dir only if no home dir available
// ─────────────────────────────────────────────────────────────────────────

/** Resolve the runtime data root.
 * This is where mutable runtime-owned data lives (workspaces, exports, logs, etc).
 * Immutable package assets (built-in microapps, themes) stay in APP_ROOT.
 * 
 * Selection is based on intent (env/mode), not filesystem presence.
 * The directory will be created if it doesn't exist. */
export function resolveDataRoot(): string {
  // 1. Explicit override (strongest signal)
  if (process.env.WIBWOB_DATA_DIR) {
    return path.resolve(process.env.WIBWOB_DATA_DIR);
  }

  // 2. Project-local mode (explicit or inferred from .wibwob presence)
  const projectRoot = process.cwd();
  const projectDataDir = path.join(projectRoot, ".wibwob");

  // Explicit project mode via env
  if (process.env.WIBWOB_PROJECT_MODE === "1") {
    return projectDataDir;
  }

  // Weak signal: treat existing .wibwob as project indicator
  if (fs.existsSync(projectDataDir)) {
    return projectDataDir;
  }

  // 3. Global user directory (default stable location for npm/Docker/VPS)
  const globalDataDir = path.join(os.homedir(), ".wibwob");
  return globalDataDir;
}

/** Ensure a directory exists.
 * Call this at startup or before first write operation.
 * @throws Error if directory cannot be created */
export function ensureDirectoryExists(dir: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      // mkdir can throw EEXIST when path exists but is not a directory.
      try {
        if (fs.statSync(dir).isDirectory()) return;
      } catch {
        // fall through to explicit error below
      }
      throw new Error(
        `Path exists but is not a directory: ${dir}\n` +
        `Move/remove this path or set WIBWOB_DATA_DIR to a writable directory.`
      );
    }
    if (code === "EROFS") {
      throw new Error(
        `Directory is on read-only filesystem: ${dir}\n` +
        `Set WIBWOB_DATA_DIR to a writable location.`
      );
    }
    if (code === "EACCES") {
      throw new Error(
        `Permission denied creating directory: ${dir}\n` +
        `Check directory permissions or set WIBWOB_DATA_DIR.`
      );
    }
    throw err;
  }
}

/** Runtime data root — mutable runtime-owned data location.
 * Resolved once at startup. Caller should call ensureDirectoryExists(DATA_ROOT) at startup. */
export const DATA_ROOT = resolveDataRoot();

// ─────────────────────────────────────────────────────────────────────────
// Instance-scoped paths under DATA_ROOT
// Target layout:
//   <data_root>/
//     instances/
//       {instance_id}/
//         workspaces/
//         exports/
//         logs/
//         state.json
//     microapps/    (external microapps)
//     themes/      (external themes)
//     config.json  (runtime config overrides)
// ─────────────────────────────────────────────────────────────────────────

/** Resolve instance-scoped paths under DATA_ROOT.
 * These provide proper multi-instance isolation. */
export function resolveInstancePaths(instanceId: string): {
  instanceRoot: string;
  workspacesDir: string;
  exportsDir: string;
  logsDir: string;
  statePath: string;
  pidPath: string;
} {
  const instanceRoot = path.join(DATA_ROOT, "instances", instanceId);
  return {
    instanceRoot,
    workspacesDir: path.join(instanceRoot, "workspaces"),
    exportsDir: path.join(instanceRoot, "exports"),
    logsDir: path.join(instanceRoot, "logs"),
    statePath: path.join(instanceRoot, "state.json"),
    pidPath: path.join(instanceRoot, "wibwob.pid"),
  };
}

/**
 * SCRATCH_BASE — root for all instance-local mutable files.
 *
 * Set SCRATCH_DIR env var to run a second instance without clobbering the
 * first instance's workspace, state, or logs.  Path is resolved relative to
 * APP_ROOT so both relative ("scratch/alt") and absolute paths work.
 *
 * Default: "scratch" (= <repo>/scratch  — legacy behaviour, unchanged).
 *
 * Alt-instance example:
 *   SCRATCH_DIR=scratch/alt CONTROL_API_PORT=8098 bun run dev
 *
 * For packaged/Docker installs, prefer DATA_ROOT + instance-scoped paths above.
 * @deprecated Prefer resolveInstancePaths() with DATA_ROOT for new code.
 */
export const SCRATCH_BASE = process.env.SCRATCH_DIR
  ? path.resolve(APP_ROOT, process.env.SCRATCH_DIR)
  : path.join(APP_ROOT, "scratch");

export const WORKSPACES_DIR = path.join(SCRATCH_BASE, "workspaces");
export const STATE_PATH = path.join(SCRATCH_BASE, "app-state.json");
export const CAPTURES_DIR = path.join(SCRATCH_BASE, "captures");
export const LOGS_DIR = path.join(SCRATCH_BASE, "logs");
export const CONTROL_API_PORT =
  Number.parseInt(process.env.CONTROL_API_PORT ?? "8099", 10) || 8099;
export const APP_NOTES_PATH = path.join(SCRATCH_BASE, "mvp-notes.txt");
export const PI_AGENT_HOME = path.join(SCRATCH_BASE, "pi-agent-home");
export const README_PATH = path.join(REPO_ROOT, "README.md");
export const MASTER_PHILOSOPHY_PATH = path.join(REPO_ROOT, "AGENTS.md");

// Backward-compat aliases (remove after all consumers updated)
/** @deprecated Use APP_ROOT */
export const SPIKE_ROOT = APP_ROOT;
/** @deprecated Use PI_DIR */
export const SPIKE_PI_DIR = PI_DIR;
/** @deprecated Use PI_APPEND_SYSTEM_PATH */
export const SPIKE_PI_APPEND_SYSTEM_PATH = PI_APPEND_SYSTEM_PATH;
/** @deprecated Use PI_THEME_PATH */
export const SPIKE_PI_THEME_PATH = PI_THEME_PATH;
/** @deprecated Use APP_NOTES_PATH */
export const SPIKE_NOTES_PATH = APP_NOTES_PATH;
