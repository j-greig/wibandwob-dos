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
import path from "node:path";
import type { BackroomsChannel, DesktopState } from "../core/types.js";
import type { CommandSurface, CommandListItem, CommandRunResult } from "../core/command-registry.js";
import { log } from "./app-logger.js";
import { worldChatService, formatWorldChannelText } from "./world-chat-service.js";

interface ControlApiHandlers {
  getState: () => DesktopState;
  /** Rebuild state from scratch (bypasses cache). */
  syncState: () => DesktopState;
  getPrimerInfo: (pathOrName: string) => unknown;
  listCommands: (
    surface?: CommandSurface,
    opts?: { includeUnavailable?: boolean },
  ) => CommandListItem[];
  runCommand: (id: string, args?: Record<string, unknown>) => CommandRunResult;
  windows: import("../core/window-facade.js").WindowFacade;
  /** Blessed screen.screenshot() — returns full TUI as ANSI text. */
  screenshotText: () => string;
  /** Scramble brain state snapshot for agents. */
  getScrambleState: () => {
    status: string;
    sleeping: boolean;
    model: string;
    sessionId: string;
    messageCount: number;
    lastMessage: string | null;
    logPath: string | null;
  };
  /** Scramble full conversation history. */
  getScrambleHistory: () => Array<{ role: string; content: string; timestamp: number }>;
}

interface ControlApiIdentity {
  instanceLabel?: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Endpoint catalogue — single source of truth for GET / and /openapi.json
// ---------------------------------------------------------------------------

const ENDPOINT_CATALOGUE = [
  { method: "GET",  path: "/",                              description: "Service info + endpoint list (this response)" },
  { method: "GET",  path: "/help",                          description: "Alias for /" },
  { method: "GET",  path: "/health",                        description: "Health check" },
  { method: "GET",  path: "/openapi.json",                  description: "OpenAPI 3.0 spec" },
  { method: "GET",  path: "/state",                         description: "Full live desktop + window state" },
  { method: "GET",  path: "/commands/list",                 description: "All registered commands (optional ?surface=menu|palette|api|agent&includeUnavailable=1)" },
  { method: "GET",  path: "/content/primer-info",           description: "Primer content metadata. ?path=/abs/path.txt" },
  { method: "GET",  path: "/world-chat/state",              description: "Structured world chat snapshot outside the TUI" },
  { method: "GET",  path: "/world-chat/channels",           description: "List world chat channels outside the TUI" },
  { method: "GET",  path: "/world-chat/channel",            description: "Read one world chat channel. ?id=%23world-ridge-overlook" },
  { method: "GET",  path: "/world-chat/channel/text",       description: "Plain text export of one world chat channel. ?id=%23world-ridge-overlook" },
  { method: "GET",  path: "/windows/text",                  description: "Raw text content of a window. ?id=N" },
  { method: "GET",  path: "/screenshot/text",               description: "ANSI-stripped text screenshot of a window. ?id=N" },
  { method: "POST", path: "/commands/run",                  body: { id: "string (command id, canonical)", command: "string (deprecated alias for id)", args: "object (optional)" } },
  // ── View endpoints — command aliases, kept for backward compat ──
  // All dispatch through /commands/run internally. Prefer /commands/run for new integrations.
  { method: "POST", path: "/view/primer/open",              body: { filePath: "string (absolute path)" }, description: "Alias: primer.open" },
  { method: "POST", path: "/view/figlet/open",              body: { text: "string", font: "string (optional)" }, description: "Alias: figlet.open" },
  { method: "POST", path: "/view/editor/open",              body: { filePath: "string (optional)", title: "string (optional)", initial: "string (optional)" }, description: "Alias: editor.open" },
  { method: "POST", path: "/view/backrooms/open",           body: { theme: "string", mode: "auto|live|fake-live", model: "haiku|sonnet|opus", turns: "number", primers: "string (optional csv)" }, description: "Alias: backrooms.run" },
  { method: "POST", path: "/view/browser-reader/open",      body: { filePath: "string (optional)" }, description: "Alias: document.open" },
  { method: "POST", path: "/view/markdown/open",            body: { filePath: "string (absolute .md path)" }, description: "Alias: markdown.open" },
  { method: "POST", path: "/view/art/open",                 body: {}, description: "Alias: art.open" },
  { method: "POST", path: "/view/monster-cam/open",         body: {}, description: "Alias: monster_cam.open" },
  { method: "POST", path: "/view/wibwob-agent/open",        body: {}, description: "Alias: agent.open" },
  { method: "POST", path: "/view/companion/open",           body: {}, description: "Alias: companion.open (floating)" },
  { method: "POST", path: "/view/companion/smol",           body: {}, description: "Alias: companion.smol (popup)" },
  { method: "GET",  path: "/scramble/state",                body: {}, description: "Scramble brain state: status, model, sessionId, messageCount, lastMessage, sleeping, logPath" },
  { method: "GET",  path: "/scramble/history",              body: {}, description: "Full Scramble conversation history as JSON array" },
  { method: "POST", path: "/scramble/say",                  body: { text: "string" }, description: "Send a message to Scramble (returns reply)" },
  { method: "POST", path: "/scramble/expand",               body: {}, description: "Toggle Scramble smol/tall" },
  { method: "POST", path: "/scramble/pop-out",              body: {}, description: "Pop Scramble out to floating window" },
  { method: "POST", path: "/scramble/pet",                  body: {}, description: "Pet Scramble" },
  { method: "POST", path: "/scramble/sleep",                body: {}, description: "Put Scramble to sleep" },
  { method: "POST", path: "/scramble/wake",                 body: {}, description: "Wake Scramble up" },
  { method: "POST", path: "/scramble/meow",                 body: {}, description: "Make Scramble meow" },
  { method: "POST", path: "/view/music-player/open",        body: { filePath: "string (optional)" }, description: "Alias: music-player.open" },
  { method: "POST", path: "/view/primer-browser/open",      body: {}, description: "Alias: primer.browse" },
  { method: "POST", path: "/view/file-manager/open",        body: {}, description: "Alias: finder.open" },
  { method: "POST", path: "/view/primer-gallery/open",      body: {}, description: "Alias: primer_gallery.open" },
  { method: "POST", path: "/view/workspace/open",           body: {}, description: "Alias: workspace.manage" },
  { method: "POST", path: "/view/palette/open",             body: {}, description: "Alias: palette.open" },
  { method: "POST", path: "/view/inspector/open",           body: {}, description: "Alias: inspector.open" },
  { method: "POST", path: "/windows/focus",                 body: { id: "number" } },
  { method: "POST", path: "/windows/move",                  body: { id: "number", left: "number", top: "number" } },
  { method: "POST", path: "/windows/resize",                body: { id: "number", width: "number", height: "number" } },
  { method: "POST", path: "/windows/close",                 body: { id: "number" } },
  { method: "POST", path: "/windows/maximize",              body: { id: "number" } },
  { method: "POST", path: "/windows/batch",                 body: { ops: "[{id, x?, y?, w?, h?, close?}]" }, description: "Move/resize/close multiple windows in one request. Applied in order. Returns {ok, results[]}" },
  { method: "POST", path: "/windows/input",                 body: { id: "number", input: "string (trailing \\r submits)" } },
  { method: "POST", path: "/windows/agent-message",         body: { id: "number", text: "string", sender: "string (optional — shows as sender label in agent window)" } },
  { method: "POST", path: "/windows/text/export",           body: { id: "number", name: "string (optional, canonical)", label: "string (optional, alias for name)" } },
  { method: "POST", path: "/workspace/save",                body: { name: "string" }, description: "Alias: workspace.save" },
  { method: "POST", path: "/workspace/load",                body: { name: "string" }, description: "Alias: workspace.load_named" },
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
  private server?: { stop: (closeActiveConnections?: boolean) => void };
  private actualPort?: number;
  private enabled = false;

  constructor(
    private readonly port: number,
    private readonly handlers: ControlApiHandlers,
    private readonly identity: ControlApiIdentity,
  ) {}

  start(): void {
    const bunRuntime = (
      globalThis as {
        Bun?: {
          serve: (options: {
            hostname?: string;
            port: number;
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
          hostname: "127.0.0.1",
          port,
          fetch: async (request) => this.handleRequest(request),
        });
        this.actualPort = port;
        this.enabled = true;
        log.app(`control API listening on port ${port}`);
        return;
      } catch {
        continue;
      }
    }
    this.server = undefined;
    this.actualPort = undefined;
    this.enabled = false;
  }

  stop(): void {
    this.server?.stop(true);
    this.server = undefined;
    this.actualPort = undefined;
    this.enabled = false;
  }

  getStatus(): { enabled: boolean; port?: number } {
    return {
      enabled: this.enabled,
      port: this.actualPort,
    };
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/help")) {
      return Response.json({
        ok: true,
        service: "wibwob-ts-tui-control-api",
        port: this.actualPort,
        instanceLabel: this.identity.instanceLabel,
        sessionId: this.identity.sessionId,
        docs: "GET /openapi.json for full OpenAPI 3.0 spec",
        endpoints: ENDPOINT_CATALOGUE,
      });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return Response.json(buildOpenApiSpec(this.actualPort ?? this.port));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        port: this.actualPort,
        instanceLabel: this.identity.instanceLabel,
        sessionId: this.identity.sessionId,
      });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      // Always rebuild state fresh — internal window state may have changed
      // without triggering a window-manager onChange (e.g. direct microapp commands).
      return Response.json(this.handlers.syncState());
    }

    if (request.method === "GET" && url.pathname === "/scramble/state") {
      return Response.json(this.handlers.getScrambleState());
    }

    if (request.method === "GET" && url.pathname === "/scramble/history") {
      return Response.json({ history: this.handlers.getScrambleHistory() });
    }
    if (request.method === "GET" && url.pathname === "/commands/list") {
      const surface = url.searchParams.get("surface") as CommandSurface | null;
      const includeUnavailableRaw = url.searchParams.get("includeUnavailable");
      const includeUnavailable =
        includeUnavailableRaw === "1" ||
        includeUnavailableRaw === "true" ||
        includeUnavailableRaw === "yes";
      return Response.json({
        ok: true,
        commands: this.handlers.listCommands(surface ?? undefined, {
          includeUnavailable,
        }),
      });
    }

    if (request.method === "GET" && url.pathname === "/content/primer-info") {
      const pathOrName =
        url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
      return Response.json(this.handlers.getPrimerInfo(pathOrName));
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
    if (request.method === "GET" && url.pathname === "/screenshot/text") {
      const rawId = url.searchParams.get("id");
      let text = this.handlers.screenshotText();
      if (rawId !== null) {
        const id = Number(rawId);
        const win = this.handlers.windows.getWindowById(id);
        if (win) {
          const x = Number(win.frame.left);
          const y = Number(win.frame.top);
          const w = Number(win.frame.width);
          const h = Number(win.frame.height);
          // Strip ANSI, crop to window rect
          const lines = text.split("\n");
          const cropped = lines.slice(y, y + h).map(line => {
            const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
            return stripped.slice(x, x + w);
          });
          text = cropped.join("\n");
        }
      }
      return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (request.method === "GET" && url.pathname === "/windows/text") {
      const id = Number(url.searchParams.get("id"));
      const text = this.handlers.windows.captureText(id);
      return Response.json({ ok: text !== undefined, text: text ?? null });
    }

    const body =
      request.method === "POST" ? await request.json().catch(() => ({})) : {};

    if (request.method === "POST") {
      log.api(`POST ${url.pathname}`);
    }

    if (request.method === "POST" && url.pathname === "/commands/run") {
      const id = typeof (body as any).id === "string" ? (body as any).id
        : typeof (body as any).command === "string" ? (body as any).command
        : "";
      if (!id) {
        return Response.json({ ok: false, error: "id required (also accepts 'command' as deprecated alias)" }, { status: 400 });
      }
      const args = typeof (body as any).args === "object" && (body as any).args !== null
        ? (body as any).args as Record<string, unknown>
        : undefined;
      try {
        const result = this.handlers.runCommand(id, args);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      } catch (err: any) {
        return Response.json({ ok: false, error: err?.message ?? String(err), stack: err?.stack }, { status: 500 });
      }
    }

    // ── View endpoints — all dispatch through command registry ──
    // Routes kept for backward compat; each is a thin shim over /commands/run.
    const viewRoutes: Record<string, { id: string; argsMapper?: (b: any) => Record<string, unknown> | undefined }> = {
      "/view/primer-browser/open":  { id: "primer.browse" },
      "/view/file-manager/open":    { id: "finder.open" },
      "/view/primer-gallery/open":  { id: "primer_gallery.open" },
      "/view/primer/open":          { id: "primer.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath, x: b.x, y: b.y, w: b.w, h: b.h } : undefined },
      "/view/browser-reader/open":  { id: "document.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath } : undefined },
      "/view/markdown/open":        { id: "markdown.open", argsMapper: (b) => b.filePath ? { filePath: b.filePath } : undefined },
      "/view/figlet/open":          { id: "figlet.open", argsMapper: (b) => b.text ? { text: b.text, font: b.font } : undefined },
      "/view/art/open":             { id: "art.open" },
      "/view/monster-cam/open":     { id: "monster_cam.open" },
      "/view/wibwob-agent/open":    { id: "agent.open" },
      "/view/companion/open":       { id: "companion.open" },
      "/view/companion/smol":       { id: "companion.smol" },
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
        const result = this.handlers.runCommand(viewRoute.id, args);
        return Response.json(result, { status: result.ok ? 200 : 404 });
      } catch (err: any) {
        return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
      }
    }
    if (request.method === "POST" && url.pathname === "/windows/focus") {
      return Response.json({
        ok: this.handlers.windows.focusWindow(Number((body as any).id)),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/move") {
      const b = body as any;
      return Response.json({
        ok: this.handlers.windows.moveWindow(
          Number(b.id),
          Number(b.left ?? b.x),
          Number(b.top ?? b.y),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/resize") {
      const b = body as any;
      return Response.json({
        ok: this.handlers.windows.resizeWindow(
          Number(b.id),
          Number(b.width ?? b.w),
          Number(b.height ?? b.h),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/close") {
      return Response.json({
        ok: this.handlers.windows.closeWindow(Number((body as any).id)),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/maximize") {
      return Response.json({
        ok: this.handlers.windows.toggleMaximize(Number((body as any).id)),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/batch") {
      // Body: { ops: Array<{ id, x?, y?, w?, h?, close? }> }
      // Each op can move, resize, or close a window. All applied in order.
      const ops = (body as any).ops as Array<{
        id: number;
        x?: number; y?: number;
        w?: number; h?: number;
        close?: boolean;
      }>;
      if (!Array.isArray(ops)) {
        return Response.json({ ok: false, error: "ops must be an array" }, { status: 400 });
      }
      const results: boolean[] = [];
      for (const op of ops) {
        const id = Number(op.id);
        if (op.close) {
          results.push(this.handlers.windows.closeWindow(id));
          continue;
        }
        if (op.x !== undefined && op.y !== undefined) {
          results.push(this.handlers.windows.moveWindow(id, Number(op.x), Number(op.y)));
        }
        if (op.w !== undefined && op.h !== undefined) {
          results.push(this.handlers.windows.resizeWindow(id, Number(op.w), Number(op.h)));
        }
      }
      return Response.json({ ok: results.every(Boolean), results });
    }
    if (request.method === "POST" && url.pathname === "/windows/input") {
      return Response.json({
        ok: this.handlers.windows.sendInput(
          Number((body as any).id),
          String((body as any).input ?? ""),
          (body as any).sender ? String((body as any).sender) : undefined,
        ),
      });
    }
    // Dedicated endpoint for session-to-agent messages — always requires sender
    if (request.method === "POST" && url.pathname === "/windows/agent-message") {
      const sender = (body as any).sender ? String((body as any).sender) : undefined;
      const text = String((body as any).text ?? (body as any).input ?? "");
      const id = Number((body as any).id);
      return Response.json({
        ok: this.handlers.windows.sendInput(id, text, sender),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/editor/write") {
      return Response.json({
        ok: this.handlers.windows.writeEditorText(
          Number((body as any).id),
          String((body as any).text ?? ""),
        ),
      });
    }

    if (request.method === "POST" && url.pathname === "/windows/text/export") {
      const id = Number((body as any).id);
      const text = this.handlers.windows.captureText(id);
      if (!text) return Response.json({ ok: false, path: null });
      // File export is a control-API concern, not a facade concern
      const capturesDir = path.join(process.cwd(), "scratch", "captures");
      fs.mkdirSync(capturesDir, { recursive: true });
      const name = typeof (body as any).name === "string" ? (body as any).name
        : typeof (body as any).label === "string" ? (body as any).label
        : `window-${id}`;
      const safeName = name.replace(/[^a-z0-9._-]+/gi, "-");
      const fileName = `${new Date().toISOString().replaceAll(":", "-")}_${safeName}.txt`;
      const filePath = path.join(capturesDir, fileName);
      fs.writeFileSync(filePath, `${text}\n`, "utf8");
      return Response.json({ ok: true, path: filePath });
    }
    // ── Backrooms + workspace — also dispatch through command registry ──
    if (request.method === "POST" && url.pathname === "/view/backrooms/open") {
      const channel = normalizeBackroomsChannel(body);
      const result = this.handlers.runCommand("backrooms.run", channel as unknown as Record<string, unknown>);
      return Response.json({ ...result, channel }, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "POST" && url.pathname === "/workspace/save") {
      const name = String((body as any).name ?? "default");
      const result = this.handlers.runCommand("workspace.save", { name });
      return Response.json({ ...result, name });
    }
    if (request.method === "POST" && url.pathname === "/workspace/load") {
      const name = String((body as any).name ?? "default");
      const result = this.handlers.runCommand("workspace.load_named", { name });
      return Response.json({ ...result, name });
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
