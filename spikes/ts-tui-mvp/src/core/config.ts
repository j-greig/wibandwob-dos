import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRIMER_ROOTS = ["modules", "modules-private", "docs"] as const;

const APP_FILE = fileURLToPath(import.meta.url);
const CONFIG_ROOT = path.dirname(APP_FILE);
export const SRC_ROOT = path.resolve(CONFIG_ROOT, "..");
export const SPIKE_ROOT = path.resolve(SRC_ROOT, "..");
export const REPO_ROOT = path.resolve(SPIKE_ROOT, "..", "..");
export const WORKSPACE_PATH = path.join(SPIKE_ROOT, "scratch", "ts-tui-workspace.json");
export const STATE_PATH = path.join(SPIKE_ROOT, "scratch", "app-state.json");
export const SPIKE_NOTES_PATH = path.join(SPIKE_ROOT, "scratch", "mvp-notes.txt");
export const README_PATH = path.join(REPO_ROOT, "README.md");
export const MASTER_PHILOSOPHY_PATH = path.join(REPO_ROOT, "docs", "master-philosophy.md");
