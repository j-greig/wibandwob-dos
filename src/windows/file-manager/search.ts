/**
 * file-manager/search.ts — Ripgrep search engine for the file manager.
 *
 * Spawns `rg` as a child process, parses results incrementally,
 * and calls back with batches. No blessed dependencies.
 */
import type { ChildProcess } from "node:child_process";
import type { SearchResult } from "./types.js";

export interface SearchEngine {
  /** Start a search. Kills any previous search first. */
  start(query: string, cwd: string, glob?: string): void;
  /** Cancel the active search. */
  cancel(): void;
  /** Whether a search is currently running. */
  readonly active: boolean;
  /** Accumulated results so far. */
  readonly results: SearchResult[];
  /** Destroy and release resources. */
  destroy(): void;
}

export interface SearchCallbacks {
  /** Called incrementally as results arrive. */
  onResults(results: SearchResult[]): void;
  /** Called when search completes (including empty). */
  onComplete(results: SearchResult[]): void;
  /** Called on error (e.g. rg not found). */
  onError(message: string): void;
}

export function createSearchEngine(callbacks: SearchCallbacks): SearchEngine {
  let process: ChildProcess | null = null;
  let results: SearchResult[] = [];
  let isActive = false;

  function cancel(): void {
    if (process) {
      process.kill();
      process = null;
    }
    isActive = false;
  }

  function start(query: string, cwd: string, glob?: string): void {
    cancel();
    results = [];

    if (!query.trim()) {
      callbacks.onComplete([]);
      return;
    }

    isActive = true;

    const { spawn } = require("node:child_process") as typeof import("node:child_process");
    const args = ["--no-heading", "--line-number", "--color=never", "--max-count=200"];
    if (glob) args.push("--glob", glob);
    args.push("--", query, cwd);

    const proc = spawn("rg", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    process = proc;
    let buffer = "";

    proc.stdout!.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          results.push({ file: match[1]!, line: parseInt(match[2]!, 10), text: match[3]! });
        }
      }
      callbacks.onResults(results);
    });

    proc.on("close", () => {
      if (buffer.trim()) {
        const match = buffer.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          results.push({ file: match[1]!, line: parseInt(match[2]!, 10), text: match[3]! });
        }
      }
      process = null;
      isActive = false;
      callbacks.onComplete(results);
    });

    proc.on("error", () => {
      process = null;
      isActive = false;
      callbacks.onError("Search failed: ripgrep (rg) not found");
    });
  }

  return {
    start,
    cancel,
    get active() { return isActive; },
    get results() { return results; },
    destroy() { cancel(); },
  };
}
