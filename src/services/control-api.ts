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
          "GET /commands/list",
          "GET /content/primer-info?path=...",
          "GET /windows/text?id=...",
          "GET /screenshot/text",
          "POST /view/primer-browser/open",
          "POST /view/file-manager/open",
          "POST /view/primer-gallery/open",
          "POST /view/browser-reader/open",
          "POST /view/figlet/open",
          "POST /view/art/open",
          "POST /view/monster-cam/open",
          "POST /view/wibwob-agent/open",
          "POST /view/companion/open",
          "POST /view/workspace/open",
          "POST /view/palette/open",
          "POST /view/inspector/open",
          "POST /view/editor/open",
          "POST /view/backrooms/open",
          "POST /commands/run",
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
      const text = this.handlers.screenshotText();
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
      return Response.json({
        ok: this.handlers.windows.moveWindow(
          Number((body as any).id),
          Number((body as any).left),
          Number((body as any).top),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/resize") {
      return Response.json({
        ok: this.handlers.windows.resizeWindow(
          Number((body as any).id),
          Number((body as any).width),
          Number((body as any).height),
        ),
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/close") {
      return Response.json({
        ok: this.handlers.windows.closeWindow(Number((body as any).id)),
      });
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
