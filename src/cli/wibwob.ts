#!/usr/bin/env bun
/**
 * wibwob — Unix CLI for WibWob-DOS
 *
 * Thin HTTP client that talks to the control API (default port 8099).
 * All output is JSON to stdout, errors to stderr. Designed for jq piping.
 *
 * Usage:
 *   wibwob state                        # GET /state
 *   wibwob inspection                   # GET /runtime/inspection
 *   wibwob windows                      # list windows from /state
 *   wibwob commands                     # GET /commands/list
 *   wibwob <noun>.<verb> [--key val]    # POST /commands/run
 *   wibwob cmd <id> [--key val]         # POST /commands/run (explicit)
 *   wibwob help                         # show usage
 */

import { buildLocalControlApiBaseUrl } from "../runtime/runtime-node.js";

const BASE = process.env.WW_API ?? process.env.WIBWOB_API ?? buildLocalControlApiBaseUrl();
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

async function cmdInspection() {
  out(await api("/runtime/inspection"));
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
  const flags = parseFlags(process.argv.slice(2));
  const params = new URLSearchParams();
  if (typeof flags.surface === "string") {
    params.set("surface", flags.surface);
  }
  if (flags.includeUnavailable === true) {
    params.set("includeUnavailable", "true");
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const data = (await api(`/commands/list${suffix}`)) as { commands: Array<{ id: string }> };
  if (QUIET) {
    for (const c of data.commands) console.log(c.id);
  } else {
    out(data.commands);
  }
}

async function cmdHealth() {
  out(await api("/health"));
}

async function cmdHelp(id: string) {
  const data = (await api("/commands/list")) as { commands: Array<{
    id: string; label: string; description?: string; returns?: string;
    params?: { type?: string; properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
  }> };
  const cmd = data.commands.find(c => c.id === id);
  if (!cmd) {
    process.stderr.write(`Unknown command: ${id}\n`);
    process.exit(1);
  }
  let text = `${cmd.id} — ${cmd.label}\n`;
  if (cmd.description) text += `\n${cmd.description}\n`;
  if (cmd.params?.properties) {
    text += `\nFlags:\n`;
    const required = new Set(cmd.params.required ?? []);
    for (const [name, prop] of Object.entries(cmd.params.properties)) {
      const req = required.has(name) ? " (required)" : " (optional)";
      const typ = prop.type ?? "unknown";
      const desc = prop.description ? `  ${prop.description}` : "";
      text += `  --${name.padEnd(12)} ${typ}${req}${desc}\n`;
    }
  }
  if (cmd.returns) text += `\nReturns: ${cmd.returns}\n`;
  process.stderr.write(text);
  process.exit(0);
}

async function cmdRun(id: string, flags: Record<string, unknown>) {
  if (flags.help === true) return cmdHelp(id);
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

async function cmdCompletions() {
  // Fetch commands from the API to generate completions dynamically
  const data = (await api("/commands/list")) as { commands: Array<{ id: string; description?: string }> };
  const commands = data.commands;

  // Extract domains and verbs
  const domains = new Map<string, string[]>();
  for (const cmd of commands) {
    const parts = cmd.id.split(".");
    if (parts.length >= 2) {
      const domain = parts[0];
      if (!domains.has(domain)) domains.set(domain, []);
      domains.get(domain)!.push(cmd.id);
    }
  }

  const shell = process.argv.includes("--bash") ? "bash" : "zsh";

  if (shell === "zsh") {
    let out = `#compdef wibwob\n# Generated by wibwob completions --zsh\n\n`;
    out += `_wibwob() {\n`;
    out += `  local -a builtins domains commands\n\n`;
    out += `  builtins=(state inspection windows commands health screenshot help completions)\n`;
    out += `  domains=(${[...domains.keys()].join(" ")})\n\n`;
    out += `  if (( CURRENT == 2 )); then\n`;
    out += `    commands=(\n`;
    for (const cmd of commands) {
      const desc = (cmd.description ?? "").replace(/'/g, "").slice(0, 60);
      out += `      '${cmd.id}:${desc}'\n`;
    }
    out += `    )\n`;
    out += `    _describe 'command' commands\n`;
    out += `    compadd -- $builtins $domains\n`;
    out += `  fi\n`;
    out += `}\n\n`;
    out += `compdef _wibwob wibwob\n`;
    process.stdout.write(out);
  } else {
    // Bash completion
    let out = `# Generated by wibwob completions --bash\n`;
    out += `_wibwob_completions() {\n`;
    out += `  local cur="\${COMP_WORDS[COMP_CWORD]}"\n`;
    out += `  local commands="${commands.map(c => c.id).join(" ")} state inspection windows commands health screenshot help completions"\n`;
    out += `  COMPREPLY=( $(compgen -W "$commands" -- "$cur") )\n`;
    out += `}\n`;
    out += `complete -F _wibwob_completions wibwob\n`;
    process.stdout.write(out);
  }
  process.exit(0);
}

function usage() {
  process.stderr.write(`wibwob — Unix CLI for WibWob-DOS

Usage:
  wibwob state                        Full desktop state (JSON)
  wibwob inspection                   Full runtime inspection snapshot (JSON)
  wibwob windows [-q]                 List windows (JSON, -q for IDs only)
  wibwob commands [-q] [--surface agent|api|menu|palette] [--includeUnavailable]
                                      List available commands
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
  WW_API        Base URL (default: configured local control API)
  WIBWOB_API    Alias for WW_API

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
    case "inspection":
      return cmdInspection();
    case "windows":
      return cmdWindows();
    case "commands":
      return cmdCommands();
    case "health":
      return cmdHealth();
    case "screenshot":
      return cmdScreenshot();
    case "completions":
      return cmdCompletions();
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
