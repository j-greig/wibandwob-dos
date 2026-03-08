import path from "node:path";
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
