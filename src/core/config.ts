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
export const WORKSPACES_DIR = path.join(APP_ROOT, "scratch", "workspaces");
export const STATE_PATH = path.join(APP_ROOT, "scratch", "app-state.json");
export const CONTROL_API_PORT = Number.parseInt(process.env.CONTROL_API_PORT ?? "8099", 10) || 8099;
export const APP_NOTES_PATH = path.join(APP_ROOT, "scratch", "mvp-notes.txt");
export const PI_AGENT_HOME = path.join(APP_ROOT, "scratch", "pi-agent-home");
export const README_PATH = path.join(REPO_ROOT, "README.md");
export const MASTER_PHILOSOPHY_PATH = path.join(REPO_ROOT, "docs", "master-philosophy.md");

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
