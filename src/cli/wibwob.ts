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

import fs from "node:fs";
import path from "node:path";
import { buildLocalControlApiBaseUrl } from "../runtime/runtime-node.js";
import { SCRATCH_BASE } from "../core/config.js";

// ── Instance targeting ───────────────────────────────────
// --instance <label> connects via unix socket: scratch/instances/<label>.sock
// Falls back to env vars, then default HTTP port.

function findFlag(flag: string): string | undefined {
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) return process.argv[i + 1];
    if (process.argv[i].startsWith(`${flag}=`)) return process.argv[i].slice(flag.length + 1);
  }
  return undefined;
}

function resolveBase(): string {
  // --instance flag: highest priority (explicit targeting)
  const label = findFlag("--instance");
  if (label) {
    const sockPath = path.join(SCRATCH_BASE, "instances", `${label}.sock`);
    if (fs.existsSync(sockPath)) {
      return `unix://${sockPath}`;
    }
    process.stderr.write(`No socket for instance "${label}" at ${sockPath}\n`);
    process.exit(1);
  }

  // Explicit env override
  if (process.env.WW_API) return process.env.WW_API;
  if (process.env.WIBWOB_API) return process.env.WIBWOB_API;

  // $WIBWOB_INSTANCE env var
  if (process.env.WIBWOB_INSTANCE) {
    const sockPath = path.join(SCRATCH_BASE, "instances", `${process.env.WIBWOB_INSTANCE}.sock`);
    if (fs.existsSync(sockPath)) {
      return `unix://${sockPath}`;
    }
  }

  // Default: HTTP
  return buildLocalControlApiBaseUrl();
}

const BASE = resolveBase();
const IS_SOCKET = BASE.startsWith("unix://");
const QUIET = process.argv.includes("-q") || process.argv.includes("--quiet");

// ── Helpers ──────────────────────────────────────────────

async function api(apiPath: string, method = "GET", body?: unknown): Promise<unknown> {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let url: string;
  if (IS_SOCKET) {
    // Bun supports fetch() over unix sockets with the unix option
    const sockPath = BASE.slice("unix://".length);
    (opts as any).unix = sockPath;
    url = `http://localhost${apiPath}`;
  } else {
    url = `${BASE}${apiPath}`;
  }

  const res = await fetch(url, opts);
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

async function cmdMinimap() {
  const state = await api("/state") as {
    windows: Array<{ id: number; title: string; left: number; top: number; width: number; height: number; zIndex: number; focused: boolean; appType?: string; kind?: string }>;
    app?: { theme?: string; instanceId?: string; instanceLabel?: string; termWidth?: number; termHeight?: number };
  };
  const wins = state.windows;
  const app = state.app ?? {};
  const tw = (app.termWidth ?? 170);
  const th = (app.termHeight ?? 44);
  const label = app.instanceLabel ? `${app.instanceLabel}·${app.instanceId ?? "?"}` : (app.instanceId ?? "?");
  const focusWin = wins.find(w => w.focused);

  // Header
  process.stdout.write(`WibWob-DOS  ${app.theme ?? "?"}  ${wins.length} windows  focus:${focusWin?.id ?? "-"}:${focusWin?.title ?? "-"}  id:${label}\n`);

  // Scaled minimap
  const scaleX = 60 / tw;
  const scaleY = 20 / th;
  const grid: string[][] = [];
  for (let y = 0; y < 20; y++) {
    grid[y] = [];
    for (let x = 0; x < 62; x++) grid[y][x] = " ";
  }

  // Draw border
  for (let x = 0; x < 62; x++) { grid[0][x] = x === 0 || x === 61 ? "+" : "-"; grid[19][x] = x === 0 || x === 61 ? "+" : "-"; }
  for (let y = 0; y < 20; y++) { grid[y][0] = "|"; grid[y][61] = "|"; }
  grid[0][0] = "+"; grid[0][61] = "+"; grid[19][0] = "+"; grid[19][61] = "+";

  // Draw windows (sorted by z-index so focused is on top)
  const sorted = [...wins].sort((a, b) => a.zIndex - b.zIndex);
  for (const w of sorted) {
    const x1 = Math.max(1, Math.round(w.left * scaleX) + 1);
    const y1 = Math.max(1, Math.round(w.top * scaleY) + 1);
    const x2 = Math.min(60, Math.round((w.left + w.width) * scaleX) + 1);
    const y2 = Math.min(18, Math.round((w.top + w.height) * scaleY) + 1);
    const ch = w.focused ? "#" : "+";
    for (let x = x1; x <= x2; x++) { if (y1 >= 1) grid[y1][x] = ch; if (y2 <= 18) grid[y2][x] = ch; }
    for (let y = y1; y <= y2; y++) { grid[y][x1] = ch; grid[y][x2] = ch; }
    // Label
    const tag = `${w.id}`;
    if (x2 - x1 > tag.length + 1 && y2 > y1) {
      for (let i = 0; i < tag.length && x1 + 1 + i < x2; i++) grid[y1 + 1][x1 + 1 + i] = tag[i];
    }
  }

  for (const row of grid) process.stdout.write("  " + row.join("") + "\n");

  // Legend
  process.stdout.write("\n");
  for (const w of sorted) {
    const flag = w.focused ? " ◀" : "";
    const short = w.title.length > 30 ? w.title.slice(0, 27) + "..." : w.title;
    process.stdout.write(`  ${String(w.id).padStart(3)}  ${short.padEnd(32)} ${w.width}x${w.height} @${w.left},${w.top}${flag}\n`);
  }
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

async function cmdScreenshot(id?: string) {
  const qs = id ? `?id=${id}` : "";
  const url = IS_SOCKET ? `http://localhost/screenshot/text${qs}` : `${BASE}/screenshot/text${qs}`;
  const opts: RequestInit = IS_SOCKET ? { unix: BASE.slice("unix://".length) } as any : {};
  const res = await fetch(url, opts);
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}${res.status === 404 ? " — window not found" : ""}\n`);
    process.exit(1);
  }
  const text = await res.text();
  process.stdout.write(text);
}

async function cmdWrite(windowId?: string) {
  if (!windowId) {
    process.stderr.write("Usage: wibwob write <window-id>\nReads text from stdin, writes to the window.\n");
    process.exit(1);
  }
  const id = Number(windowId);
  if (isNaN(id)) {
    process.stderr.write(`Invalid window ID: ${windowId}\n`);
    process.exit(1);
  }

  // Read stdin
  const text = await new Response(process.stdin as any).text();
  const trimmed = text.trimEnd();
  if (!trimmed) {
    process.stderr.write("No input on stdin\n");
    process.exit(1);
  }

  // Resolve appType from state
  const state = (await api("/state")) as {
    windows: Array<{ id: number; appType?: string }>;
  };
  const win = state.windows.find((w) => w.id === id);
  if (!win) {
    process.stderr.write(`No window with id ${id}\n`);
    process.exit(1);
  }
  const appType = win.appType;
  if (!appType) {
    process.stderr.write(`Window ${id} has no appType\n`);
    process.exit(1);
  }

  // Build the microapp command prefix
  const prefix = `microapp.${appType}`;

  // Try write → send → create fallback convention
  const candidates = [
    { cmd: `${prefix}.write`, args: { text: trimmed, windowId: id } },
    { cmd: `${prefix}.send`, args: { message: trimmed } },
    { cmd: `${prefix}.create`, args: { body: trimmed, title: trimmed.slice(0, 50) } },
  ];

  // Get available commands to find which one exists
  const cmdList = (await api("/commands/list")) as {
    commands: Array<{ id: string }>;
  };
  const available = new Set(cmdList.commands.map((c) => c.id));

  for (const candidate of candidates) {
    if (available.has(candidate.cmd)) {
      const result = await api("/commands/run", "POST", {
        id: candidate.cmd,
        args: candidate.args,
      });
      out(result);
      return;
    }
  }

  process.stderr.write(
    `App ${appType} does not support write (no ${prefix}.write, .send, or .create command)\n`,
  );
  process.exit(1);
}

async function cmdAttach() {
  const { spawnSync } = await import("node:child_process");
  const label = findFlag("--instance") || process.env.WIBWOB_INSTANCE || "main";
  const sockPath = path.join(SCRATCH_BASE, "instances", `${label}.sock`);
  const pidFile = path.join(SCRATCH_BASE, "wibwob.pid");
  const orphanWorkspace = `orphan-${label}`;
  const workspacesDir = path.join(SCRATCH_BASE, "workspaces");
  const orphanFile = path.join(workspacesDir, `${orphanWorkspace}.json`);
  const repoRoot = path.resolve(SCRATCH_BASE, "..");

  process.stderr.write(`[attach] looking for instance '${label}'...\n`);

  // 1. Check if instance is alive (headless orphan?)
  let alive = false;
  if (fs.existsSync(sockPath)) {
    try {
      const res = await fetch("http://localhost/health", { unix: sockPath } as any);
      alive = res.ok;
    } catch {
      alive = false;
    }
  }

  // If alive, it's a headless orphan — kill it so we can take over the terminal
  if (alive) {
    process.stderr.write(`[attach] found headless instance — taking over\n`);
    // Save its state first
    try {
      await fetch("http://localhost/workspace/save", {
        unix: sockPath,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orphanWorkspace }),
      } as any);
      process.stderr.write(`[attach] saved workspace as ${orphanWorkspace}\n`);
    } catch {
      process.stderr.write(`[attach] warning: could not save workspace\n`);
    }
    // Kill it
    try {
      const res = await fetch("http://localhost/health", { unix: sockPath } as any);
      const health = await res.json() as Record<string, unknown>;
      if (health.pid) {
        process.kill(Number(health.pid), "SIGTERM");
        process.stderr.write(`[attach] killed headless process ${health.pid}\n`);
      }
    } catch {}
    // Wait for it to die
    await new Promise(r => setTimeout(r, 1500));
  }

  // 2. Kill stale process if PID file exists
  if (fs.existsSync(pidFile)) {
    const stalePid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (stalePid && !isNaN(stalePid)) {
      try {
        process.kill(stalePid, "SIGTERM");
        process.stderr.write(`[attach] killed stale process ${stalePid}\n`);
      } catch {
        process.stderr.write(`[attach] stale PID ${stalePid} already dead\n`);
      }
      try { fs.unlinkSync(pidFile); } catch {}
    }
  }

  // 3. Clean stale socket
  if (fs.existsSync(sockPath)) {
    try { fs.unlinkSync(sockPath); } catch {}
    process.stderr.write(`[attach] cleaned stale socket\n`);
  }

  // 4. Detect orphan workspace
  const hasOrphan = fs.existsSync(orphanFile);
  if (hasOrphan) {
    process.stderr.write(`[attach] found orphan workspace: ${orphanWorkspace}\n`);
  } else {
    process.stderr.write(`[attach] no orphan workspace found, starting fresh\n`);
  }

  // 5. Start the TUI in THIS terminal — stdio: "inherit" so blessed gets the TTY
  const startArgs = ["run", "src/app.ts"];
  if (hasOrphan) {
    startArgs.push("--workspace", orphanWorkspace);
  }

  process.stderr.write(`[attach] launching TUI...\n`);
  const result = spawnSync("bun", startArgs, {
    cwd: repoRoot,
    env: { ...process.env, WIBWOB_INSTANCE_LABEL: label },
    stdio: "inherit",
  });

  // TUI exited — pass through its exit code
  process.exit(result.status ?? 1);
}

async function cmdInstances() {
  const instancesDir = path.join(SCRATCH_BASE, "instances");
  if (!fs.existsSync(instancesDir)) {
    process.stderr.write("No instances directory found\n");
    process.exit(1);
  }
  const socks = fs.readdirSync(instancesDir).filter((f: string) => f.endsWith(".sock"));
  if (socks.length === 0) {
    process.stderr.write("No instances running (no .sock files)\n");
    process.exit(1);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const sock of socks) {
    const sockPath = path.join(instancesDir, sock);
    const label = sock.replace(/\.sock$/, "");
    try {
      const res = await fetch("http://localhost/health", { unix: sockPath } as any);
      if (res.ok) {
        const health = await res.json() as Record<string, unknown>;
        results.push({ label, socket: sockPath, ...health });
      } else {
        results.push({ label, socket: sockPath, ok: false, error: `HTTP ${res.status}` });
      }
    } catch {
      // Dead socket — clean it up
      try { fs.unlinkSync(sockPath); } catch {}
      results.push({ label, socket: sockPath, ok: false, error: "dead (cleaned)" });
    }
  }

  if (QUIET) {
    for (const r of results) {
      if (r.ok) process.stdout.write(`${r.label}\n`);
    }
  } else {
    out(results);
  }
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
  wibwob minimap                      Spatial map of all windows (alias: map)
  wibwob screenshot                   Text screenshot of desktop
  wibwob screenshot <id>              Text screenshot of a single window
  wibwob read <id>                    Alias for screenshot (Plan 9 symmetry)
  wibwob write <id>                   Write stdin text into a window (pipe in)
  wibwob instances                    List running instances (via sockets)
  wibwob attach                       Resurrect from orphan workspace (detect → kill stale → start → load)
  wibwob cmd <id> [--key val ...]     Run command by ID
  wibwob <domain>.<verb> [--flags]    Run command (dot syntax)
  wibwob <domain> <verb> [--flags]    Run command (noun verb)
  wibwob window <id> <verb> [--flags] Target window then act
  wibwob help                         This message

Flags:
  --instance <label>  Target instance by label (connects via unix socket)
  -q, --quiet         Output IDs only, one per line (for piping)

Environment:
  WIBWOB_INSTANCE  Target instance label (same as --instance)
  WW_API           Base URL override (default: socket or port 8099)
  WIBWOB_API       Alias for WW_API

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

  // Strip -q/--quiet and --instance <label> from args for dispatch (already captured)
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-q" || args[i] === "--quiet") continue;
    if (args[i] === "--instance") { i++; continue; }
    if (args[i].startsWith("--instance=")) continue;
    filteredArgs.push(args[i]);
  }
  const cleanArgs = filteredArgs;
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
    case "minimap":
    case "map":
      return cmdMinimap();
    case "screenshot":
    case "read":
      return cmdScreenshot(cleanArgs[1]);
    case "write":
      return cmdWrite(cleanArgs[1]);
    case "instances":
      return cmdInstances();
    case "attach":
      return cmdAttach();
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
