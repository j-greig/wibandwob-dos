#!/usr/bin/env bun
/**
 * ww — Unix CLI for WibWob-DOS
 *
 * Thin HTTP client that talks to the control API (default port 8099).
 * All output is JSON to stdout, errors to stderr. Designed for jq piping.
 *
 * Usage:
 *   ww state                        # GET /state
 *   ww windows                      # list windows from /state
 *   ww commands                     # GET /commands/list
 *   ww <noun>.<verb> [--key val]    # POST /commands/run
 *   ww cmd <id> [--key val]         # POST /commands/run (explicit)
 *   ww help                         # show usage
 */

const BASE = process.env.WW_API ?? "http://127.0.0.1:8099";

// ── Helpers ──────────────────────────────────────────────

async function api(path: string, method = "GET", body?: unknown): Promise<unknown> {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
    process.stderr.write(JSON.stringify({ error: res.status, detail: parsed }) + "\n");
    process.exit(1);
  }
  return res.json();
}

function out(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function parseFlags(args: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        result[key] = true;
      } else {
        // Try to parse as number or JSON, fall back to string
        const num = Number(next);
        if (!isNaN(num) && next.trim() !== "") {
          result[key] = num;
        } else if (next.startsWith("{") || next.startsWith("[") || next === "true" || next === "false" || next === "null") {
          try { result[key] = JSON.parse(next); } catch { result[key] = next; }
        } else {
          result[key] = next;
        }
        i++;
      }
    }
  }
  return result;
}

// ── Built-in commands ────────────────────────────────────

async function cmdState() {
  out(await api("/state"));
}

async function cmdWindows() {
  const state = (await api("/state")) as { windows: unknown[] };
  out(state.windows);
}

async function cmdCommands() {
  const data = (await api("/commands/list")) as { commands: unknown[] };
  out(data.commands);
}

async function cmdHealth() {
  out(await api("/health"));
}

async function cmdRun(id: string, flags: Record<string, unknown>) {
  const body: Record<string, unknown> = { id };
  if (Object.keys(flags).length > 0) body.args = flags;
  out(await api("/commands/run", "POST", body));
}

function usage() {
  process.stderr.write(`ww — Unix CLI for WibWob-DOS

Usage:
  ww state                        Full desktop state (JSON)
  ww windows                     List windows (JSON array)
  ww commands                    List available commands
  ww health                      API health check
  ww cmd <id> [--key val ...]    Run command by ID
  ww <domain>.<verb> [--flags]   Run command (shorthand)
  ww help                        This message

Environment:
  WW_API    Base URL (default: http://127.0.0.1:8099)

Output: JSON to stdout, errors to stderr. Pipe to jq.
`);
  process.exit(0);
}

// ── Dispatch ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    usage();
  }

  const sub = args[0];

  switch (sub) {
    case "state":
      return cmdState();
    case "windows":
      return cmdWindows();
    case "commands":
      return cmdCommands();
    case "health":
      return cmdHealth();
    case "cmd": {
      const id = args[1];
      if (!id) { process.stderr.write("Usage: ww cmd <command-id> [--flags]\n"); process.exit(1); }
      return cmdRun(id, parseFlags(args.slice(2)));
    }
    default: {
      // Treat as command ID: ww theme.set --name dark
      // Or dot-separated: ww window.close --id 3
      if (sub.includes(".")) {
        return cmdRun(sub, parseFlags(args.slice(1)));
      }
      // Try noun + verb: ww window close --id 3 → window.close
      if (args.length >= 2 && !args[1].startsWith("--")) {
        const id = `${sub}.${args[1]}`;
        return cmdRun(id, parseFlags(args.slice(2)));
      }
      // Unknown
      process.stderr.write(`Unknown command: ${sub}\nRun 'ww help' for usage.\n`);
      process.exit(1);
    }
  }
}

main().catch((err: Error) => {
  process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
