/**
 * app-logger.ts — terse, human-readable daily log file.
 *
 * Format: HH:MM:SS level source message
 * Example: 22:14:03 INFO cmd agent.reload_prompt → ok
 *          22:14:05 WARN session no active agent to reload
 *          22:14:07 ERR  api /view/primer/open failed: file not found
 *
 * One file per day: logs/tui-app/YYYY-MM-DD.log
 * Gitignored via existing logs/* rule.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(new URL(".", import.meta.url).pathname, "../../logs/tui-app");

type Level = "INFO" | "WARN" | "ERR ";

let currentDate = "";
let logPath = "";

function ensureLogFile(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (today !== currentDate) {
    currentDate = today;
    mkdirSync(LOG_DIR, { recursive: true });
    logPath = join(LOG_DIR, `${today}.log`);
  }
  return logPath;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

function write(level: Level, source: string, message: string): void {
  const line = `${timestamp()} ${level} ${source} ${message}\n`;
  try {
    appendFileSync(ensureLogFile(), line);
  } catch {
    // Silent — logging must never crash the app
  }
}

export const log = {
  info: (source: string, message: string) => write("INFO", source, message),
  warn: (source: string, message: string) => write("WARN", source, message),
  err:  (source: string, message: string) => write("ERR ", source, message),
};
