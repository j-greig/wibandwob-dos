#!/usr/bin/env bun
/**
 * Monster Cam TS launcher — spawns the Python detection worker.
 *
 * Kept thin on purpose: Python owns all detection logic.
 * This exists so the service can spawn a single TS entry point.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, "../..");
const VENV_PY    = path.resolve(REPO_ROOT, "assets/mediapipe-venv/bin/python");
const PY_WORKER  = path.resolve(__dirname, "monster_cam_worker.py");

function log(msg: string) {
  process.stderr.write(`[monster-cam-worker] ${msg}\n`);
}

const py = spawn(VENV_PY, [PY_WORKER, ...process.argv.slice(2)], {
  stdio: ["ignore", "ignore", "inherit"],
  env: process.env,
});

py.on("error", (err) => {
  log(`Python spawn error: ${err.message}`);
  process.exit(1);
});

py.on("close", (code) => {
  log(`Python worker exited (${code})`);
  process.exit(code ?? 0);
});

process.on("SIGINT",  () => py.kill("SIGINT"));
process.on("SIGTERM", () => py.kill("SIGTERM"));
