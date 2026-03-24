// -------------------------------------------------------------------
// Control API — currently raw Bun.serve() with hand-rolled routing.
//
// TODO: migrate to Hono + @modelcontextprotocol/hono (?)
//
// Hono (https://hono.dev) is the Bun-native equivalent of FastAPI.
// The official MCP TS SDK ships @modelcontextprotocol/hono as a
// first-class middleware, giving us the same FastAPI+FastMCP pattern
// the C++ app uses (Python side) but in pure TypeScript:
//
//   import { Hono } from 'hono'
//   import { McpServer } from '@modelcontextprotocol/server'
//   import { mcpHono } from '@modelcontextprotocol/hono'
//
//   const app = new Hono()
//   const mcp = new McpServer({ name: 'wibwob-dos', version: '1.0.0' })
//   mcp.tool('tui_list_commands', {}, async () => { ... })
//   mcp.tool('tui_menu_command', { command: z.string(), ... }, async () => { ... })
//   app.all('/mcp', mcpHono(mcp))       // agents connect here
//   app.get('/state', (c) => c.json(getState()))  // REST still works
//   export default app                   // Bun.serve({ fetch: app.fetch })
//
// This collapses REST + MCP into one process/port. The CommandRegistry
// (BUILD-ORDER step 4) feeds both surfaces. Migrate when route count
// exceeds ~15 or when MCP agent support is needed.
//
// Packages: hono, @modelcontextprotocol/server, @modelcontextprotocol/hono, zod
// -------------------------------------------------------------------

import fs from "node:fs";
import { safeWriteFile } from "../core/safe-fs.js";
import path from "node:path";
import type { BackroomsChannel } from "../core/types.js";
import type { CommandListItem, CommandSurface } from "../core/command-registry.js";
import { log } from "./app-logger.js";
import { getRecentErrors } from "../core/error-buffer.js";
import { getCommandDefinition } from "../core/command-catalog.js";
import { worldChatService, formatWorldChannelText } from "./world-chat-service.js";
import { stripAnsi, stripBlessedChrome } from "./strip-ansi.js";

function trimTrailingBlankLines(text: string): string {
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}$/g, "\n\n");
}

function isTinyScreenshot(text: string): boolean {
  const t = text.trim();
  return t.length <= 2;
}

function formatPrettyScreenshot(text: string, kind: "text" | "ansi"): string {
  const stamp = new Date().toISOString();
  const title = kind === "ansi" ? "WibWob Screenshot (ANSI)" : "WibWob Screenshot (text)";
  const body = trimTrailingBlankLines(text);
  const safeBody = body.length > 0 ? body : "(empty screenshot)";
  return [
    `╭─ ${title} ─ ${stamp} ─╮`,
    safeBody,
    "╰─ tip: use /state and /windows/text?id=N for semantic inspection ─╯",
  ].join("\n");
}
import { setActualControlApiPort } from "../runtime/runtime-node.js";
import type { RuntimeCommandService } from "../application/runtime-command-service.js";
import type { RuntimeInspectionService } from "../application/runtime-inspection-service.js";
import type { RuntimeWindowService } from "../application/runtime-window-service.js";
import type { RuntimeWorkspaceService } from "../application/runtime-workspace-service.js";
import type { RateLimitService } from "../application/rate-limit-service.js";
import type { InstanceDescriptor } from "../domain/instance-descriptor.js";

interface ControlApiDeps {
  commands: RuntimeCommandService;
  inspection: RuntimeInspectionService;
  windows: RuntimeWindowService;
  workspace: RuntimeWorkspaceService;
  stateService?: import("../services/state-service.js").StateService;
}

type RuntimeControlApiIdentity = Pick<
  InstanceDescriptor,
  | "instanceId"
  | "instanceDisplayId"
  | "instanceLabel"
  | "host"
  | "apiPort"
  | "scratchBase"
  | "dataRoot"
  | "instanceRoot"
  | "exportsDir"
  | "capturesDir"
  | "workspacesDir"
  | "statePath"
>;

// ---------------------------------------------------------------------------
// Endpoint catalogue — single source of truth for GET / and /openapi.json
// ---------------------------------------------------------------------------

const ENDPOINT_CATALOGUE = [
  { method: "GET",  path: "/",                              description: "Service info + endpoint list (this response)" },
  { method: "GET",  path: "/help",                          description: "Alias for /" },
  { method: "GET",  path: "/health",                        description: "Instance identity: id, label, pid, uptime, port, socketPath" },
  { method: "GET",  path: "/config",                        description: "Instance config: paths (scratch, captures, workspaces, state)" },
  { method: "GET",  path: "/openapi.json",                  description: "OpenAPI 3.0 spec" },
  { method: "GET",  path: "/docs",                          description: "Interactive API docs (Scalar)" },
  { method: "GET",  path: "/state",                         description: "Full live desktop + window state" },
  { method: "GET",  path: "/skin",                          description: "Effective TUI skin: borderStyle, borderChar, shadowEnabled" },
  { method: "POST", path: "/skin/set",                      body: { borderStyle: "'line'|'bg'|'none' (optional)", borderChar: "string (optional, used when borderStyle='bg')", shadowEnabled: "boolean (optional)" }, description: "Set TUI skin properties. Applies live to all open windows and persists to settings.json." },
  { method: "GET",  path: "/errors/recent",                  description: "Last 20 runtime errors from microapp lifecycle hooks (setup, onRestyle, onResize) with microappId, hook, message, stack, timestamp" },
  { method: "GET",  path: "/runtime/inspection",            description: "Structured runtime snapshot: desktop state, menu/overlay UI state, runtime stats, and Scramble inspection." },
  { method: "GET",  path: "/runtime/stats",                 description: "Shell-level runtime stats: render FPS, frame time, RAM, and agent activity" },
  { method: "GET",  path: "/commands/list",                 description: "All registered commands (optional ?surface=menu|palette|api|agent&includeUnavailable=1)" },
  { method: "GET",  path: "/content/primer-info",           description: "Primer content metadata. ?path=/abs/path.txt" },
  { method: "GET",  path: "/world-chat/state",              description: "Structured world chat snapshot outside the TUI" },
  { method: "GET",  path: "/world-chat/channels",           description: "List world chat channels outside the TUI" },
  { method: "GET",  path: "/world-chat/channel",            description: "Read one world chat channel. ?id=%23world-ridge-overlook" },
  { method: "GET",  path: "/world-chat/channel/text",       description: "Plain text export of one world chat channel. ?id=%23world-ridge-overlook" },
  { method: "GET",  path: "/windows/text",                  description: "Raw text content of a window. ?id=N or ?appType=wibwob.figlet (focused or last opened)." },
  { method: "GET",  path: "/screenshot",                    description: "Friendly screenshot alias. Defaults to clean text output." },
  { method: "GET",  path: "/screenshot/text",               description: "Clean readable text screenshot. ?id=N uses semantic captureText. Full screen strips ANSI + chrome." },
  { method: "GET",  path: "/screenshot/ansi",               description: "Raw ANSI text screenshot (blessed screen dump). ?id=N to crop to window rect." },
  { method: "POST", path: "/commands/run",                  body: { id: "string (command id, canonical)", args: "object (optional)" }, description: "Execute a command by id. Canonical command execution endpoint." },
  // ── View endpoints — convenience aliases for /commands/run ──
  // All dispatch through the command registry. Prefer /commands/run for new integrations.
  { method: "POST", path: "/view/primer/open",              body: { filePath: "string (absolute path)" }, description: "Open primer viewer. Alias: primer.open" },
  { method: "POST", path: "/view/figlet/open",              body: { text: "string", font: "string (optional)" }, description: "Open figlet banner. Alias: figlet.open" },
  { method: "GET",  path: "/view/figlet/fonts",             description: "List figlet fonts, default font, and metadata. Alias: figlet.fonts" },
  { method: "POST", path: "/view/figlet/open-default",      body: { text: "string (optional, default 'WIB WOB')", font: "string (optional, default catalogue favourite)" }, description: "Open figlet banner without interactive prompts." },
  { method: "POST", path: "/view/editor/open",              body: { filePath: "string (optional)", title: "string (optional)", initial: "string (optional)" }, description: "Open text editor. Alias: editor.open" },
  { method: "POST", path: "/view/backrooms/open",           body: { theme: "string", mode: "auto|live|fake-live", model: "haiku|sonnet|opus", turns: "number", primers: "string (optional csv)" }, description: "Start backrooms session. Alias: backrooms.open" },
  { method: "POST", path: "/view/reader/open",              body: { filePath: "string (absolute .md path)" }, description: "Open document reader. Alias: markdown.open" },
  { method: "POST", path: "/view/generative-art/open",      body: {}, description: "Open generative art. Alias: art.open" },
  { method: "POST", path: "/view/monster-cam/open",         body: {}, description: "Open Monster Cam. Alias: monster-cam.open" },
  { method: "POST", path: "/view/agent/open",               body: {}, description: "Open Wib&Wob Agent. Alias: agent.open" },
  { method: "POST", path: "/view/companion/open",           body: {}, description: "Open Scramble companion (floating). Alias: companion.open" },
  { method: "POST", path: "/view/companion/compact",        body: {}, description: "Open Scramble companion (popup). Alias: companion.smol" },
  // ── Scramble endpoints ──
  { method: "GET",  path: "/scramble/state",                description: "Scramble brain state: status, model, sessionId, messageCount, lastMessage, sleeping, logPath" },
  { method: "GET",  path: "/scramble/history",              description: "Full Scramble conversation history as JSON array" },
  { method: "POST", path: "/scramble/say",                  body: { text: "string" }, description: "Send a message to Scramble (returns reply)" },
  { method: "POST", path: "/scramble/expand",               body: {}, description: "Toggle Scramble smol/tall" },
  { method: "POST", path: "/scramble/pop-out",              body: {}, description: "Pop Scramble out to floating window" },
  { method: "POST", path: "/scramble/pet",                  body: {}, description: "Pet Scramble" },
  { method: "POST", path: "/scramble/sleep",                body: {}, description: "Put Scramble to sleep" },
  { method: "POST", path: "/scramble/wake",                 body: {}, description: "Wake Scramble up" },
  { method: "POST", path: "/scramble/meow",                 body: {}, description: "Make Scramble meow" },
  // ── More view aliases ──
  { method: "POST", path: "/view/music-player/open",        body: { filePath: "string (optional)" }, description: "Open music player. Alias: music-player.open" },
  { method: "POST", path: "/view/primer-browser/open",      body: {}, description: "Open primer browser. Alias: primer.browse" },
  { method: "POST", path: "/view/file-manager/open",        body: {}, description: "Open file manager. Alias: finder.open" },
  { method: "POST", path: "/view/primer-gallery/open",      body: {}, description: "Open primer gallery. Alias: primer-gallery.open" },
  { method: "POST", path: "/view/workspace/open",           body: {}, description: "Open workspace manager. Alias: workspace.manage" },
  { method: "POST", path: "/view/palette/open",             body: {}, description: "Open command palette. Alias: palette.open" },
  { method: "POST", path: "/view/inspector/open",           body: {}, description: "Open state inspector. Alias: inspector.open" },
  { method: "GET",  path: "/view/zine/canvases",            description: "List selectable Zine canvases. Alias: microapp.wibwob.zine.list-canvases" },
  { method: "POST", path: "/view/zine/open",                body: { filePath: "string (optional)", index: "number (optional, from /view/zine/canvases)" }, description: "Open Zine canvas without interactive picker." },
  // ── Browser endpoints ──
  { method: "POST", path: "/browser/navigate",              body: { url: "string (required)" }, description: "Navigate a Chrome browser window to a URL. Uses the focused browser or first found." },
  { method: "GET",  path: "/browser/state",                 description: "Chrome browser state: currentUrl, currentTitle, historyLength, loading." },
  // ── Window operations ──
  { method: "POST", path: "/windows/focus",                 body: { id: "number" }, description: "Focus a window by id" },
  { method: "POST", path: "/windows/click",                 body: { id: "number", label: "string" }, description: "Click a named element in a window. Returns { ok, label, row, col } or { ok: false, error, available }." },
  { method: "GET",  path: "/windows/clickables",            description: "List clickable elements for a window. ?id=N" },
  { method: "POST", path: "/windows/move",                  body: { id: "number", left: "number", top: "number" }, description: "Move a window to absolute coordinates" },
  { method: "POST", path: "/windows/resize",                body: { id: "number", width: "number", height: "number" }, description: "Resize a window" },
  { method: "POST", path: "/windows/close",                 body: { id: "number" }, description: "Close a window by id" },
  { method: "POST", path: "/windows/maximize",              body: { id: "number" }, description: "Toggle maximize for a window" },
  { method: "POST", path: "/windows/batch",                 body: { ops: "[{id, left?, top?, width?, height?, close?}]" }, description: "Move/resize/close multiple windows in one request. Applied in order." },
  { method: "POST", path: "/windows/input",                 body: { id: "number", input: "string (trailing \\r submits)" }, description: "Send text input to a window" },
  { method: "POST", path: "/windows/agent-message",         body: { id: "number", text: "string", sender: "string (optional — shows as sender label)" }, description: "Send a message to the Wib&Wob Agent window" },
  { method: "POST", path: "/windows/text/export",           body: { id: "number", name: "string (optional)" }, description: "Export window text content to scratch/captures/" },
  { method: "POST", path: "/windows/editor/write",          body: { id: "number", content: "string" }, description: "Write content to an editor window buffer" },
  // ── Overlay control ──
  // ── Menu inspection ──
  { method: "GET",  path: "/menu/list",                     description: "List all menus with items, col positions, and row indices for click targeting." },
  // ── Overlay control ──
  { method: "GET",  path: "/events",                        description: "SSE stream of runtime events (window-opened, window-closed, command-completed, command-failed). ?type= filter. ?window=N filter." },
  { method: "GET",  path: "/overlay/info",                  description: "Check if a modal overlay is active. Returns { active, type?, selectedIndex?, count? }." },
  { method: "POST", path: "/overlay/confirm",               body: {}, description: "Confirm the active modal overlay (OK/Enter). Returns ok:false if no overlay." },
  { method: "POST", path: "/overlay/cancel",                body: {}, description: "Cancel the active modal overlay (Cancel/Escape). Returns ok:false if no overlay." },
  { method: "POST", path: "/overlay/select",                body: { index: "number (required)" }, description: "Select item index in active overlay when supported (browser/list/file-browser)." },
  { method: "POST", path: "/overlay/set-text",              body: { text: "string (required)" }, description: "Set the text value in the active value/path overlay input. Use text=\"\" to clear." },
  // ── Workspace persistence ──
  { method: "POST", path: "/workspace/save",                body: { name: "string" }, description: "Save current workspace layout" },
  { method: "POST", path: "/workspace/load",                body: { name: "string" }, description: "Load a named workspace layout" },
];

function buildOpenApiSpec(port: number) {
  const paths: Record<string, unknown> = {};
  for (const ep of ENDPOINT_CATALOGUE) {
    const key = ep.path;
    const method = ep.method.toLowerCase();
    if (!paths[key]) paths[key] = {};
    const op: Record<string, unknown> = {
      summary: ep.description,
      responses: { "200": { description: "OK" } },
    };
    if (method === "post" && "body" in ep && Object.keys(ep.body as object).length > 0) {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ep.body as Record<string, string>)) {
        props[k] = { type: "string", description: v };
      }
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: props } } },
      };
    }
    (paths[key] as Record<string, unknown>)[method] = op;
  }
  return {
    openapi: "3.0.0",
    info: { title: "WibWob-DOS Control API", version: "1.0.0", description: "Local HTTP control surface for the WibWob-DOS TUI" },
    servers: [{ url: `http://127.0.0.1:${port}` }],
    paths,
  };
}

// ---------------------------------------------------------------------------

export class ControlApiService {
  /** Wire StateService after construction to avoid circular dep. */
  setStateService(s: import("../services/state-service.js").StateService): void {
    (this.deps as { stateService: unknown }).stateService = s;
  }
  private server?: { stop: (closeActiveConnections?: boolean) => void };
  private socketServer?: { stop: (closeActiveConnections?: boolean) => void };
  private actualPort?: number;
  private socketPath?: string;
  private pidPath?: string;
  private discoveryPath?: string;
  private runtimeManifestPath?: string;
  private readonly startedAt = Date.now();
  private enabled = false;
  private getScreenSize?: () => { width: number; height: number };

  constructor(
    private readonly port: number,
    private readonly deps: ControlApiDeps,
    private readonly identity: RuntimeControlApiIdentity,
    private readonly rateLimiter?: RateLimitService,
  ) {}

  /** Inject screen size getter (set by app-controller after construction). */
  setScreenSizeGetter(fn: () => { width: number; height: number }): void {
    this.getScreenSize = fn;
  }

  /** Whether a socket is currently registered for discovery. */
  hasSocket(): boolean {
    return this.socketPath != null;
  }

  private writeRuntimeControlManifest(socketPath: string): void {
    if (!this.identity.dataRoot) return;
    const manifestPath = path.join(this.identity.dataRoot, "runtime", "control-manifest.json");
    this.runtimeManifestPath = manifestPath;
    safeWriteFile(
      manifestPath,
      `${JSON.stringify({
        instanceId: this.identity.instanceId,
        instanceDisplayId: this.identity.instanceDisplayId,
        instanceLabel: this.identity.instanceLabel ?? null,
        pid: process.pid,
        host: this.identity.host,
        apiPort: this.actualPort ?? this.port,
        socketPath,
        instanceRoot: this.identity.instanceRoot,
        dataRoot: this.identity.dataRoot,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
    );
  }

  private cleanupRuntimeControlManifest(): void {
    const manifestPath = this.runtimeManifestPath;
    if (!manifestPath) return;
    try {
      const current = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { instanceId?: string; pid?: number };
      const sameProcess = current?.pid === process.pid;
      const sameInstance = current?.instanceId === this.identity.instanceId;
      if (sameProcess || sameInstance) {
        try { fs.unlinkSync(manifestPath); } catch {}
      }
    } catch {
      // Ignore parse/read errors on cleanup.
    }
  }

  /** Start HTTP server + unix socket (normal startup). */
  start(): void {
    this.startHttpOnly();
    if (!this.enabled) return;
    // ── Unix socket listener (local discovery + targeting) ──
    this.registerSocket();
  }

  /** Start HTTP server only, skip socket registration (for headless/undersized screens). */
  startHttpOnly(): void {
    const bunRuntime = (
      globalThis as {
        Bun?: {
          serve: (options: {
            hostname?: string;
            port?: number;
            unix?: string;
            fetch: (request: Request) => Promise<Response> | Response;
          }) => { stop: (closeActiveConnections?: boolean) => void };
        };
      }
    ).Bun;
    if (!bunRuntime) {
      this.enabled = false;
      this.actualPort = undefined;
      return;
    }

    // ── HTTP listener (port) ──
    const ports = [
      this.port,
      this.port + 1,
      this.port + 2,
      this.port + 3,
      this.port + 4,
    ];
    for (const port of ports) {
      try {
        this.server = bunRuntime.serve({
          hostname: this.identity.host,
          port,
          fetch: async (request) => this.handleWithIngressLimit(request),
        });
        this.actualPort = port;
        this.enabled = true;
        setActualControlApiPort(port);
        log.app(`control API listening on port ${port}`);
        process.stderr.write(`⚡ port=${port}  instance=${this.identity.instanceDisplayId}  label=${this.identity.instanceLabel ?? "(none)"}\n`);
        break;
      } catch {
        continue;
      }
    }

    if (!this.enabled) {
      this.server = undefined;
      this.actualPort = undefined;
      return;
    }

    // ── Clean shutdown: delete socket + PID sidecar ──
    const cleanup = () => {
      for (const fp of [
        this.socketPath,
        this.pidPath,
        this.discoveryPath,
      ]) {
        if (!fp) continue;
        try { fs.unlinkSync(fp); } catch {}
      }
      this.cleanupRuntimeControlManifest();
    };
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
    process.on("exit", cleanup);
  }

  /** Register unix socket + PID sidecar for CLI discovery. */
  registerSocket(): void {
    if (this.socketServer) return; // already registered
    if (!this.identity.instanceRoot) return;
    const bunRuntime = (globalThis as any).Bun;
    if (!bunRuntime) return;

    const instanceRoot = this.identity.instanceRoot;
    const canonicalSockPath = path.join(instanceRoot, "control.sock");
    const canonicalPidPath = path.join(instanceRoot, "control.pid");
    const discoveryPath = path.join(instanceRoot, "discovery.json");

    try {
      fs.mkdirSync(instanceRoot, { recursive: true });

      // Clean stale canonical socket from previous run
      try { fs.unlinkSync(canonicalSockPath); } catch {}

      this.socketServer = bunRuntime.serve({
        unix: canonicalSockPath,
        fetch: async (request: Request) => this.handleWithIngressLimit(request),
      });

      this.socketPath = canonicalSockPath;
      this.pidPath = canonicalPidPath;
      this.discoveryPath = discoveryPath;

      fs.writeFileSync(canonicalPidPath, String(process.pid));
      safeWriteFile(
        discoveryPath,
        `${JSON.stringify({
          instanceId: this.identity.instanceId,
          instanceDisplayId: this.identity.instanceDisplayId,
          instanceLabel: this.identity.instanceLabel ?? null,
          socketPath: canonicalSockPath,
          pid: process.pid,
          port: this.actualPort,
          updatedAt: new Date().toISOString(),
        }, null, 2)}\n`,
      );

      this.writeRuntimeControlManifest(canonicalSockPath);
      log.app(`control API socket at ${canonicalSockPath} (pid ${process.pid})`);
    } catch (err) {
      log.err(`control API socket failed: ${err}`);
      // HTTP still works — socket is best-effort
    }
  }

  /** Deregister socket + PID sidecar (e.g. screen resize below threshold). */
  deregisterSocket(): void {
    if (this.socketServer) {
      this.socketServer.stop(true);
      this.socketServer = undefined;
    }
    for (const fp of [
      this.socketPath,
      this.pidPath,
      this.discoveryPath,
    ]) {
      if (!fp) continue;
      try { fs.unlinkSync(fp); } catch {}
    }
    this.socketPath = undefined;
    this.pidPath = undefined;
    this.discoveryPath = undefined;
    this.cleanupRuntimeControlManifest();
    log.app("control API socket deregistered");
  }

  stop(): void {
    this.server?.stop(true);
    this.server = undefined;
    this.deregisterSocket();
    this.actualPort = undefined;
    this.enabled = false;
  }

  getStatus(): { enabled: boolean; port?: number; host?: string; baseUrl?: string; socketPath?: string } {
    const host = this.identity.host;
    const baseUrl = this.enabled && this.actualPort ? `http://${host}:${this.actualPort}` : undefined;
    return {
      enabled: this.enabled,
      port: this.actualPort,
      host: this.enabled ? host : undefined,
      baseUrl,
      socketPath: this.socketPath,
    };
  }

  private async handleWithIngressLimit(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const decision = this.rateLimiter?.ingress(request.method, pathname);
    if (decision && !decision.allowed) {
      const retrySeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      return new Response(
        JSON.stringify({
          ok: false,
          error: "rate_limited",
          retryAfterMs: decision.retryAfterMs,
          surface: "api",
          path: pathname,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(retrySeconds),
          },
        },
      );
    }

    try {
      return await this.handleRequest(request);
    } finally {
      decision?.lease?.release();
    }
  }

  private runApiCommand(id: string, args?: Record<string, unknown>) {
    return this.deps.commands.run(id, args, {
      source: "api",
      interactive: false,
    });
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/help")) {
      return Response.json({
        ok: true,
        service: "wibwob-ts-tui-control-api",
        port: this.actualPort,
        requestedPort: this.identity.apiPort,
        host: this.identity.host,
        instanceLabel: this.identity.instanceLabel,
        instanceId: this.identity.instanceId,
        scratchBase: this.identity.scratchBase,
        capturesDir: this.identity.capturesDir,
        workspacesDir: this.identity.workspacesDir,
        statePath: this.identity.statePath,
        docs: "GET /openapi.json for full OpenAPI 3.0 spec",
        endpoints: ENDPOINT_CATALOGUE,
      });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return Response.json(buildOpenApiSpec(this.actualPort ?? this.port));
    }

    if (request.method === "GET" && url.pathname === "/docs") {
      const port = this.actualPort ?? this.port;
      return new Response(scalarDocsHtml(port), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const uptimeMs = Date.now() - this.startedAt;
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const h = Math.floor(uptimeSec / 3600);
      const m = Math.floor((uptimeSec % 3600) / 60);
      const uptime = h > 0 ? `${h}h ${m}m` : `${m}m`;
      const screen = this.getScreenSize?.() ?? null;
      return Response.json({
        ok: true,
        instanceId: this.identity.instanceId,
        instanceDisplayId: this.identity.instanceDisplayId,
        instanceLabel: this.identity.instanceLabel ?? null,
        pid: process.pid,
        startedAt: new Date(this.startedAt).toISOString(),
        uptime,
        port: this.actualPort,
        host: this.identity.host,
        socketPath: this.socketPath ?? null,
        dataRoot: this.identity.dataRoot,
        instanceRoot: this.identity.instanceRoot,
        screen: screen ? { width: screen.width, height: screen.height } : null,
        cwd: process.cwd(),
      });
    }

    if (request.method === "GET" && url.pathname === "/config") {
      return Response.json({
        instanceId: this.identity.instanceId,
        requestedPort: this.identity.apiPort,
        scratchBase: this.identity.scratchBase,
        dataRoot: this.identity.dataRoot,
        instanceRoot: this.identity.instanceRoot,
        exportsDir: this.identity.exportsDir,
        capturesDir: this.identity.capturesDir,
        workspacesDir: this.identity.workspacesDir,
        statePath: this.identity.statePath,
      });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      // Always rebuild state fresh — internal window state may have changed
      // without triggering a window-manager onChange (e.g. direct microapp commands).
      return Response.json(this.deps.inspection.syncState());
    }

    if (request.method === "GET" && url.pathname === "/skin") {
      const state = this.deps.inspection.syncState();
      return Response.json({ ok: true, skin: state.skin });
    }

    if (request.method === "POST" && url.pathname === "/skin/set") {
      const body = (await request.json()) as Record<string, unknown>;
      return Response.json(
        await this.deps.commands.run("skin.set", body)
      );
    }

    if (request.method === "GET" && url.pathname === "/errors/recent") {
      return Response.json({ ok: true, errors: getRecentErrors() });
    }

    if (request.method === "GET" && url.pathname === "/runtime/inspection") {
      return Response.json({ ok: true, snapshot: this.deps.inspection.getSnapshot() });
    }

    if (request.method === "GET" && url.pathname === "/runtime/stats") {
      return Response.json({ ok: true, stats: this.deps.inspection.getSnapshot().stats });
    }

    if (request.method === "GET" && url.pathname === "/scramble/state") {
      return Response.json(this.deps.inspection.getSnapshot().scramble);
    }

    if (request.method === "GET" && url.pathname === "/scramble/history") {
      return Response.json({ history: this.deps.inspection.getSnapshot().history });
    }
    // ── Browser endpoints ──
    if (request.method === "GET" && url.pathname === "/browser/state") {
      const state = this.deps.inspection.getSnapshot().state;
      const browserWin = state.windows.find(w => w.appType === "web-reader");
      if (!browserWin) return Response.json({ ok: false, error: "No browser window open" }, { status: 404 });
      return Response.json({ ok: true, ...browserWin });
    }

    if (request.method === "POST" && url.pathname === "/browser/navigate") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const targetUrl = body.url as string | undefined;
      if (!targetUrl) return Response.json({ ok: false, error: "url is required" }, { status: 400 });
      const state = this.deps.inspection.getSnapshot().state;
      const browserWin = state.windows.find(w => w.appType === "web-reader");
      if (!browserWin) return Response.json({ ok: false, error: "No browser window open" }, { status: 404 });
      const sent = this.deps.windows.sendInput(browserWin.id, targetUrl);
      return Response.json({ ok: sent, windowId: browserWin.id, url: targetUrl });
    }

    if (request.method === "GET" && url.pathname === "/commands/list") {
      const surface = url.searchParams.get("surface") as CommandSurface | null;
      const tierFilter = url.searchParams.get("tier");
      const includeUnavailableRaw = url.searchParams.get("includeUnavailable");
      const includeUnavailable =
        includeUnavailableRaw === "1" ||
        includeUnavailableRaw === "true" ||
        includeUnavailableRaw === "yes";
      let commands = this.deps.commands.list(surface ?? undefined, {
        includeUnavailable,
      });
      if (tierFilter) {
        const tiers = new Set(tierFilter.split(","));
        commands = commands.filter((cmd) => {
          const tier = (cmd as CommandListItem & { tier?: string }).tier;
          return tiers.has(tier ?? "builtin");
        });
      }
      return Response.json({
        ok: true,
        commands,
      });
    }

    if (request.method === "GET" && url.pathname === "/content/primer-info") {
      const pathOrName =
        url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
      return Response.json(this.deps.inspection.getPrimerInfo(pathOrName));
    }
    if (request.method === "GET" && url.pathname === "/world-chat/state") {
      return Response.json({
        ok: true,
        ...worldChatService.snapshot(),
      });
    }
    if (request.method === "GET" && url.pathname === "/world-chat/channels") {
      return Response.json({
        ok: true,
        worldKey: worldChatService.getCurrentWorldKey(),
        transport: worldChatService.getTransportStatus(),
        channels: worldChatService.listChannels(),
      });
    }
    if (request.method === "GET" && url.pathname === "/world-chat/channel") {
      const channelId = url.searchParams.get("id") ?? "";
      const channel = channelId ? worldChatService.readChannel(channelId) : undefined;
      if (!channel) {
        return Response.json({ ok: false, error: "channel not found" }, { status: 404 });
      }
      return Response.json({ ok: true, channel });
    }
    if (request.method === "GET" && url.pathname === "/world-chat/channel/text") {
      const channelId = url.searchParams.get("id") ?? "";
      const channel = channelId ? worldChatService.readChannel(channelId) : undefined;
      if (!channel) {
        return new Response("channel not found\n", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return new Response(`${formatWorldChannelText(channel)}\n`, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    // ── /screenshot — friendly alias to /screenshot/text ──────────────────
    if (request.method === "GET" && url.pathname === "/screenshot") {
      const next = new URL(request.url);
      next.pathname = "/screenshot/text";
      return this.handleRequest(new Request(next.toString(), request));
    }

    // ── /screenshot/text — clean readable text (default) ──────────────────
    if (request.method === "GET" && url.pathname === "/screenshot/text") {
      const rawId = url.searchParams.get("id");
      const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

      if (rawId !== null) {
        // Per-window: prefer semantic captureText(), fall back to stripped crop
        const id = Number(rawId);
        const semantic = this.deps.windows.captureText(id);
        if (semantic !== undefined) {
          // captureText may include ANSI styling (e.g. syntax-highlighted editor content)
          const cleaned = trimTrailingBlankLines(stripAnsi(semantic));
          return new Response(cleaned, { headers: TEXT_HEADERS });
        }
        // Fallback: crop from blessed screen dump + strip
        const raw = this.deps.inspection.screenshotText();
        const win = this.deps.windows.getWindowById(id);
        if (win) {
          const x = Number(win.frame.left);
          const y = Number(win.frame.top);
          const w = Number(win.frame.width);
          const h = Number(win.frame.height);
          const lines = raw.split("\n");
          const cropped = lines.slice(y, y + h).map((line: string) => {
            return stripBlessedChrome(line).slice(x, x + w);
          });
          return new Response(trimTrailingBlankLines(cropped.join("\n")), { headers: TEXT_HEADERS });
        }
        return new Response("window not found", { status: 404, headers: TEXT_HEADERS });
      }
      // Full screen: strip everything + add friendly framing on tiny/empty outputs
      const raw = stripBlessedChrome(this.deps.inspection.screenshotText());
      const text = trimTrailingBlankLines(raw);
      const pretty = isTinyScreenshot(text) ? formatPrettyScreenshot(text, "text") : text;
      return new Response(pretty, { headers: TEXT_HEADERS });
    }

    // ── /screenshot/ansi — raw blessed dump (preserves escapes) ─────────
    if (request.method === "GET" && url.pathname === "/screenshot/ansi") {
      const rawId = url.searchParams.get("id");
      let text = this.deps.inspection.screenshotText();
      const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

      if (rawId !== null) {
        const id = Number(rawId);
        const win = this.deps.windows.getWindowById(id);
        if (win) {
          const x = Number(win.frame.left);
          const y = Number(win.frame.top);
          const w = Number(win.frame.width);
          const h = Number(win.frame.height);
          const lines = text.split("\n");
          // Strip ANSI only for slicing accuracy, but return raw lines
          const cropped = lines.slice(y, y + h).map((line: string) => {
            // We need char-accurate slicing so strip for measurement,
            // but return the raw line segment. This is inherently imperfect
            // with ANSI — return the raw line for now.
            return line;
          });
          text = cropped.join("\n");
        }
      }
      const out = rawId === null && isTinyScreenshot(stripAnsi(text))
        ? formatPrettyScreenshot(text, "ansi")
        : text;
      return new Response(out, { headers: TEXT_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/windows/text") {
      let id = Number(url.searchParams.get("id"));
      const appType = url.searchParams.get("appType");
      if (!id && appType) {
        // Use cached state snapshot rather than calling describeState() live
        const stateWins = this.deps.stateService?.getState()?.windows ?? [];
        const wins = stateWins.filter(w => w.appType === appType)
          .map(sw => this.deps.windows.getWindowById(sw.id))
          .filter((w): w is NonNullable<typeof w> => w !== undefined);
        // prefer focused window, else last opened (highest id)
        const focusedId = this.deps.stateService?.getState()?.focus?.windowId;
        const win = wins.find(w => w.id === focusedId) ?? wins.at(-1);
        if (!win) return Response.json({ ok: false, error: `No window with appType: ${appType}` }, { status: 404 });
        id = win.id;
      }
      const text = this.deps.windows.captureText(id);
      return Response.json({ ok: text !== undefined, text: text ?? null });
    }

    const body =
      request.method === "POST" ? await request.json().catch(() => ({})) : {};

    if (request.method === "POST") {
      log.api(`POST ${url.pathname}`);
    }

    if (request.method === "POST" && url.pathname === "/commands/run") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        return Response.json({ ok: false, error: "id required" }, { status: 400 });
      }
      const rawArgs = typeof body.args === "object" && body.args !== null
        ? body.args as Record<string, unknown>
        : undefined;
      // Validate args against Zod schema if the command defines one
      let args = rawArgs;
      const cmdDef = getCommandDefinition(id);
      if (cmdDef?.params && rawArgs) {
        const result = cmdDef.params.safeParse(rawArgs);
        if (!result.success) {
          return Response.json({
            ok: false,
            error: "Invalid arguments",
            details: result.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
              ...("expected" in i ? { expected: i.expected } : {}),
              ...("received" in i ? { received: i.received } : {}),
            })),
          }, { status: 400 });
        }
        args = result.data as Record<string, unknown>;
      }
      try {
        const errorsBefore = getRecentErrors().length;
        const result = this.runApiCommand(id, args);
        // S01: surface synchronous setup errors in the response
        // microapp.wibwob.figlet.open → "wibwob.figlet" (strip microapp. prefix and .verb suffix)
        const microappId = id.startsWith("microapp.") && id.split(".").length >= 4
          ? id.split(".").slice(1, -1).join(".")
          : undefined;
        const newErrors = getRecentErrors()
          .slice(errorsBefore)
          .filter(e => !microappId || !e.microappId || e.microappId === microappId);
        const response = newErrors.length > 0 ? { ...result, errors: newErrors } : result;
        // S06: emit command-completed event
        const windowId = typeof (result as Record<string, unknown>)?.windowId === "number"
          ? (result as Record<string, unknown>).windowId as number : undefined;
        this.deps.stateService?.emitEvent({ type: "command-completed", commandId: id, windowId });
        return Response.json(response, { status: result.ok ? 200 : 404 });
      } catch (err: unknown) {
        this.deps.stateService?.emitEvent({ type: "command-failed", commandId: id, error: err instanceof Error ? err.message : String(err) });
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname === "/view/figlet/fonts") {
      const result = this.runApiCommand("figlet.fonts");
      return Response.json(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "POST" && url.pathname === "/view/figlet/open-default") {
      const text = typeof body.text === "string" && body.text.trim()
        ? body.text.trim()
        : "WIB WOB";
      const font = typeof body.font === "string" && body.font.trim()
        ? body.font.trim()
        : undefined;
      const result = this.runApiCommand(
        "figlet.open",
        font ? { text, font } : { text },
      );
      return Response.json(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "GET" && url.pathname === "/view/zine/canvases") {
      const result = this.runApiCommand("microapp.wibwob.zine.list-canvases");
      return Response.json(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "POST" && url.pathname === "/view/zine/open") {
      const filePath = typeof body.filePath === "string" && body.filePath.trim()
        ? body.filePath.trim()
        : undefined;
      let args: Record<string, unknown> | undefined;
      if (filePath) {
        args = { filePath };
      } else if (typeof body.index === "number") {
        const listed = this.runApiCommand("microapp.wibwob.zine.list-canvases");
        if (!listed.ok) {
          return Response.json(listed, { status: 404 });
        }
        const listResult = listed.result as { files?: { index?: number; filePath?: string }[] } | undefined;
        const files = listResult?.files;
        const picked = Array.isArray(files) ? files.find((f) => Number(f?.index) === Number(body.index)) : undefined;
        if (!picked?.filePath) {
          return Response.json({ ok: false, error: "Invalid zine canvas index" }, { status: 400 });
        }
        args = { filePath: picked.filePath };
      } else {
        return Response.json({ ok: false, error: "filePath or index required" }, { status: 400 });
      }
      const result = this.runApiCommand("microapp.wibwob.zine.open", args);
      return Response.json(result, { status: result.ok ? 200 : 404 });
    }

    // ── View endpoints — all dispatch through command registry ──
    // Routes kept for backward compat; each is a thin shim over /commands/run.
    const viewRoutes: Record<string, { id: string; argsMapper?: (b: Record<string, unknown>) => Record<string, unknown> | undefined }> = {
      "/view/primer-browser/open":  { id: "primer.browse" },
      "/view/file-manager/open":    { id: "finder.open" },
      "/view/primer-gallery/open":  { id: "primer-gallery.open" },
      "/view/primer/open":          { id: "primer.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath, x: b.x, y: b.y, w: b.w, h: b.h } : undefined },
      "/view/reader/open":          { id: "markdown.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath } : undefined },
      "/view/figlet/open":          { id: "figlet.open", argsMapper: (b) => b.text ? { text: b.text, font: b.font } : undefined },
      "/view/generative-art/open":  { id: "art.open" },
      "/view/monster-cam/open":     { id: "monster-cam.open" },
      "/view/agent/open":           { id: "agent.open" },
      "/view/companion/open":       { id: "companion.open" },
      "/view/companion/compact":    { id: "companion.smol" },
      "/scramble/say":              { id: "scramble.say", argsMapper: (b) => b.text ? { text: b.text } : undefined },
      "/scramble/expand":           { id: "scramble.expand" },
      "/scramble/pop-out":          { id: "scramble.pop-out" },
      "/scramble/pet":              { id: "scramble.pet" },
      "/scramble/sleep":            { id: "scramble.sleep" },
      "/scramble/wake":             { id: "scramble.wake" },
      "/scramble/meow":             { id: "scramble.meow" },
      "/view/music-player/open":    { id: "music-player.open" },
      "/view/workspace/open":       { id: "workspace.manage" },
      "/view/palette/open":         { id: "palette.open" },
      "/view/inspector/open":       { id: "inspector.open" },
      "/view/editor/open":          { id: "editor.open", argsMapper: (b) => {
        const args: Record<string, unknown> = {};
        if (typeof b.filePath === "string") args.filePath = b.filePath;
        if (typeof b.title === "string") args.title = b.title;
        if (typeof b.initial === "string") args.initial = b.initial;
        return Object.keys(args).length ? args : undefined;
      }},
    };
    const viewRoute = request.method === "POST" ? viewRoutes[url.pathname] : undefined;
    if (viewRoute) {
      const args = viewRoute.argsMapper ? viewRoute.argsMapper(body) : undefined;
      // Validate required args (primer.open requires filePath)
      if (viewRoute.id === "primer.open" && !args?.filePath) {
        return Response.json({ ok: false, error: "filePath required" }, { status: 400 });
      }
      try {
        const result = this.runApiCommand(viewRoute.id, args);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      } catch (err: unknown) {
        return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }
    if (request.method === "POST" && url.pathname === "/windows/focus") {
      return Response.json({
        ok: this.deps.windows.focus(Number(body.id)),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/click") {
      const result = this.runApiCommand("window.click", { id: Number(body.id), label: body.label });
      return Response.json(result);
    }
    if (request.method === "GET" && url.pathname === "/windows/clickables") {
      const id = Number(url.searchParams.get("id"));
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: "id is required" }, { status: 400 });
      const clickables = this.deps.windows.getClickables(id);
      return Response.json({ ok: true, id, clickables });
    }
    if (request.method === "POST" && url.pathname === "/windows/move") {
      const b = body as Record<string, unknown>;
      if (!Number.isFinite(Number(b.left)) || !Number.isFinite(Number(b.top))) {
        return Response.json(
          { ok: false, error: "left and top are required numbers" },
          { status: 400 },
        );
      }
      return Response.json({
        ok: this.deps.windows.move(
          Number(b.id),
          Number(b.left),
          Number(b.top),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/resize") {
      const b = body as Record<string, unknown>;
      if (!Number.isFinite(Number(b.width)) || !Number.isFinite(Number(b.height))) {
        return Response.json(
          { ok: false, error: "width and height are required numbers" },
          { status: 400 },
        );
      }
      return Response.json({
        ok: this.deps.windows.resize(
          Number(b.id),
          Number(b.width),
          Number(b.height),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/close") {
      return Response.json({
        ok: this.deps.windows.close(Number(body.id)),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/maximize") {
      return Response.json({
        ok: this.deps.windows.toggleMaximize(Number(body.id)),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/batch") {
      // Body: { ops: Array<{ id, left?, top?, width?, height?, close? }> }
      // Each op can move, resize, or close a window. All applied in order.
      const ops = body.ops as Array<{
        id: number;
        left?: number; top?: number;
        width?: number; height?: number;
        close?: boolean;
      }>;
      if (!Array.isArray(ops)) {
        return Response.json({ ok: false, error: "ops must be an array" }, { status: 400 });
      }
      for (const [index, op] of ops.entries()) {
        const hasMove = op.left !== undefined || op.top !== undefined;
        const hasResize = op.width !== undefined || op.height !== undefined;
        if (op.close) {
          continue;
        }
        if (hasMove !== (op.left !== undefined && op.top !== undefined)) {
          return Response.json(
            { ok: false, error: `op ${index} requires canonical left and top fields` },
            { status: 400 },
          );
        }
        if (hasResize !== (op.width !== undefined && op.height !== undefined)) {
          return Response.json(
            { ok: false, error: `op ${index} requires canonical width and height fields` },
            { status: 400 },
          );
        }
        if (!hasMove && !hasResize) {
          return Response.json(
            { ok: false, error: `op ${index} must include canonical move/resize fields or close=true` },
            { status: 400 },
          );
        }
      }
      const results = this.deps.windows.batch(
        ops.map((op) => ({
          id: Number(op.id),
          left: op.left,
          top: op.top,
          width: op.width,
          height: op.height,
          close: op.close,
        })),
      );
      return Response.json({ ok: results.every(Boolean), results });
    }
    if (request.method === "POST" && url.pathname === "/windows/input") {
      return Response.json({
        ok: this.deps.windows.sendInput(
          Number(body.id),
          String(body.input ?? ""),
          body.sender ? String(body.sender) : undefined,
        ),
      });
    }
    // Dedicated endpoint for session-to-agent messages — always requires sender
    if (request.method === "POST" && url.pathname === "/windows/agent-message") {
      const sender = body.sender ? String(body.sender) : undefined;
      const text = String(body.text ?? body.input ?? "");
      const id = Number(body.id);
      return Response.json({
        ok: this.deps.windows.sendInput(id, text, sender),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/editor/write") {
      return Response.json({
        ok: this.deps.windows.writeEditorText(
          Number(body.id),
          String(body.text ?? ""),
        ),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/text/export") {
      const id = Number(body.id);
      const text = this.deps.windows.captureText(id);
      if (!text) return Response.json({ ok: false, path: null });
      // File export is a control-API concern, not a facade concern
      const capturesDir = this.identity.capturesDir
        ? path.resolve(this.identity.capturesDir)
        : path.join(process.cwd(), "scratch", "captures");
      fs.mkdirSync(capturesDir, { recursive: true });
      const name = typeof body.name === "string" ? body.name
        : typeof body.label === "string" ? body.label
        : `window-${id}`;
      const safeName = name.replace(/[^a-z0-9._-]+/gi, "-");
      const fileName = `${new Date().toISOString().replaceAll(":", "-")}_${safeName}.txt`;
      const filePath = path.join(capturesDir, fileName);
      safeWriteFile(filePath, `${text}\n`);
      return Response.json({ ok: true, path: filePath });
    }
    // ── Backrooms + workspace — also dispatch through command registry ──
    if (request.method === "POST" && url.pathname === "/view/backrooms/open") {
      const channel = normalizeBackroomsChannel(body);
      const result = this.runApiCommand(
        "backrooms.open",
        channel as unknown as Record<string, unknown>,
      );
      return Response.json({ ...result, channel }, { status: result.ok ? 200 : 404 });
    }
    // ── SSE event stream (S06) ──
    if (request.method === "GET" && url.pathname === "/events") {
      const typeFilter = url.searchParams.get("type");
      const windowFilter = url.searchParams.get("window") ? Number(url.searchParams.get("window")) : undefined;
      const stateService = this.deps.stateService;
      if (!stateService) return Response.json({ ok: false, error: "SSE not available" }, { status: 503 });
      let unsub: (() => void) | undefined;
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          unsub = stateService.subscribeEvents((event) => {
            if (typeFilter && event.type !== typeFilter) return;
            if (windowFilter && !("windowId" in event && event.windowId === windowFilter)) return;
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`));
          });
        },
        cancel() { unsub?.(); },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
    }

    // ── Menu inspection ──
    if (request.method === "GET" && url.pathname === "/menu/list") {
      const result = this.runApiCommand("menu.list");
      return Response.json(result);
    }
    // ── Overlay control ──
    if (request.method === "GET" && url.pathname === "/overlay/info") {
      const result = this.runApiCommand("overlay.info");
      return Response.json(result);
    }
    if (request.method === "POST" && url.pathname === "/overlay/confirm") {
      const result = this.runApiCommand("overlay.confirm");
      const inner = result.ok ? result.result as { confirmed?: boolean; error?: string } | undefined : undefined;
      if (inner && !inner.confirmed) {
        return Response.json({ ok: false, error: inner.error ?? "No active overlay" });
      }
      return Response.json(result);
    }
    if (request.method === "POST" && url.pathname === "/overlay/cancel") {
      const result = this.runApiCommand("overlay.cancel");
      const inner = result.ok ? result.result as { cancelled?: boolean; error?: string } | undefined : undefined;
      if (inner && !inner.cancelled) {
        return Response.json({ ok: false, error: inner.error ?? "No active overlay" });
      }
      return Response.json(result);
    }
    if (request.method === "POST" && url.pathname === "/overlay/select") {
      const index = Number(body.index);
      if (!Number.isFinite(index)) {
        return Response.json({ ok: false, error: "index is required and must be a number" }, { status: 400 });
      }
      const result = this.runApiCommand("overlay.select", { index });
      const inner = result.ok ? result.result as { selected?: boolean; error?: string } | undefined : undefined;
      if (inner && !inner.selected) {
        return Response.json({ ok: false, error: inner.error ?? "Overlay selection failed" });
      }
      return Response.json(result);
    }
    if (request.method === "POST" && url.pathname === "/overlay/set-text") {
      const text = body.text;
      if (typeof text !== "string") {
        return Response.json({ ok: false, error: "text (string) is required" }, { status: 400 });
      }
      const result = this.runApiCommand("overlay.set-text", { text });
      return Response.json(result);
    }
    if (request.method === "POST" && url.pathname === "/workspace/save") {
      const rawName = body.name;
      return Response.json(
        this.deps.workspace.save(typeof rawName === "string" ? rawName : undefined),
      );
    }
    if (request.method === "POST" && url.pathname === "/workspace/load") {
      const rawName = body.name;
      return Response.json(
        this.deps.workspace.load(typeof rawName === "string" ? rawName : undefined),
      );
    }

    return new Response("not found", { status: 404 });
  }
}

function normalizeBackroomsChannel(raw: unknown): BackroomsChannel {
  const body = (raw ?? {}) as Record<string, unknown>;
  const model =
    typeof body.model === "string" &&
    ["haiku", "sonnet", "opus"].includes(body.model)
      ? (body.model as BackroomsChannel["model"])
      : "sonnet";
  const mode =
    typeof body.mode === "string" &&
    ["auto", "live", "fake-live"].includes(body.mode)
      ? (body.mode as BackroomsChannel["mode"])
      : "auto";
  return {
    theme:
      typeof body.theme === "string" && body.theme.trim()
        ? body.theme.trim()
        : "liminal fluorescent maze",
    primers: typeof body.primers === "string" ? body.primers.trim() : "",
    turns: Math.max(1, Math.min(20, Number(body.turns) || 3)),
    model,
    mode,
  };
}

// ── Scalar API docs ───────────────────────────────────────────────────────

function scalarDocsHtml(port: number): string {
  const config = JSON.stringify({
    theme: "kepler",
    hideModels: true,
    defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  });
  return `<!doctype html>
<html>
<head>
  <title>WibWob-DOS API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .custom-header { background: #1a1a2e; color: #e0e0e0; padding: 12px 24px; font-size: 14px; }
    .custom-header code { background: #2a2a4e; padding: 2px 8px; border-radius: 3px; }
    .custom-header a { color: #7dc4e4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="custom-header">
    WibWob-DOS Control API &middot; <code>http://127.0.0.1:${port}</code>
    &middot; <a href="/openapi.json">OpenAPI spec</a>
    &middot; <a href="/health">Health</a>
    &middot; <a href="/help">Endpoints</a>
  </div>
  <script id="api-reference" data-url="/openapi.json" data-configuration='${config}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
