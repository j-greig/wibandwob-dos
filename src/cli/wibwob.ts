#!/usr/bin/env bun
/**
 * wibwob — Unix CLI for WibWob-DOS
 *
 * Thin HTTP client that talks to the control API via unix sockets.
 * Socket-first resolution: scans scratch/instances/ for alive PIDs.
 * No port 8099 fallback — that silent default was the original bug.
 *
 * Usage:
 *   wibwob state                        # GET /state
 *   wibwob inspection                   # GET /runtime/inspection
 *   wibwob windows                      # list windows from /state
 *   wibwob commands                     # GET /commands/list
 *   wibwob <noun>.<verb> [--key val]    # POST /commands/run
 *   wibwob cmd <id> [--key val]         # POST /commands/run (explicit)
 *   wibwob -i <label> health            # target a specific instance
 *   wibwob help                         # show usage
 */

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync as _spawnSync } from "node:child_process";
import { safeWriteFile } from "../core/safe-fs.js";
import { APP_ROOT, DATA_ROOT, SCRATCH_BASE } from "../core/config.js";
import {
  findAliveInstances,
  findAliveInstanceBySelector,
  readRuntimeControlManifest,
  readDiscoveryMeta,
  readPidFile,
  isPidAlive,
  safeUnlink,
  probeInstanceHealth,
  type AliveInstance,
  type RuntimeControlManifest,
  type InstanceHealth,
} from "./instance-discovery.js";

// ── Instance targeting ───────────────────────────────────
// Resolution: --instance/-i flag → $WIBWOB_INSTANCE env → manifest → socket scan → error
// No port 8099 fallback. Socket-first, PID-based liveness.
// TODO: Phase 2 — add: @name prefix, $WIBWOB_DESKTOP, .wibwob-desktop file

const NEW_CONTROL_SOCKET = "control.sock";
const NEW_CONTROL_PID = "control.pid";
const DISCOVERY_FILE = "discovery.json";

/** Find a CLI flag value, checking both long and short forms. */
function findFlag(...flags: string[]): string | undefined {
  for (let i = 0; i < process.argv.length; i++) {
    for (const flag of flags) {
      if (process.argv[i] === flag && process.argv[i + 1]) return process.argv[i + 1];
      if (process.argv[i].startsWith(`${flag}=`)) return process.argv[i].slice(flag.length + 1);
    }
  }
  return undefined;
}

function resolveSocketForSelector(selector: string): string | null {
  return findAliveInstanceBySelector(selector)?.socketPath ?? null;
}

/** Try to find a running instance. Returns base URL or null. */
function tryResolveBase(): string | null {
  // 1. Explicit flag: --instance <label|id|display-id> or -i ...
  const selector = findFlag("--instance", "-i");
  if (selector) {
    const socketPath = resolveSocketForSelector(selector);
    if (socketPath) {
      return `unix://${socketPath}`;
    }
    process.stderr.write(`No socket for instance selector "${selector}"\n`);
    return null;
  }

  // 2. $WIBWOB_INSTANCE env var — same selector semantics as --instance
  if (process.env.WIBWOB_INSTANCE) {
    const envSelector = process.env.WIBWOB_INSTANCE;
    const socketPath = resolveSocketForSelector(envSelector);
    if (socketPath) {
      return `unix://${socketPath}`;
    }
    process.stderr.write(`⚠ WIBWOB_INSTANCE="${envSelector}" but no socket found — falling back to scan\n`);
  }

  // 3. Runtime control manifest (canonical last-running instance snapshot)
  const manifest = readRuntimeControlManifest();
  if (manifest?.socketPath && fs.existsSync(manifest.socketPath)) {
    const pidAlive = typeof manifest.pid === "number" ? isPidAlive(manifest.pid) : true;
    if (pidAlive) {
      return `unix://${manifest.socketPath}`;
    }
  }

  // 4. Socket scan — always wins for local instances (avoids stale WIBWOB_API env poisoning)
  const alive = findAliveInstances();
  if (alive.length === 1) {
    return `unix://${alive[0].socketPath}`;
  }
  if (alive.length > 1) {
    // Prefer instances with a real screen over headless ones (screen 1×1 = zombie)
    const realScreen = alive.filter((inst) => {
      try {
        const res = _spawnSync("curl", [
          "-sf", "--unix-socket", inst.socketPath, "http://localhost/health",
        ], { timeout: 800, encoding: "utf-8" });
        const health = JSON.parse(res.stdout ?? "{}") as { screen?: { width: number; height: number } };
        return (health.screen?.width ?? 0) > 1;
      } catch { return true; /* unknown — don't exclude */ }
    });
    const candidates = realScreen.length > 0 ? realScreen : alive;
    if (candidates.length === 1) return `unix://${candidates[0].socketPath}`;

    process.stderr.write("Multiple instances running — specify which one:\n");
    for (const inst of alive) {
      const aliases = [inst.instanceId, inst.instanceDisplayId].filter(Boolean).join(", ");
      process.stderr.write(`  wibwob -i ${inst.label} <command>${aliases ? `  # ${aliases}` : ""}\n`);
    }
    return null;
  }

  // 4. Explicit API URL — last resort for remote / Docker / no-socket setups
  if (process.env.WW_API) return process.env.WW_API;
  if (process.env.WIBWOB_API) return process.env.WIBWOB_API;

  // 0 alive
  return null;
}

/** Resolve base URL, exiting with error if no instance found. */
function resolveBase(): string {
  const base = tryResolveBase();
  if (!base) {
    process.stderr.write(`No WibWob-DOS instances running.\nStart one with: bun run dev\n`);
    process.exit(1);
  }
  // Health gate: warn if target instance appears headless (screen 1×1)
  // Only check socket-based instances (remote/env-URL instances skip the gate)
  const strict = process.argv.includes("--strict");
  if (base.startsWith("unix://") && !findFlag("--instance", "-i")) {
    try {
      const sock = base.slice("unix://".length);
      const res = _spawnSync("curl", [
        "-sf", "--unix-socket", sock, "http://localhost/health",
      ], { timeout: 800, encoding: "utf-8" });
      const health = JSON.parse(res.stdout ?? "{}") as { screen?: { width: number; height: number } };
      const w = health.screen?.width ?? 99;
      const h = health.screen?.height ?? 99;
      if (w <= 1 || h <= 1) {
        process.stderr.write(`⚠  Target instance screen is ${w}×${h} — may be headless (commands may silently no-op).\n`);
        process.stderr.write(`   Use -i <label> to target a specific instance, or check: wibwob ls\n`);
        if (strict) {
          process.stderr.write(`   --strict: refusing to dispatch to headless instance.\n`);
          process.exit(1);
        }
      }
    } catch { /* health check failed — proceed */ }
  }
  return base;
}

// Lazy resolution — only resolved when a command actually needs the API connection.
// Local-only commands (clean, help, start, etc.) work fine with zero instances.
let _resolvedBase: string | undefined;
function getBase(): string {
  if (!_resolvedBase) _resolvedBase = resolveBase();
  return _resolvedBase;
}
function getIsSocket(): boolean {
  return getBase().startsWith("unix://");
}
/** Try to get base URL without exiting (for commands that optionally use API). */
function tryGetBase(): string | null {
  if (_resolvedBase) return _resolvedBase;
  const base = tryResolveBase();
  if (base) _resolvedBase = base;
  return base;
}
const QUIET = process.argv.includes("-q") || process.argv.includes("--quiet");

// ── Helpers ──────────────────────────────────────────────

/** Build a fetch URL + options that handle both TCP and unix socket modes. */
function socketFetchArgs(apiPath: string, extraOpts?: RequestInit): [string, RequestInit] {
  const opts: RequestInit = { ...extraOpts };
  let url: string;
  if (getIsSocket()) {
    (opts as any).unix = getBase().slice("unix://".length);
    url = `http://localhost${apiPath}`;
  } else {
    url = `${getBase()}${apiPath}`;
  }
  return [url, opts];
}

/** Build fetch options for a unix socket path (used by instance discovery). */
function unixFetchOpts(sockPath: string): RequestInit {
  return { unix: sockPath } as any;
}

async function api(apiPath: string, method = "GET", body?: unknown): Promise<unknown> {
  const reqInit: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) reqInit.body = JSON.stringify(body);
  const [url, opts] = socketFetchArgs(apiPath, reqInit);

  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("Connection refused")) {
      process.stderr.write("Instance found but not responding — it may be starting up. Retry in a moment.\n");
    } else {
      process.stderr.write(`Connection failed: ${msg}\n`);
    }
    process.exit(1);
  }
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

    // JSON positional: '{"key":"val"}' — merge directly into result
    if (arg.startsWith("{")) {
      try { Object.assign(result, JSON.parse(arg)); } catch { /* not valid JSON — skip */ }
      continue;
    }

    // --key [val]  or  -key [val]  (single-dash treated identically)
    if (arg.startsWith("-")) {
      const key = arg.startsWith("--") ? arg.slice(2) : arg.slice(1);
      if (!key) continue; // bare `-` or `--` separator — skip
      const next = args[i + 1];
      if (next === undefined || next.startsWith("-")) {
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
    // other positional strings (non-JSON, non-flag) — silently ignored as before
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
  const data = (await api(`/commands/list${suffix}`)) as {
    commands: Array<{
      id: string;
      label?: string;
      description?: string;
      params?: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
    }>
  };
  if (QUIET) {
    for (const c of data.commands) console.log(c.id);
  } else if (flags.json) {
    out(data.commands);
  } else {
    for (const c of data.commands) {
      const label = c.label ? `  ${c.label}` : "";
      process.stdout.write(`${c.id}${label}\n`);
      if (c.description) {
        process.stdout.write(`    ${c.description}\n`);
      }
      if (c.params?.properties && Object.keys(c.params.properties).length > 0) {
        const required = new Set(c.params.required ?? []);
        for (const [name, prop] of Object.entries(c.params.properties)) {
          const req = required.has(name) ? "" : "?";
          const type = prop.type ?? "any";
          const desc = prop.description ? `  — ${prop.description}` : "";
          process.stdout.write(`    --${name}${req} (${type})${desc}\n`);
        }
      }
      process.stdout.write("\n");
    }
  }
}

async function cmdHealth() {
  const health = (await api("/health")) as {
    instanceId?: string; instanceLabel?: string; pid?: number;
    port?: number; uptime?: string; socketPath?: string;
    screen?: { width: number; height: number } | null;
  };

  if (QUIET) {
    out(health);
    return;
  }

  // Human-readable health output
  const label = health.instanceLabel ?? health.instanceId ?? "?";
  const screenStr = health.screen ? `${health.screen.width}×${health.screen.height}` : "unknown";
  const MIN_W = 40, MIN_H = 10;
  const headless = health.screen && (health.screen.width < MIN_W || health.screen.height < MIN_H);
  process.stderr.write(`instance: ${label}\n`);
  process.stderr.write(`pid: ${health.pid ?? "?"}\n`);
  process.stderr.write(`port: ${health.port ?? "?"}\n`);
  process.stderr.write(`screen: ${screenStr}${headless ? "  ← HEADLESS (below 40×10 minimum)" : ""}\n`);
  process.stderr.write(`uptime: ${health.uptime ?? "?"}\n`);

  // Multi-instance warning: scan for other alive instances
  // Uses shared probeInstanceHealth() — de-duplicates by PID
  const alive = findAliveInstances();
  const seen = new Set<number>();
  const shown: Array<{ label: string; health: InstanceHealth }> = [];
  for (const inst of alive) {
    const h = await probeInstanceHealth(inst.socketPath);
    if (!h) continue;
    if (h.pid != null && seen.has(h.pid)) continue;
    if (h.pid != null) seen.add(h.pid);
    shown.push({ label: inst.label, health: h });
  }
  if (shown.length > 1) {
    process.stderr.write(`\n⚠ ${shown.length} instances running:\n`);
    for (const s of shown) {
      const h = s.health;
      const portStr = h.port ? `port=${h.port}` : "";
      const pidStr = h.pid ? `pid=${h.pid}` : "";
      const sw = h.screen ? `screen=${h.screen.width}×${h.screen.height}` : "";
      const warn = h.screen && (h.screen.width < MIN_W || h.screen.height < MIN_H) ? "  ← HEADLESS" : "";
      const isTarget = s.label === label || s.health.instanceId === (health as Record<string, unknown>).instanceId;
      const here = isTarget ? "  ← you are here" : "";
      process.stderr.write(`  ${s.label}  ${portStr}  ${pidStr}  ${sw}${warn}${here}\n`);
    }
  }

  // Also output JSON to stdout for scripts
  out(health);
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
  const [url, opts] = socketFetchArgs(`/screenshot/text${qs}`);
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

  // Build candidate commands: try microapp prefix first, then bare prefix for host windows
  const microPrefix = `microapp.${appType}`;
  // Host window prefixes: "wibwob-agent" → "agent", "text-editor" → "editor"
  const barePrefix = appType.replace(/^wibwob-/, "").replace(/^text-/, "");

  // Try write → send → create fallback convention
  const candidates = [
    { cmd: `${microPrefix}.write`, args: { text: trimmed, windowId: id } },
    { cmd: `${microPrefix}.send`, args: { message: trimmed } },
    { cmd: `${microPrefix}.create`, args: { body: trimmed, title: trimmed.slice(0, 50) } },
    // Host window fallbacks (agent.send, companion.send, etc.)
    { cmd: `${barePrefix}.send`, args: { text: trimmed } },
    { cmd: `${barePrefix}.write`, args: { text: trimmed, windowId: id } },
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
    `App ${appType} does not support write (no write/send/create command found)\n`,
  );
  process.exit(1);
}

async function cmdPlumb(args: string[]) {
  const flags = parseFlags(args.slice(1));
  const fromId = flags.from as number | undefined;
  const toId = flags.to as number | undefined;

  if (fromId === undefined || toId === undefined) {
    process.stderr.write("Usage: wibwob plumb --from <window-id> --to <window-id>\n");
    process.stderr.write("Routes text from source window to destination window.\n");
    process.exit(1);
  }

  // 1. Get state to validate both windows
  const state = (await api("/state")) as {
    windows: Array<{ id: number; appType?: string }>;
  };
  const srcWin = state.windows.find((w) => w.id === fromId);
  const dstWin = state.windows.find((w) => w.id === toId);

  if (!srcWin) {
    process.stderr.write(`No window with id ${fromId}\n`);
    process.exit(1);
  }
  if (!dstWin) {
    process.stderr.write(`No window with id ${toId}\n`);
    process.exit(1);
  }

  // 2. Read source text via screenshot
  const [url, fetchOpts] = socketFetchArgs(`/screenshot/text?id=${fromId}`);
  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    process.stderr.write(`Could not read window ${fromId}: ${res.status}\n`);
    process.exit(1);
  }
  const text = (await res.text()).trimEnd();

  // 3. Write to destination using the write fallback chain
  const dstAppType = dstWin.appType;
  if (!dstAppType) {
    process.stderr.write(`Window ${toId} has no appType\n`);
    process.exit(1);
  }

  const microPrefix = `microapp.${dstAppType}`;
  // Host window prefixes: "wibwob-agent" → "agent", "text-editor" → "editor"
  const barePrefix = dstAppType.replace(/^wibwob-/, "").replace(/^text-/, "");
  const candidates = [
    { cmd: `${microPrefix}.write`, args: { text, windowId: toId } },
    { cmd: `${microPrefix}.send`, args: { message: text } },
    { cmd: `${microPrefix}.create`, args: { body: text, title: text.slice(0, 50) } },
    { cmd: `${barePrefix}.send`, args: { text } },
    { cmd: `${barePrefix}.write`, args: { text, windowId: toId } },
  ];

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
      if (!QUIET) {
        out({ ok: true, from: fromId, to: toId, command: candidate.cmd, bytesRouted: text.length });
      }
      return;
    }
  }

  process.stderr.write(
    `Window ${toId} (${dstAppType}) does not support write\n`,
  );
  process.exit(1);
}

async function cmdStart(args: string[]) {
  const { spawnSync } = await import("node:child_process");
  const repoRoot = APP_ROOT;

  // Check if already running (use tryGetBase to avoid exit on no instance)
  const base = tryGetBase();
  if (base) {
    try {
      const opts: RequestInit = {};
      let url: string;
      if (base.startsWith("unix://")) {
        (opts as any).unix = base.slice("unix://".length);
        url = "http://localhost/health";
      } else {
        url = `${base}/health`;
      }
      const res = await fetch(url, opts);
      if (res.ok) {
        const health = await res.json() as Record<string, unknown>;
        process.stderr.write(
          `Already running — instance=${health.instanceLabel ?? "?"} pid=${health.pid} uptime=${health.uptime}s\n`,
        );
        process.exit(0);
      }
    } catch {
      // Not responding — proceed to start
    }
  }

  // Pass through extra flags (--cmd, --port, etc.)
  const passthrough = args.slice(1).filter(a => a !== "start");
  process.stderr.write("Starting WibWob-DOS...\n");
  const result = spawnSync("bash", [
    path.join(repoRoot, "scripts/ensure-running.sh"),
    ...passthrough,
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

async function cmdRestart(args: string[]) {
  const { spawnSync } = await import("node:child_process");
  const repoRoot = APP_ROOT;

  // Pass through extra flags (--force, --cmd, etc.)
  const passthrough = args.slice(1).filter(a => a !== "restart");
  process.stderr.write("Restarting WibWob-DOS...\n");
  const result = spawnSync("bash", [
    path.join(repoRoot, "scripts/restart.sh"),
    ...passthrough,
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

async function cmdTui() {
  const { spawnSync } = await import("node:child_process");
  const repoRoot = APP_ROOT;
  const force = process.argv.includes("--force");

  const alive = findAliveInstances();

  // ── No instance: start fresh ──────────────────────────────────────
  if (alive.length === 0) {
    process.stderr.write("[tui] no instance running — starting fresh\n");
    const result = spawnSync("bun", ["run", "src/app.ts"], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
    return;
  }

  // ── Multiple instances need -i to disambiguate ────────────────────
  if (alive.length > 1 && !findFlag("--instance", "-i")) {
    process.stderr.write(`Multiple instances: ${alive.map(i => i.label).join(", ")}\n`);
    process.stderr.write(`Use: wibwob -i <label> tui\n`);
    process.exit(1);
    return;
  }

  // ── Find target ───────────────────────────────────────────────────
  const targetInst = alive.length === 1
    ? alive[0]
    : findAliveInstanceBySelector(findFlag("--instance", "-i") ?? process.env.WIBWOB_INSTANCE ?? alive[0].label) ?? alive[0];
  const sockPath = targetInst.socketPath;
  const attachLabel = targetInst.instanceLabel ?? targetInst.label;
  const orphanWorkspace = `orphan-${attachLabel}`;

  // ── Health probe: check if instance has a real display ────────────
  type HealthShape = { screen?: { width: number; height: number } | null; pid?: number };
  let health: HealthShape = {};
  let instanceAlive = false;
  if (sockPath && fs.existsSync(sockPath)) {
    try {
      const res = await fetch("http://localhost/health", {
        ...unixFetchOpts(sockPath),
        signal: AbortSignal.timeout(800),
      } as RequestInit);
      if (res.ok) {
        health = await res.json() as HealthShape;
        instanceAlive = true;
      }
    } catch { /* not responding */ }
  }

  const w = health.screen?.width ?? 0;
  const h = health.screen?.height ?? 0;
  const hasDisplay = w > 10 && h > 5;

  // ── Already open in another terminal — start a fresh independent instance ──
  if (hasDisplay && !force) {
    process.stderr.write(`[tui] instance ${health.pid} already running (${w}×${h}) — starting new instance here\n`);
    const result = spawnSync("bun", ["run", "src/app.ts"], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
    return;
  }

  // ── Take over: save workspace → kill → restart here ───────────────
  if (instanceAlive && sockPath) {
    try {
      await fetch("http://localhost/workspace/save", {
        ...unixFetchOpts(sockPath),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orphanWorkspace }),
      });
      process.stderr.write(`[tui] saved workspace as ${orphanWorkspace}\n`);
    } catch {
      process.stderr.write("[tui] warning: could not save workspace\n");
    }
    if (health.pid) {
      try {
        process.kill(Number(health.pid), "SIGTERM");
        process.stderr.write(`[tui] stopped instance ${health.pid}\n`);
      } catch {}
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Clean stale socket
  if (sockPath && fs.existsSync(sockPath)) {
    try { fs.unlinkSync(sockPath); } catch {}
  }

  process.stderr.write(`[tui] launching (workspace=${orphanWorkspace})...\n`);
  const result = spawnSync("bun", ["run", "src/app.ts", "--workspace", orphanWorkspace], {
    cwd: repoRoot,
    env: { ...process.env, WIBWOB_INSTANCE_LABEL: attachLabel },
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

async function cmdAttach() {
  const { spawnSync } = await import("node:child_process");
  const selector = findFlag("--instance", "-i") || process.env.WIBWOB_INSTANCE || "main";
  const repoRoot = APP_ROOT;

  process.stderr.write(`[attach] looking for instance '${selector}'...\n`);

  const target = findAliveInstanceBySelector(selector);
  const sockPath = target?.socketPath;
  const attachLabel = target?.instanceLabel ?? target?.label ?? selector;
  const orphanWorkspace = `orphan-${attachLabel}`;

  // 1. Check if instance is alive (headless orphan?)
  let alive = false;
  if (sockPath && fs.existsSync(sockPath)) {
    try {
      const res = await fetch("http://localhost/health", unixFetchOpts(sockPath));
      alive = res.ok;
    } catch {
      alive = false;
    }
  }

  // If alive, it's a headless orphan — kill it so we can take over the terminal
  if (alive && sockPath) {
    process.stderr.write("[attach] found headless instance — taking over\n");
    // Save its state first
    try {
      await fetch("http://localhost/workspace/save", {
        ...unixFetchOpts(sockPath),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orphanWorkspace }),
      });
      process.stderr.write(`[attach] saved workspace as ${orphanWorkspace}\n`);
    } catch {
      process.stderr.write("[attach] warning: could not save workspace\n");
    }
    // Kill it
    try {
      const res = await fetch("http://localhost/health", unixFetchOpts(sockPath));
      const health = await res.json() as Record<string, unknown>;
      if (health.pid) {
        process.kill(Number(health.pid), "SIGTERM");
        process.stderr.write(`[attach] killed headless process ${health.pid}\n`);
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
  }

  // 2. Clean stale target socket if it still exists but is unresponsive
  if (sockPath && fs.existsSync(sockPath) && !alive) {
    try { fs.unlinkSync(sockPath); } catch {}
    process.stderr.write(`[attach] cleaned stale socket ${sockPath}\n`);
  }

  // 3. Launch TUI in THIS terminal. Always pass orphan workspace name;
  // app restore logic falls back to default workspace if missing.
  const startArgs = ["run", "src/app.ts", "--workspace", orphanWorkspace];

  process.stderr.write(`[attach] launching TUI (workspace=${orphanWorkspace})...\n`);
  const result = spawnSync("bun", startArgs, {
    cwd: repoRoot,
    env: { ...process.env, WIBWOB_INSTANCE_LABEL: attachLabel },
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}

async function cmdInstances() {
  const alive = findAliveInstances();
  if (alive.length === 0) {
    process.stderr.write("No instances running\n");
    process.exit(1);
  }

  if (QUIET) {
    for (const inst of alive) process.stdout.write(`${inst.label}\n`);
    return;
  }

  // Enrich with health probe — uses shared probeInstanceHealth()
  const manifest = readRuntimeControlManifest();
  const canonicalSocket = manifest?.socketPath;
  const results: Array<Record<string, unknown>> = [];
  const seenIdentity = new Set<string>();

  for (const inst of alive) {
    const health = await probeInstanceHealth(inst.socketPath);
    if (health) {
      const identity = String(
        health.instanceId ?? health.instanceLabel ?? health.instanceDisplayId ?? health.pid ?? inst.socketPath,
      );
      if (seenIdentity.has(identity)) continue;
      seenIdentity.add(identity);

      results.push({
        label: inst.label,
        socket: inst.socketPath,
        canonical: canonicalSocket != null && canonicalSocket === inst.socketPath,
        ...health,
      });
    } else {
      const identity = `starting:${inst.socketPath}`;
      if (seenIdentity.has(identity)) continue;
      seenIdentity.add(identity);
      results.push({
        label: inst.label,
        socket: inst.socketPath,
        canonical: canonicalSocket != null && canonicalSocket === inst.socketPath,
        ok: true,
        status: "starting",
      });
    }
  }

  // Summary line to stderr — visible in first line of TUI without parsing JSON
  const MIN_W = 40, MIN_H = 10;
  const summaries = results.map((r) => {
    const id = r.instanceLabel || r.instanceDisplayId || r.label || "?";
    const port = r.port ? String(r.port) : "?";
    const screen = r.screen as { width: number; height: number } | null | undefined;
    const w = screen?.width ?? 0;
    const h = screen?.height ?? 0;
    const headless = (w < MIN_W || h < MIN_H) ? ",HEADLESS" : "";
    return `${id}(${port},${w}×${h}${headless})`;
  });
  process.stderr.write(`${results.length} instances: ${summaries.join("  ")}\n`);

  out(results);
}

async function readApiBestEffort(apiPath: string): Promise<unknown> {
  try {
    const [url, opts] = socketFetchArgs(apiPath, { method: "GET" });
    const res = await fetch(url, opts as any);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, path: apiPath };
    }
    return await res.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      path: apiPath,
    };
  }
}

function collectTmuxPaneTail(lines = 400): string | null {
  try {
    const escaped = Math.max(1, lines);
    return execSync(`tmux capture-pane -p -t wibwob -S -${escaped}`, {
      encoding: "utf8",
      timeout: 2500,
    });
  } catch {
    return null;
  }
}

function collectFileTail(filePath: string, maxBytes = 64 * 1024): string | null {
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

async function cmdCrashBundle(args: string[]) {
  const flags = parseFlags(args.slice(1));
  const outDir = typeof flags.out === "string"
    ? String(flags.out)
    : path.join(SCRATCH_BASE, "reports", "crash-bundles", new Date().toISOString().replace(/[:.]/g, "-"));

  fs.mkdirSync(outDir, { recursive: true });

  const [health, instances, state, inspection] = await Promise.all([
    readApiBestEffort("/health"),
    (async () => {
      try {
        const alive = findAliveInstances();
        return alive.map((a) => ({
          label: a.label,
          socketPath: a.socketPath,
          instanceId: a.instanceId,
          instanceDisplayId: a.instanceDisplayId,
          instanceLabel: a.instanceLabel,
        }));
      } catch (error) {
        return [{ error: error instanceof Error ? error.message : String(error) }];
      }
    })(),
    readApiBestEffort("/state"),
    readApiBestEffort("/runtime/inspection"),
  ]);

  const tmuxTail = collectTmuxPaneTail(500);
  const paneLogTail = collectFileTail(path.join(SCRATCH_BASE, "logs", "wibwob-tmux-pane.log"), 96 * 1024);
  const appLogTail = collectFileTail(path.join(SCRATCH_BASE, "wibwob.log"), 96 * 1024);
  const manifest = readRuntimeControlManifest();

  safeWriteFile(path.join(outDir, "health.json"), `${JSON.stringify(health, null, 2)}\n`);
  safeWriteFile(path.join(outDir, "instances.json"), `${JSON.stringify(instances, null, 2)}\n`);
  safeWriteFile(path.join(outDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
  safeWriteFile(path.join(outDir, "inspection.json"), `${JSON.stringify(inspection, null, 2)}\n`);
  safeWriteFile(path.join(outDir, "runtime-control-manifest.json"), `${JSON.stringify(manifest ?? {}, null, 2)}\n`);
  safeWriteFile(path.join(outDir, "tmux-pane-tail.txt"), `${tmuxTail ?? "(tmux pane unavailable)"}\n`);
  safeWriteFile(path.join(outDir, "tmux-pane-log-tail.txt"), `${paneLogTail ?? "(pane log unavailable)"}\n`);
  safeWriteFile(path.join(outDir, "app-log-tail.txt"), `${appLogTail ?? "(app log unavailable)"}\n`);

  out({
    ok: true,
    bundleDir: outDir,
    files: [
      "health.json",
      "instances.json",
      "state.json",
      "inspection.json",
      "runtime-control-manifest.json",
      "tmux-pane-tail.txt",
      "tmux-pane-log-tail.txt",
      "app-log-tail.txt",
    ],
  });
}

// ── Clean (orphan process + stale file cleanup) ─────────

interface CleanTarget {
  pid: number;
  cmd: string;
  source: "pidfile" | "scan";
  label?: string;
  pidPath?: string;
  socketPath?: string;
}

interface StaleFile {
  path: string;
  kind: "pid" | "socket" | "legacy";
}

/** Cross-platform: get the command line for a PID. */
function getPsCmd(pid: number): string | null {
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  try {
    // args= works on macOS, cmd= works on Linux — try args= first (works on both)
    const result = execSync(`ps -p ${pid} -o args= 2>/dev/null || ps -p ${pid} -o cmd= 2>/dev/null`, {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/** Check if a process belongs to this WibWob-DOS repo. */
function isOurProcess(pid: number, repoRoot: string): boolean {
  const cmd = getPsCmd(pid);
  if (!cmd) return false;
  // Must match WibWob-DOS process patterns
  const wwPattern = /bun.*(dev:world|dev:alt|dev:world:alt|src\/app\.ts)|script.*bun.*dev/;
  if (!wwPattern.test(cmd)) return false;
  // Prefer repo-root check via command line (works cross-platform)
  if (cmd.includes(repoRoot)) return true;
  // On Linux, check /proc/PID/cwd
  try {
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    if (cwd.startsWith(repoRoot)) return true;
  } catch {
    // Not on Linux or no permissions — that's fine
  }
  // Can't verify cwd — only accept if this is the only WibWob repo on the machine.
  // On macOS, try lsof to check cwd.
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const lsofOut = execSync(`lsof -p ${pid} -Fn 2>/dev/null | grep '^n.*cwd' || true`, {
      encoding: "utf8", timeout: 2000,
    }).trim();
    if (lsofOut && !lsofOut.includes(repoRoot)) return false;
  } catch { /* lsof unavailable — accept the match */ }
  return true;
}

function discoverCleanTargets(repoRoot: string): { processes: CleanTarget[]; staleFiles: StaleFile[]; healthyPids: Set<number> } {
  const selfPid = process.pid;
  const parentPid = process.ppid;
  const seen = new Set<number>();
  const processes: CleanTarget[] = [];
  const staleFiles: StaleFile[] = [];
  const healthyPids = new Set<number>(); // PIDs with live socket — these are real instances, not orphans

  // Source 1a: canonical instance-scoped control sidecars
  const canonicalInstancesDir = path.join(DATA_ROOT, "instances");
  let canonicalEntries: fs.Dirent[] = [];
  try { canonicalEntries = fs.readdirSync(canonicalInstancesDir, { withFileTypes: true }); } catch { /* dir may not exist */ }
  for (const entry of canonicalEntries) {
    if (!entry.isDirectory()) continue;
    const instanceRoot = path.join(canonicalInstancesDir, entry.name);
    const controlPidPath = path.join(instanceRoot, "control.pid");
    const runtimePidPath = path.join(instanceRoot, "wibwob.pid");
    const sockPath = path.join(instanceRoot, "control.sock");
    const pid = readPidFile(controlPidPath) ?? readPidFile(runtimePidPath);

    if (!pid) {
      if (fs.existsSync(controlPidPath)) staleFiles.push({ path: controlPidPath, kind: "pid" });
      if (fs.existsSync(sockPath)) staleFiles.push({ path: sockPath, kind: "socket" });
      continue;
    }
    if (pid === selfPid || pid === parentPid) continue;

    const alive = isPidAlive(pid);
    if (alive) {
      const hasSocket = fs.existsSync(sockPath);
      const cmd = getPsCmd(pid) ?? "<unknown>";
      processes.push({
        pid,
        cmd,
        source: "pidfile",
        label: entry.name,
        pidPath: controlPidPath,
        socketPath: sockPath,
      });
      seen.add(pid);
      if (hasSocket) healthyPids.add(pid);
    } else {
      if (fs.existsSync(controlPidPath)) staleFiles.push({ path: controlPidPath, kind: "pid" });
      if (fs.existsSync(sockPath)) staleFiles.push({ path: sockPath, kind: "socket" });
    }
  }

  // Source 1b: legacy scratch/instances sidecars
  const legacyInstancesDir = path.join(SCRATCH_BASE, "instances");
  let pidFiles: string[] = [];
  try { pidFiles = fs.readdirSync(legacyInstancesDir).filter(f => f.endsWith(".pid")); } catch { /* dir may not exist */ }

  for (const file of pidFiles) {
    const label = file.replace(".pid", "");
    const pidFile = path.join(legacyInstancesDir, file);
    const pid = readPidFile(pidFile);
    if (!pid) {
      staleFiles.push({ path: pidFile, kind: "pid" });
      continue;
    }
    if (pid === selfPid || pid === parentPid) continue;

    const alive = isPidAlive(pid);
    if (alive) {
      const sockPath = path.join(legacyInstancesDir, `${label}.sock`);
      const hasSocket = fs.existsSync(sockPath);
      const cmd = getPsCmd(pid) ?? "<unknown>";
      processes.push({ pid, cmd, source: "pidfile", label, pidPath: pidFile, socketPath: sockPath });
      seen.add(pid);
      if (hasSocket) healthyPids.add(pid);
    } else {
      staleFiles.push({ path: pidFile, kind: "pid" });
      const sockPath = path.join(legacyInstancesDir, `${label}.sock`);
      if (fs.existsSync(sockPath)) staleFiles.push({ path: sockPath, kind: "socket" });
    }
  }

  // Orphan legacy sockets (socket exists but no matching PID file)
  let sockFiles: string[] = [];
  try { sockFiles = fs.readdirSync(legacyInstancesDir).filter(f => f.endsWith(".sock")); } catch { /* */ }
  for (const file of sockFiles) {
    const label = file.replace(".sock", "");
    const pidFile = path.join(legacyInstancesDir, `${label}.pid`);
    const sockPath = path.join(legacyInstancesDir, file);
    if (!fs.existsSync(pidFile) && !staleFiles.some(s => s.path === sockPath)) {
      staleFiles.push({ path: sockPath, kind: "socket" });
    }
  }

  // Source 2: process scan for bun processes matching WibWob patterns
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const psOutput = execSync(
      `ps -eo pid,args 2>/dev/null || ps -eo pid,cmd 2>/dev/null || ps -A 2>/dev/null`,
      { encoding: "utf8", timeout: 3000 }
    );
    const wwPattern = /bun.*(dev:world|dev:alt|dev:world:alt|src\/app\.ts)|script.*bun.*dev/;
    for (const line of psOutput.split("\n")) {
      if (!wwPattern.test(line)) continue;
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (isNaN(pid) || pid === selfPid || pid === parentPid || seen.has(pid)) continue;
      if (isOurProcess(pid, repoRoot)) {
        const cmd = getPsCmd(pid) ?? "<unknown>";
        processes.push({ pid, cmd, source: "scan" });
        seen.add(pid);
      }
    }
  } catch { /* ps may fail in some containers — that's ok */ }

  // Legacy scratch/wibwob.pid
  const legacyPidFile = path.join(SCRATCH_BASE, "wibwob.pid");
  if (fs.existsSync(legacyPidFile)) {
    const lpid = readPidFile(legacyPidFile);
    const alive = lpid ? isPidAlive(lpid) : false;
    if (!alive) {
      staleFiles.push({ path: legacyPidFile, kind: "legacy" });
    }
  }

  return { processes, staleFiles, healthyPids };
}

async function cmdClean(args: string[]) {
  const flags = parseFlags(args.slice(1));
  const doKill = flags.kill === true || flags.force === true;
  const doForce = flags.force === true;
  const repoRoot = APP_ROOT;

  const { processes, staleFiles, healthyPids } = discoverCleanTargets(repoRoot);

  // Separate healthy instances from orphans
  const healthy = processes.filter(p => healthyPids.has(p.pid));
  const orphans = processes.filter(p => !healthyPids.has(p.pid));

  // ── Report ──
  process.stderr.write("WibWob-DOS Instance Cleanup\n");
  process.stderr.write("===========================\n\n");

  if (orphans.length === 0 && staleFiles.length === 0) {
    if (healthy.length > 0) {
      process.stderr.write(`Healthy instances (${healthy.length}) — will NOT touch:\n`);
      for (const p of healthy) {
        process.stderr.write(`  PID ${p.pid}  [${p.label}]  ${p.cmd}\n`);
      }
      process.stderr.write("\n");
    }
    process.stderr.write("Clean — no orphans, no stale files.\n");
    out({ clean: true, healthy: healthy.length, orphans: 0, staleFiles: 0 });
    return;
  }

  if (healthy.length > 0) {
    process.stderr.write(`Healthy instances (${healthy.length}) — will NOT touch:\n`);
    for (const p of healthy) {
      process.stderr.write(`  PID ${p.pid}  [${p.label}]  ${p.cmd}  ✓\n`);
    }
    process.stderr.write("\n");
  }

  if (orphans.length > 0) {
    process.stderr.write(`Orphan processes (${orphans.length}):\n`);
    for (const p of orphans) {
      const src = p.label ? `[${p.label}]` : `[scan]`;
      process.stderr.write(`  PID ${p.pid}  ${src}  ${p.cmd}\n`);
    }
    process.stderr.write("\n");
  }

  if (staleFiles.length > 0) {
    process.stderr.write(`Stale files (${staleFiles.length}):\n`);
    for (const f of staleFiles) {
      const tag = f.kind === "legacy" ? " (legacy)" : "";
      process.stderr.write(`  ${f.path}${tag}\n`);
    }
    process.stderr.write("\n");
  }

  if (!doKill) {
    process.stderr.write("Dry run — pass --kill to clean orphans, --force to SIGKILL.\n");
    out({
      dryRun: true,
      healthy: healthy.map(p => ({ pid: p.pid, cmd: p.cmd, label: p.label })),
      orphans: orphans.map(p => ({ pid: p.pid, cmd: p.cmd, label: p.label })),
      staleFiles: staleFiles.map(f => f.path),
    });
    return;
  }

  // ── Kill orphan processes only ──
  const killed: number[] = [];
  const survivors: number[] = [];

  if (orphans.length > 0) {
    process.stderr.write(`Sending SIGTERM to ${orphans.length} orphan processes...\n`);
    for (const p of orphans) {
      try {
        process.kill(p.pid, "SIGTERM");
        process.stderr.write(`  SIGTERM → PID ${p.pid}\n`);
        killed.push(p.pid);
      } catch {
        process.stderr.write(`  PID ${p.pid} already dead\n`);
      }
    }

    // Wait for graceful shutdown
    await new Promise(r => setTimeout(r, 2000));

    // Check for survivors
    for (const p of orphans) {
      let alive = false;
      try { process.kill(p.pid, 0); alive = true; } catch { /* dead */ }
      if (alive) {
        if (doForce) {
          try {
            process.kill(p.pid, "SIGKILL");
            process.stderr.write(`  PID ${p.pid} still alive — SIGKILL\n`);
          } catch { /* */ }
        } else {
          survivors.push(p.pid);
          process.stderr.write(`  ⚠ PID ${p.pid} still alive — use --force to SIGKILL\n`);
        }
      }
    }
  }

  // ── Clean stale files ──
  const removed: string[] = [];
  for (const f of staleFiles) {
    try {
      fs.unlinkSync(f.path);
      removed.push(f.path);
      process.stderr.write(`  Removed ${f.path}\n`);
    } catch { /* already gone */ }
  }

  // Also clean up PID/socket files for orphan processes we just killed
  for (const p of orphans) {
    for (const fp of [p.pidPath, p.socketPath].filter(Boolean) as string[]) {
      try { fs.unlinkSync(fp); removed.push(fp); } catch { /* */ }
    }
  }

  process.stderr.write("\nDone.\n");
  out({ killed, survivors, removed });
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

// ── Open (deep-link router) ──────────────────────────────

async function cmdOpen(args: string[]) {
  // wibwob open <path-or-url> [--app <hint>] [--line <n>]
  const target = args[1];
  if (!target) {
    process.stderr.write("Usage: wibwob open <path|url> [--app editor|finder|markdown|primer] [--line N]\n");
    process.exit(1);
  }

  const flags = parseFlags(args.slice(2));
  const { route, discoverInstance, dispatch } = await import("./wibwob-router.js");

  const isUrl = target.startsWith("wibwob://");
  const intent = isUrl
    ? { url: target }
    : {
        path: target,
        line: flags.line ? Number(flags.line) : undefined,
        app: flags.app as "editor" | "finder" | "markdown" | "primer" | undefined,
      };

  const result = route(intent);
  if (!result) {
    process.stderr.write(`Cannot route: ${target}\n`);
    process.exit(1);
  }

  // Try WibWob-DOS first
  const projectRoot = resolveBase();
  const instance = await discoverInstance(projectRoot);

  if (instance) {
    const ok = await dispatch(instance, result);
    if (ok) {
      out({ ok: true, instance: instance.label ?? `port:${instance.port}`, routed: result.commands.map((c: { id: string }) => c.id), target });
      return;
    }
    process.stderr.write("WibWob-DOS dispatch failed — falling back to system open\n");
  }

  // Fallback: system open
  const { execSync } = await import("node:child_process");
  const openTarget = intent.path ?? target;
  try {
    if (process.platform === "darwin") {
      execSync(`open ${JSON.stringify(openTarget)}`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open ${JSON.stringify(openTarget)} 2>/dev/null`, { stdio: "ignore" });
    }
    out({ ok: true, fallback: true, target: openTarget });
  } catch {
    process.stderr.write(`Failed to open: ${openTarget}\n`);
    process.exit(1);
  }
}

// ── CLI Command Table (single source of truth) ──────────

interface CliCommand {
  name: string;
  aliases?: string[];
  args?: string;
  desc: string;
  fn: (args: string[]) => Promise<void> | void;
}

const CLI_COMMANDS: CliCommand[] = [
  { name: "state",       desc: "Full desktop state (JSON)",                       fn: () => cmdState() },
  { name: "inspection",  desc: "Full runtime inspection snapshot (JSON)",          fn: () => cmdInspection() },
  { name: "windows",     args: "[-q]",           desc: "List windows (JSON, -q for IDs only)", fn: () => cmdWindows() },
  { name: "commands",    args: "[-q] [--surface S]", desc: "List available commands",           fn: () => cmdCommands() },
  { name: "health",      aliases: ["status"], desc: "API health check",         fn: () => cmdHealth() },
  { name: "minimap",     aliases: ["map"],        desc: "Spatial map of all windows",           fn: () => cmdMinimap() },
  { name: "screenshot",  aliases: ["read"], args: "[id]", desc: "Text screenshot (desktop or window)", fn: (a) => cmdScreenshot(a[1]) },
  { name: "write",       args: "<id>",           desc: "Write stdin text into a window (pipe in)", fn: (a) => cmdWrite(a[1]) },
  { name: "plumb",       args: "--from <id> --to <id>", desc: "Route text from one window to another", fn: (a) => cmdPlumb(a) },
  { name: "start",       desc: "Start instance (idempotent if already running)",  fn: (a) => cmdStart(a) },
  { name: "restart",     desc: "Stop and restart instance",                       fn: (a) => cmdRestart(a) },
  { name: "instances",   aliases: ["list", "ls"], desc: "List running instances (PID-checked)",   fn: () => cmdInstances() },
  { name: "crash-bundle", args: "[--out <dir>]", desc: "Collect health/state/log/tmux crash evidence bundle", fn: (a) => cmdCrashBundle(a) },
  { name: "clean",       args: "[--kill] [--force]", desc: "Find orphan processes + stale files (dry run unless --kill)", fn: (a) => cmdClean(a) },
  { name: "tui",         args: "[--force]",       desc: "Open TUI in this terminal (takes over headless instance)", fn: () => cmdTui() },
  { name: "attach",      desc: "Resurrect from orphan workspace",                 fn: () => cmdAttach() },
  { name: "open",        args: "<path|url> [--app A] [--line N]", desc: "Open file/dir/URL in WibWob-DOS (fallback: system)", fn: (a) => cmdOpen(a) },
  { name: "completions", args: "[--zsh|--bash]",  desc: "Generate shell completions",           fn: () => cmdCompletions() },
  { name: "cmd",         args: "<id> [--key val]", desc: "Run command by ID",                   fn: (a) => {
    const id = a[1];
    if (!id) { process.stderr.write("Usage: wibwob cmd <command-id> [--flags]\n"); process.exit(1); }
    return cmdRun(id, parseFlags(a.slice(2)));
  }},
];

// Build lookup map (name + aliases → command)
const CLI_CMD_MAP = new Map<string, CliCommand>();
for (const cmd of CLI_COMMANDS) {
  CLI_CMD_MAP.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) CLI_CMD_MAP.set(alias, cmd);
}

function usage() {
  // Agent-facing context: live instances + targeting reminder
  const alive = findAliveInstances();
  const instanceLine = alive.length === 0
    ? "Instances: none running — start with: bun run dev:world"
    : `Instances: ${alive.map(i => i.label).join(" · ")}  →  use -i <label> on every command`;

  const lines = [
    "wibwob — Unix CLI for WibWob-DOS",
    "",
    instanceLine,
    "",
    "Usage:",
  ];

  for (const cmd of CLI_COMMANDS) {
    const names = cmd.aliases ? `${cmd.name}|${cmd.aliases.join("|")}` : cmd.name;
    const sig = `  wibwob ${names}${cmd.args ? " " + cmd.args : ""}`;
    lines.push(`${sig.padEnd(42)}${cmd.desc}`);
  }

  // Dynamic dispatch patterns (not in the table — they're fallthrough logic)
  lines.push(`${"  wibwob <domain>.<verb> [--flags]".padEnd(42)}Run catalog command (dot syntax)`);
  lines.push(`${"  wibwob <domain> <verb> [--flags]".padEnd(42)}Run catalog command (noun verb)`);
  lines.push(`${"  wibwob window <id> <verb> [--flags]".padEnd(42)}Target window then act`);
  lines.push(`${"  wibwob help".padEnd(42)}This message`);

  lines.push("");
  lines.push("Flags:");
  lines.push("  -i, --instance <label>  Target instance by label (connects via unix socket)");
  lines.push("  -q, --quiet             Output IDs only, one per line (for piping)");
  lines.push("");
  lines.push("Instance resolution (in order):");
  lines.push("  1. -i / --instance flag or $WIBWOB_INSTANCE env var → named socket");
  lines.push("  2. Runtime control manifest → canonical last-running socket");
  lines.push("  3. Socket scan: find sole alive instance via PID check");
  lines.push("  4. Error (no silent port fallback)");
  lines.push("");
  lines.push("Environment:");
  lines.push("  WIBWOB_INSTANCE  Target instance label (same as --instance)");
  lines.push("  WW_API           Base URL override (explicit, bypasses socket scan)");
  lines.push("  WIBWOB_API       Alias for WW_API");
  lines.push("");
  lines.push("Output: JSON to stdout, errors to stderr. Pipe to jq.");

  process.stderr.write(lines.join("\n") + "\n");
  process.exit(0);
}

// ── Dispatch ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    usage();
  }

  const sub = args[0];

  // Strip -q/--quiet and --instance/-i <label> from args for dispatch (already captured)
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-q" || args[i] === "--quiet") continue;
    if (args[i] === "--instance" || args[i] === "-i") { i++; continue; }
    if (args[i].startsWith("--instance=") || args[i].startsWith("-i=")) continue;
    filteredArgs.push(args[i]);
  }
  const cleanArgs = filteredArgs;
  const cleanSub = cleanArgs[0];
  if (!cleanSub) { usage(); return; }

  // ── Table-driven dispatch ──
  const matched = CLI_CMD_MAP.get(cleanSub);
  if (matched) {
    return matched.fn(cleanArgs);
  }

  // ── Fallthrough: dynamic dispatch patterns ──

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

main().catch((err: Error) => {
  process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
