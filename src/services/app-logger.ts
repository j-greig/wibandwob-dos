/**
 * app-logger.ts — terse, human-readable daily log file.
 *
 * Format: HH:MM:SS TAG message
 *
 * Tags:
 *   APP  — lifecycle: startup, shutdown, theme change
 *   CMD  — command registry: run, unknown
 *   MSG  — agent messages: inbound user/sender text
 *   SYS  — system ops: prompt reload, session init
 *   API  — control API: POST requests
 *   ERR  — failures
 *
 * One file per day: logs/tui-app/YYYY-MM-DD.log
 * Gitignored via existing logs/* rule.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(new URL(".", import.meta.url).pathname, "../../logs/tui-app");

type Tag = "APP " | "CMD " | "MSG " | "SYS " | "API " | "ERR ";

let currentDate = "";
let logPath = "";

function ensureLogFile(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDate) {
    currentDate = today;
    mkdirSync(LOG_DIR, { recursive: true });
    logPath = join(LOG_DIR, `${today}.log`);
  }
  return logPath;
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function write(tag: Tag, message: string): void {
  try {
    appendFileSync(ensureLogFile(), `${ts()} ${tag} ${message}\n`);
  } catch {
    // Silent — logging must never crash the app
  }
}

export const log = {
  app: (message: string) => write("APP ", message),
  cmd: (message: string) => write("CMD ", message),
  msg: (message: string) => write("MSG ", message),
  sys: (message: string) => write("SYS ", message),
  api: (message: string) => write("API ", message),
  err: (message: string) => write("ERR ", message),
};
