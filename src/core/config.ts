import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const PRIMER_ROOTS = ["modules", "modules-private", "docs"] as const;

const APP_FILE = fileURLToPath(import.meta.url);
const CONFIG_ROOT = path.dirname(APP_FILE);
export const SRC_ROOT = path.resolve(CONFIG_ROOT, "..");
/** Post-migration: app root and repo root are the same directory. */
export const APP_ROOT = path.resolve(SRC_ROOT, "..");
export const REPO_ROOT = APP_ROOT;
export const PI_DIR = path.join(APP_ROOT, ".pi");
export const PI_APPEND_SYSTEM_PATH = path.join(PI_DIR, "APPEND_SYSTEM.md");
export const PI_THEME_PATH = path.join(PI_DIR, "themes", "wibwob-tv.json");
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
 */
export const SCRATCH_BASE = process.env.SCRATCH_DIR
  ? path.resolve(APP_ROOT, process.env.SCRATCH_DIR)
  : path.join(APP_ROOT, "scratch");

export const WORKSPACES_DIR = path.join(SCRATCH_BASE, "workspaces");
export const STATE_PATH = path.join(SCRATCH_BASE, "app-state.json");
export const CAPTURES_DIR = path.join(SCRATCH_BASE, "captures");
export const LOGS_DIR = path.join(SCRATCH_BASE, "logs");
export const CONTROL_TOKEN_PATH = path.join(SCRATCH_BASE, "control-token");
export const CONTROL_API_PORT = Number.parseInt(process.env.CONTROL_API_PORT ?? "8099", 10) || 8099;
export const APP_NOTES_PATH = path.join(SCRATCH_BASE, "mvp-notes.txt");
export const PI_AGENT_HOME = path.join(SCRATCH_BASE, "pi-agent-home");
export const README_PATH = path.join(REPO_ROOT, "README.md");
/** Guaranteed-present doc for Document Reader default — AGENTS.md exists in every checkout and image. */
export const AGENTS_PATH = path.join(REPO_ROOT, "AGENTS.md");

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

/**
 * Ensure a file path stays within the app root boundary (SEC-M8).
 *
 * Two-phase check to block both path traversal and symlink escapes:
 * 1. Lexical resolve — blocks ../../../etc via path.resolve()
 * 2. Canonical resolve — resolves symlinks on the deepest existing ancestor,
 *    then checks the real path. Blocks APP_ROOT/safe-link -> /etc style escapes.
 *
 * Returns the lexically resolved path (not the real path of the final file,
 * which may not exist yet). Throws if either check fails.
 */
export function assertWithinAppRoot(filePath: string): string {
  const lexical = path.resolve(
    filePath.startsWith("~")
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath,
  );

  // Phase 1: lexical prefix check
  if (!lexical.startsWith(APP_ROOT + path.sep) && lexical !== APP_ROOT) {
    throw new Error(
      `Write path '${filePath}' resolves to '${lexical}' which is outside APP_ROOT (${APP_ROOT}). ` +
      `Editor saves are restricted to the application directory.`,
    );
  }

  // Phase 2: canonical check — walk up to find deepest existing ancestor,
  // resolve its real path (follows symlinks), then reattach the suffix.
  // This catches symlinks inside APP_ROOT that point outside.
  let ancestor = lexical;
  let suffix = "";
  while (ancestor !== path.dirname(ancestor)) {
    try {
      const real = fs.realpathSync(ancestor);
      const realWithSuffix = suffix ? path.join(real, suffix) : real;
      if (!realWithSuffix.startsWith(APP_ROOT + path.sep) && realWithSuffix !== APP_ROOT) {
        throw new Error(
          `Write path '${filePath}' resolves through a symlink to '${realWithSuffix}' ` +
          `which is outside APP_ROOT (${APP_ROOT}). Symlink escapes are not permitted.`,
        );
      }
      break; // ancestor exists and is within boundary — done
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // ancestor doesn't exist yet — go up one level
        suffix = suffix ? path.join(path.basename(ancestor), suffix) : path.basename(ancestor);
        ancestor = path.dirname(ancestor);
        continue;
      }
      throw err; // re-throw real errors (permissions etc.)
    }
  }

  return lexical;
}
