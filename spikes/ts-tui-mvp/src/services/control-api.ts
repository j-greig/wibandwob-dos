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

import type { BackroomsChannel, DesktopState } from "../core/types.js";

interface ControlApiHandlers {
  getState: () => DesktopState;
  getPrimerInfo: (pathOrName: string) => unknown;
  openXTermShell: () => void;
  closeXTermShells: () => number;
  restartXTermShell: () => void;
  focusWindowById: (id: number) => boolean;
  moveWindowById: (id: number, left: number, top: number) => boolean;
  resizeWindowById: (id: number, width: number, height: number) => boolean;
  closeWindowById: (id: number) => boolean;
  sendWindowInput: (id: number, input: string) => boolean;
  captureWindowText: (id: number, name?: string) => string | undefined;
  openBackroomsTv: (channel: BackroomsChannel) => void;
  saveWorkspaceNamed: (name: string) => void;
  loadWorkspaceNamed: (name: string) => void;
}

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

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "wibwob-ts-tui-control-api",
        port: this.actualPort,
        endpoints: [
          "GET /health",
          "GET /state",
          "GET /content/primer-info?path=...",
          "GET /windows/text?id=...",
          "POST /view/xterm/open",
          "POST /view/xterm/close",
          "POST /view/xterm/restart",
          "POST /view/backrooms/open",
          "POST /windows/focus",
          "POST /windows/move",
          "POST /windows/resize",
          "POST /windows/close",
          "POST /windows/input",
          "POST /windows/text/export",
          "POST /workspace/save",
          "POST /workspace/load",
        ],
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, port: this.actualPort });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return Response.json(this.handlers.getState());
    }

    if (request.method === "GET" && url.pathname === "/content/primer-info") {
      const pathOrName =
        url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
      return Response.json(this.handlers.getPrimerInfo(pathOrName));
    }
    if (request.method === "GET" && url.pathname === "/windows/text") {
      const id = Number(url.searchParams.get("id"));
      const exported = this.handlers.captureWindowText(id);
      return Response.json({ ok: Boolean(exported), path: exported });
    }

    const body =
      request.method === "POST" ? await request.json().catch(() => ({})) : {};

    if (request.method === "POST" && url.pathname === "/view/xterm/open") {
      this.handlers.openXTermShell();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/view/xterm/close") {
      return Response.json({
        ok: true,
        closed: this.handlers.closeXTermShells(),
      });
    }
    if (request.method === "POST" && url.pathname === "/view/xterm/restart") {
      this.handlers.restartXTermShell();
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/windows/focus") {
      return Response.json({
        ok: this.handlers.focusWindowById(Number((body as any).id)),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/move") {
      return Response.json({
        ok: this.handlers.moveWindowById(
          Number((body as any).id),
          Number((body as any).left),
          Number((body as any).top),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/resize") {
      return Response.json({
        ok: this.handlers.resizeWindowById(
          Number((body as any).id),
          Number((body as any).width),
          Number((body as any).height),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/close") {
      return Response.json({
        ok: this.handlers.closeWindowById(Number((body as any).id)),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/input") {
      return Response.json({
        ok: this.handlers.sendWindowInput(
          Number((body as any).id),
          String((body as any).input ?? ""),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/text/export") {
      const exported = this.handlers.captureWindowText(
        Number((body as any).id),
        typeof (body as any).name === "string" ? (body as any).name : undefined,
      );
      return Response.json({ ok: Boolean(exported), path: exported });
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
