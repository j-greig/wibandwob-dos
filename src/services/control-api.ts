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
import type { CommandSurface, CommandListItem } from "../core/command-registry.js";

interface ControlApiHandlers {
  getState: () => DesktopState;
  getPrimerInfo: (pathOrName: string) => unknown;
  listCommands: (surface?: CommandSurface) => CommandListItem[];
  runCommand: (id: string, args?: Record<string, unknown>) => { ok: true } | { ok: false; error: string };
  openPrimerBrowser: () => void;
  openFileManager: () => void;
  openPrimerGallery: () => void;
  openPrimerFile: (filePath: string) => void;
  openBrowserReader: (filePath?: string) => void;
  openFigletBanner: (text?: string, font?: string) => void;
  openArtWindow: () => void;
  openMonsterCam: () => void;
  openWibWobAgent: () => void;
  openCompanionWindow: () => void;
  openWorkspaceManager: () => void;
  openCommandPalette: () => void;
  openStateInspector: () => void;
  openEditorWindow: (filePath?: string, title?: string, initial?: string) => void;
  windows: import("../core/window-facade.js").WindowFacade;
  openBackroomsTv: (channel: BackroomsChannel) => void;
  saveWorkspaceNamed: (name: string) => void;
  loadWorkspaceNamed: (name: string) => void;
  /** Blessed screen.screenshot() — returns full TUI as ANSI text. */
  screenshotText: () => string;
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
  { method: "GET",  path: "/commands/list",                 description: "All registered commands (optional ?surface=menu|palette|api|agent)" },
  { method: "GET",  path: "/content/primer-info",           description: "Primer content metadata. ?path=/abs/path.txt" },
  { method: "GET",  path: "/windows/text",                  description: "Raw text content of a window. ?id=N" },
  { method: "GET",  path: "/screenshot/text",               description: "ANSI-stripped text screenshot of a window. ?id=N" },
  { method: "POST", path: "/commands/run",                  body: { command: "string (command id)", args: "object (optional)" } },
  { method: "POST", path: "/view/primer/open",              body: { filePath: "string (absolute path to .txt primer)" } },
  { method: "POST", path: "/view/figlet/open",              body: { text: "string", font: "string (optional)" } },
  { method: "POST", path: "/view/editor/open",              body: { filePath: "string (optional)", title: "string (optional)", initial: "string (optional)" } },
  { method: "POST", path: "/view/backrooms/open",           body: { theme: "string", mode: "auto|live|fake-live", model: "haiku|sonnet|opus", turns: "number", primers: "string (optional csv)" } },
  { method: "POST", path: "/view/browser-reader/open",      body: { filePath: "string (optional)", url: "string (optional)" } },
  { method: "POST", path: "/view/art/open",                 body: {} },
  { method: "POST", path: "/view/monster-cam/open",         body: {} },
  { method: "POST", path: "/view/wibwob-agent/open",        body: {} },
  { method: "POST", path: "/view/companion/open",           body: {} },
  { method: "POST", path: "/view/primer-browser/open",      body: {} },
  { method: "POST", path: "/view/file-manager/open",        body: {} },
  { method: "POST", path: "/view/primer-gallery/open",      body: {} },
  { method: "POST", path: "/view/workspace/open",           body: {} },
  { method: "POST", path: "/view/palette/open",             body: {} },
  { method: "POST", path: "/view/inspector/open",           body: {} },
  { method: "POST", path: "/windows/focus",                 body: { id: "number" } },
  { method: "POST", path: "/windows/move",                  body: { id: "number", left: "number", top: "number" } },
  { method: "POST", path: "/windows/resize",                body: { id: "number", width: "number", height: "number" } },
  { method: "POST", path: "/windows/close",                 body: { id: "number" } },
  { method: "POST", path: "/windows/batch",                 body: { ops: "array — each op: {id, x?, y?, w?, h?, close?}" }, description: "Move/resize/close multiple windows in one request. Applied in order. Returns {ok, results[]}" },
  { method: "POST", path: "/windows/batch",                 body: { ops: "[{id, x?, y?, w?, h?, close?}]" } },
  { method: "POST", path: "/windows/input",                 body: { id: "number", input: "string (trailing \\r submits)" } },
  { method: "POST", path: "/windows/text/export",           body: { id: "number", label: "string (optional)" } },
  { method: "POST", path: "/workspace/save",                body: { name: "string" } },
  { method: "POST", path: "/workspace/load",                body: { name: "string" } },
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
  ) {}

  start(): void {
    const bunRuntime = (
      globalThis as {
        Bun?: {
          serve: (options: {
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
          port,
          fetch: async (request) => this.handleRequest(request),
        });
        this.actualPort = port;
        this.enabled = true;
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
        docs: "GET /openapi.json for full OpenAPI 3.0 spec",
        endpoints: ENDPOINT_CATALOGUE,
      });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return Response.json(buildOpenApiSpec(this.actualPort ?? this.port));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, port: this.actualPort });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return Response.json(this.handlers.getState());
    }
    if (request.method === "GET" && url.pathname === "/commands/list") {
      const surface = url.searchParams.get("surface") as CommandSurface | null;
      return Response.json({
        ok: true,
        commands: this.handlers.listCommands(surface ?? undefined)
      });
    }

    if (request.method === "GET" && url.pathname === "/content/primer-info") {
      const pathOrName =
        url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
      return Response.json(this.handlers.getPrimerInfo(pathOrName));
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

    if (request.method === "POST" && url.pathname === "/commands/run") {
      const id = typeof (body as any).id === "string" ? (body as any).id : "";
      if (!id) {
        return Response.json({ ok: false, error: "id required" }, { status: 400 });
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

    if (request.method === "POST" && url.pathname === "/view/primer-browser/open") {
      this.handlers.openPrimerBrowser();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/file-manager/open") {
      this.handlers.openFileManager();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/primer-gallery/open") {
      this.handlers.openPrimerGallery();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/primer/open") {
      const filePath = typeof (body as any).filePath === "string" ? (body as any).filePath : undefined;
      if (!filePath) return Response.json({ ok: false, error: "filePath required" }, { status: 400 });
      this.handlers.openPrimerFile(filePath);
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/browser-reader/open") {
      this.handlers.openBrowserReader(
        typeof (body as any).filePath === "string" ? (body as any).filePath : undefined,
      );
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/figlet/open") {
      this.handlers.openFigletBanner(
        typeof (body as any).text === "string" ? (body as any).text : undefined,
        typeof (body as any).font === "string" ? (body as any).font : undefined,
      );
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/art/open") {
      this.handlers.openArtWindow();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/monster-cam/open") {
      this.handlers.openMonsterCam();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/wibwob-agent/open") {
      this.handlers.openWibWobAgent();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/companion/open") {
      this.handlers.openCompanionWindow();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/workspace/open") {
      this.handlers.openWorkspaceManager();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/palette/open") {
      this.handlers.openCommandPalette();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/inspector/open") {
      this.handlers.openStateInspector();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/editor/open") {
      this.handlers.openEditorWindow(
        typeof (body as any).filePath === "string" ? (body as any).filePath : undefined,
        typeof (body as any).title === "string" ? (body as any).title : undefined,
        typeof (body as any).initial === "string" ? (body as any).initial : undefined,
      );
      return Response.json({ ok: true });
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
        ),
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
      const name = typeof (body as any).name === "string" ? (body as any).name : `window-${id}`;
      const safeName = name.replace(/[^a-z0-9._-]+/gi, "-");
      const fileName = `${new Date().toISOString().replaceAll(":", "-")}_${safeName}.txt`;
      const filePath = path.join(capturesDir, fileName);
      fs.writeFileSync(filePath, `${text}\n`, "utf8");
      return Response.json({ ok: true, path: filePath });
    }
    if (request.method === "POST" && url.pathname === "/view/backrooms/open") {
      const channel = normalizeBackroomsChannel(body);
      this.handlers.openBackroomsTv(channel);
      return Response.json({ ok: true, channel });
    }
    if (request.method === "POST" && url.pathname === "/workspace/save") {
      const name = String((body as any).name ?? "default");
      this.handlers.saveWorkspaceNamed(name);
      return Response.json({ ok: true, name });
    }
    if (request.method === "POST" && url.pathname === "/workspace/load") {
      const name = String((body as any).name ?? "default");
      this.handlers.loadWorkspaceNamed(name);
      return Response.json({ ok: true, name });
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
