import type { BackroomsChannel, DesktopState } from "../core/types.js";

interface ControlApiHandlers {
  getState: () => DesktopState;
  getPrimerInfo: (pathOrName: string) => unknown;
  focusWindowById: (id: number) => boolean;
  moveWindowById: (id: number, left: number, top: number) => boolean;
  resizeWindowById: (id: number, width: number, height: number) => boolean;
  closeWindowById: (id: number) => boolean;
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
    private readonly handlers: ControlApiHandlers
  ) {}

  start(): void {
    const bunRuntime = (globalThis as { Bun?: { serve: (options: { port: number; fetch: (request: Request) => Promise<Response> | Response }) => { stop: (closeActiveConnections?: boolean) => void } } }).Bun;
    if (!bunRuntime) {
      this.enabled = false;
      this.actualPort = undefined;
      return;
    }
    const ports = [this.port, this.port + 1, this.port + 2, this.port + 3, this.port + 4];
    for (const port of ports) {
      try {
        this.server = bunRuntime.serve({
          port,
          fetch: async (request) => this.handleRequest(request)
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
      port: this.actualPort
    };
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, port: this.actualPort });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return Response.json(this.handlers.getState());
    }

    if (request.method === "GET" && url.pathname === "/content/primer-info") {
      const pathOrName = url.searchParams.get("path") ?? url.searchParams.get("name") ?? "";
      return Response.json(this.handlers.getPrimerInfo(pathOrName));
    }

    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

    if (request.method === "POST" && url.pathname === "/windows/focus") {
      return Response.json({ ok: this.handlers.focusWindowById(Number((body as any).id)) });
    }
    if (request.method === "POST" && url.pathname === "/windows/move") {
      return Response.json({
        ok: this.handlers.moveWindowById(
          Number((body as any).id),
          Number((body as any).left),
          Number((body as any).top)
        )
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/resize") {
      return Response.json({
        ok: this.handlers.resizeWindowById(
          Number((body as any).id),
          Number((body as any).width),
          Number((body as any).height)
        )
      });
    }
    if (request.method === "POST" && url.pathname === "/windows/close") {
      return Response.json({ ok: this.handlers.closeWindowById(Number((body as any).id)) });
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
  const model = typeof body.model === "string" && ["haiku", "sonnet", "opus"].includes(body.model)
    ? (body.model as BackroomsChannel["model"])
    : "sonnet";
  const mode = typeof body.mode === "string" && ["auto", "live", "fake-live"].includes(body.mode)
    ? (body.mode as BackroomsChannel["mode"])
    : "auto";
  return {
    theme: typeof body.theme === "string" && body.theme.trim() ? body.theme.trim() : "liminal fluorescent maze",
    primers: typeof body.primers === "string" ? body.primers.trim() : "",
    turns: Math.max(1, Math.min(20, Number(body.turns) || 3)),
    model,
    mode
  };
}
