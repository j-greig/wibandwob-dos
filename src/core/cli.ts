/**
 * CLI flag parser — single source of truth for all command-line options.
 *
 * Uses Node/Bun built-in `util.parseArgs` (no dependencies).
 * Add new flags here; they become available everywhere via `appFlags()`.
 */

import { parseArgs } from "node:util";

export interface AppFlags {
  /** Dev mode: reload button, Ctrl+R hot reload, extra diagnostics. */
  dev: boolean;
  /** Show runtime stats badge in shell chrome. */
  stats: boolean;
  /** Enable custom cursor overlay (hides system cursor). Off by default. */
  customCursor: boolean;
  /** Show help and exit. */
  help: boolean;
  /** Boot into a named workspace instead of default. */
  workspace: string | undefined;
}

const FLAG_DEFS = {
  dev:           { type: "boolean" as const, default: false, description: "Dev mode: reload button (Ctrl+R), auto-save on reload" },
  stats:         { type: "boolean" as const, default: false, description: "Show runtime stats badge (render FPS, frame ms, RAM, agent activity)" },
  "custom-cursor": { type: "boolean" as const, default: false, description: "Enable custom TUI cursor overlay" },
  workspace:     { type: "string" as const, description: "Boot into a named workspace (e.g. --workspace orphan-main)" },
  help:          { type: "boolean" as const, short: "h", default: false, description: "Show this help" },
};

let parsed: AppFlags | undefined;

export function parseAppFlags(): AppFlags {
  if (parsed) return parsed;

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: FLAG_DEFS,
    strict: false,     // ignore unknown flags (bun may pass its own)
    allowPositionals: true,
  });

  parsed = {
    dev: Boolean(values.dev),
    stats: Boolean(values.stats),
    customCursor: Boolean(values["custom-cursor"]),
    help: Boolean(values.help),
    workspace: (values.workspace as string | undefined) || process.env.WIBWOB_WORKSPACE || undefined,
  };

  return parsed;
}

/** Get parsed flags (must call parseAppFlags() first in app.ts). */
export function appFlags(): AppFlags {
  if (!parsed) throw new Error("appFlags() called before parseAppFlags()");
  return parsed;
}

export function printHelp(): void {
  console.log("WibWob-DOS — terminal-native desktop shell\n");
  console.log("Usage: bun run start [flags]\n");
  console.log("Flags:");
  for (const [name, def] of Object.entries(FLAG_DEFS)) {
    const short = "short" in def ? `-${def.short}, ` : "    ";
    const dflt = "default" in def && def.default ? " (default: on)" : "";
    console.log(`  ${short}--${name.padEnd(18)} ${(def as any).description}${dflt}`);
  }
  console.log("");
}
