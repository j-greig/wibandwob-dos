import fs from "node:fs";
import path from "node:path";

const DEBUG_ENABLED = process.env.WIBWOBWORLD_DEBUG === "1";
const LOG_DIR = path.join(process.cwd(), "scratch", "logs");
const LOG_PATH = path.join(LOG_DIR, "wibwobworld.log");

function formatPart(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function debugWibWobWorld(event: string, ...parts: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  const line = `[${new Date().toISOString()}] ${event} ${parts.map(formatPart).join(" ")}\n`;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch {
    // Logging must never affect the app.
  }
}

export function debugWibWobWorldError(event: string, error: unknown, context?: unknown): void {
  debugWibWobWorld(event, {
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    context,
  });
}
