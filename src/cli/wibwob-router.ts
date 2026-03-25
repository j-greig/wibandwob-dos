/**
 * wibwob-router.ts — Standalone routing module for deep-linking into WibWob-DOS.
 *
 * Maps file paths, URLs, and explicit app hints to WibWob-DOS command(s).
 * Discovers running instances via unix sockets or port scanning.
 *
 * This module has NO TUI dependencies — it runs in external processes
 * (pi extension, macOS .app launcher, CLI scripts) that pipe commands
 * into WibWob-DOS via the control API.
 *
 * @see .planning/epics/e046-deep-linking-into-wibwobdos/e046-brief.md
 */

import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { discoverInstance as discoverInstanceFromModule } from "./instance-discovery.js";

// ── Types ────────────────────────────────────────────────

export interface RouteIntent {
  /** Absolute file or directory path. */
  path?: string;
  /** wibwob:// URL. */
  url?: string;
  /** Optional line number (for editor.open). */
  line?: number;
  /** Explicit app hint — overrides file-extension mapping. */
  app?: "editor" | "finder" | "markdown" | "primer";
}

export interface RouteCommand {
  id: string;
  args: Record<string, unknown>;
}

export interface RouteResult {
  /** One or more commands to dispatch in order (e.g. finder.open + finder.navigate). */
  commands: RouteCommand[];
}

export interface InstanceInfo {
  socket?: string;
  port?: number;
  label?: string;
}

// ── File-type → command mapping ──────────────────────────

const EXT_MAP: Record<string, string> = {
  // Markdown → dedicated viewer
  ".md": "markdown.open",

  // Code → editor
  ".ts": "editor.open",
  ".tsx": "editor.open",
  ".js": "editor.open",
  ".jsx": "editor.open",
  ".mjs": "editor.open",
  ".cjs": "editor.open",
  ".py": "editor.open",
  ".sh": "editor.open",
  ".bash": "editor.open",
  ".zsh": "editor.open",
  ".css": "editor.open",
  ".scss": "editor.open",
  ".less": "editor.open",
  ".html": "editor.open",
  ".htm": "editor.open",
  ".xml": "editor.open",
  ".c": "editor.open",
  ".cpp": "editor.open",
  ".h": "editor.open",
  ".rs": "editor.open",
  ".go": "editor.open",
  ".rb": "editor.open",
  ".java": "editor.open",
  ".swift": "editor.open",
  ".kt": "editor.open",

  // Config → editor
  ".json": "editor.open",
  ".yaml": "editor.open",
  ".yml": "editor.open",
  ".toml": "editor.open",
  ".ini": "editor.open",
  ".env": "editor.open",
  ".lock": "editor.open",

  // Plain text / ASCII art → primer
  ".txt": "primer.open",
  ".ascii": "primer.open",
  ".ans": "primer.open",
  ".nfo": "primer.open",

  // Images → primer (image-to-ASCII)
  ".png": "primer.open",
  ".jpg": "primer.open",
  ".jpeg": "primer.open",
  ".gif": "primer.open",
  ".webp": "primer.open",
  ".bmp": "primer.open",
  ".svg": "primer.open",
};

/** App hint → command ID for when the user specifies an explicit app. */
const APP_HINT_MAP: Record<string, string> = {
  editor: "editor.open",
  finder: "finder.open",
  markdown: "markdown.open",
  primer: "primer.open",
};

// ── URL parsing ──────────────────────────────────────────

interface ParsedWibwobUrl {
  action: string;
  params: Record<string, string>;
}

function parseWibwobUrl(url: string): ParsedWibwobUrl | null {
  try {
    // wibwob://action?key=val&key2=val2
    const parsed = new URL(url);
    if (parsed.protocol !== "wibwob:") return null;

    const action = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
    const params: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams) {
      params[key] = value;
    }
    return { action, params };
  } catch {
    return null;
  }
}

// ── Route function ───────────────────────────────────────

/**
 * Map an intent to one or more WibWob-DOS commands.
 *
 * Returns null only if the intent is completely empty.
 * Unknown file types default to `editor.open`.
 */
export function route(intent: RouteIntent): RouteResult | null {
  // ── URL routing ──
  if (intent.url) {
    const parsed = parseWibwobUrl(intent.url);
    if (!parsed) return null;

    switch (parsed.action) {
      case "open": {
        // wibwob://open?path=/foo/bar.ts → re-route through path logic
        if (parsed.params.path) {
          return route({
            path: parsed.params.path,
            line: parsed.params.line ? parseInt(parsed.params.line, 10) : undefined,
            app: parsed.params.app as RouteIntent["app"],
          });
        }
        return null;
      }

      case "command": {
        // wibwob://command?id=primer.open&args.filePath=/tmp/art.txt
        const id = parsed.params.id;
        if (!id) return null;
        const args: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed.params)) {
          if (key.startsWith("args.")) {
            args[key.slice(5)] = value;
          }
        }
        return { commands: [{ id, args }] };
      }

      case "shader": {
        // wibwob://shader?name=glow → ghostty.shader.set
        return {
          commands: [{
            id: "ghostty.shader.set",
            args: { name: parsed.params.name ?? "" },
          }],
        };
      }

      default:
        return null;
    }
  }

  // ── Path routing ──
  if (intent.path) {
    const absPath = resolve(intent.path);

    // Check if it's a directory
    let isDir = false;
    try {
      isDir = statSync(absPath).isDirectory();
    } catch {
      // File might not exist yet (e.g. creating new file) — treat as file
    }

    if (isDir) {
      // Directories need two commands: open file manager then navigate
      if (intent.app && APP_HINT_MAP[intent.app]) {
        return {
          commands: [{ id: APP_HINT_MAP[intent.app], args: { path: absPath } }],
        };
      }
      return {
        commands: [
          { id: "finder.open", args: {} },
          { id: "finder.navigate", args: { path: absPath } },
        ],
      };
    }

    // Explicit app hint overrides extension mapping
    if (intent.app && APP_HINT_MAP[intent.app]) {
      const commandId = APP_HINT_MAP[intent.app];
      const args: Record<string, unknown> = { filePath: absPath };
      if (intent.line) args.line = intent.line;
      return { commands: [{ id: commandId, args }] };
    }

    // Map by file extension
    const ext = extname(absPath).toLowerCase();
    const commandId = EXT_MAP[ext] ?? "editor.open"; // default to editor
    const args: Record<string, unknown> = { filePath: absPath };
    if (intent.line) args.line = intent.line;
    return { commands: [{ id: commandId, args }] };
  }

  return null;
}

// ── Instance discovery ───────────────────────────────────
// Delegated to instance-discovery.ts — single owner of all scanning/probing.

/**
 * Discover a running WibWob-DOS instance.
 * @param projectRoot — unused (kept for API compat), discovery uses DATA_ROOT
 */
export async function discoverInstance(
  projectRoot: string,
): Promise<InstanceInfo | null> {
  return discoverInstanceFromModule(projectRoot);
}

/**
 * Dispatch route commands to a running WibWob-DOS instance.
 *
 * @returns true if all commands succeeded, false otherwise.
 */
export async function dispatch(
  instance: InstanceInfo,
  result: RouteResult,
): Promise<boolean> {
  const baseUrl = `http://127.0.0.1:${instance.port}`;
  const fetchOpts: Record<string, unknown> = instance.socket
    ? { unix: instance.socket }
    : {};

  for (const cmd of result.commands) {
    try {
      const resp = await fetch(`${baseUrl}/commands/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, args: cmd.args }),
        signal: AbortSignal.timeout(5000),
        ...fetchOpts,
      });
      if (!resp.ok) {
        console.error(`Command ${cmd.id} failed: ${resp.status} ${resp.statusText}`);
        return false;
      }
    } catch (err) {
      console.error(`Command ${cmd.id} dispatch error:`, err);
      return false;
    }
  }
  return true;
}
