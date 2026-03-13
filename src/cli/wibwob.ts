#!/usr/bin/env bun
/**
 * wibwob — Unix CLI for WibWob-DOS
 *
 * Thin HTTP client that talks to the control API (default port 8099).
 * All output is JSON to stdout, errors to stderr. Designed for jq piping.
 *
 * Usage:
 *   wibwob state                        # GET /state
 *   wibwob windows                      # list windows from /state
 *   wibwob commands                     # GET /commands/list
 *   wibwob <noun>.<verb> [--key val]    # POST /commands/run
 *   wibwob cmd <id> [--key val]         # POST /commands/run (explicit)
 *   wibwob help                         # show usage
 */

const BASE = process.env.WW_API ?? "http://127.0.0.1:8099";
const QUIET = process.argv.includes("-q") || process.argv.includes("--quiet");

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
  const state = (await api("/state")) as { windows: Array<{ id: number }> };
  if (QUIET) {
    for (const w of state.windows) console.log(w.id);
  } else {
    out(state.windows);
  }
}

async function cmdCommands() {
  const data = (await api("/commands/list")) as { commands: Array<{ id: string }> };
  if (QUIET) {
    for (const c of data.commands) console.log(c.id);
  } else {
    out(data.commands);
  }
}

async function cmdHealth() {
  out(await api("/health"));
}

async function cmdRun(id: string, flags: Record<string, unknown>) {
  const body: Record<string, unknown> = { id };
  if (Object.keys(flags).length > 0) body.args = flags;
  out(await api("/commands/run", "POST", body));
}

async function cmdScreenshot() {
  const res = await fetch(`${BASE}/screenshot/text`);
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  const text = await res.text();
  process.stdout.write(text);
}

function usage() {
  process.stderr.write(`wibwob — Unix CLI for WibWob-DOS

Usage:
  wibwob state                        Full desktop state (JSON)
  wibwob windows [-q]                 List windows (JSON, -q for IDs only)
  wibwob commands [-q]                List available commands
  wibwob health                       API health check
  wibwob screenshot                   Text screenshot of desktop
  wibwob cmd <id> [--key val ...]     Run command by ID
  wibwob <domain>.<verb> [--flags]    Run command (dot syntax)
  wibwob <domain> <verb> [--flags]    Run command (noun verb)
  wibwob window <id> <verb> [--flags] Target window then act
  wibwob help                         This message

Flags:
  -q, --quiet    Output IDs only, one per line (for piping)

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

  // Strip -q/--quiet from args for dispatch (already captured globally)
  const cleanArgs = args.filter(a => a !== "-q" && a !== "--quiet");
  const cleanSub = cleanArgs[0];
  if (!cleanSub) { usage(); return; }

  switch (cleanSub) {
    case "state":
      return cmdState();
    case "windows":
      return cmdWindows();
    case "commands":
      return cmdCommands();
    case "health":
      return cmdHealth();
    case "screenshot":
      return cmdScreenshot();
    case "cmd": {
      const id = cleanArgs[1];
      if (!id) { process.stderr.write("Usage: wibwob cmd <command-id> [--flags]\n"); process.exit(1); }
      return cmdRun(id, parseFlags(cleanArgs.slice(2)));
    }
    default: {
      // Treat as command ID: wibwob theme.set --name dark
      if (cleanSub.includes(".")) {
        return cmdRun(cleanSub, parseFlags(cleanArgs.slice(1)));
      }
      // Try: wibwob window <id> <verb> --flags → window.<verb> --id <id>
      // e.g. wibwob window 3 close → window.close --id 3
      if (cleanArgs.length >= 3 && !isNaN(Number(cleanArgs[1])) && !cleanArgs[2].startsWith("--")) {
        const noun = cleanSub;
        const target = Number(cleanArgs[1]);
        const verb = cleanArgs[2];
        const flags = parseFlags(cleanArgs.slice(3));
        flags.id = target;
        return cmdRun(`${noun}.${verb}`, flags);
      }
      // Try noun + verb: wibwob window close --id 3 → window.close
      if (cleanArgs.length >= 2 && !cleanArgs[1].startsWith("--")) {
        const id = `${cleanSub}.${cleanArgs[1]}`;
        return cmdRun(id, parseFlags(cleanArgs.slice(2)));
      }
      // Unknown
      process.stderr.write(`Unknown command: ${cleanSub}\nRun 'wibwob help' for usage.\n`);
      process.exit(1);
    }
  }
}

main().catch((err: Error) => {
  process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
