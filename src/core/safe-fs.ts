/**
 * safe-fs.ts — Thin wrappers for synchronous fs operations.
 *
 * All call sites in src/ should use these instead of raw readFileSync/writeFileSync.
 * Provides consistent error handling (returns undefined/false on failure).
 */
import fs from "node:fs";
import path from "node:path";

/** Read a file as UTF-8 string. Returns undefined on any error. */
export function safeReadFile(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

/** Read and parse a JSON file. Returns undefined on any error. */
export function safeReadJSON<T = unknown>(filePath: string): T | undefined {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Read a file as a Buffer. Returns undefined on any error. */
export function safeReadBuffer(filePath: string): Buffer | undefined {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return undefined;
  }
}

/** Write a UTF-8 string to a file. Creates parent dirs. Returns true on success. */
export function safeWriteFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Append a UTF-8 string to a file. Creates parent dirs. Returns true on success. */
export function safeAppendFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Delete a file. Returns true on success, false on error. */
export function safeUnlink(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/** List directory entries. Returns empty array on error. */
export function listDir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

/** Check if a path exists. */
export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
