/**
 * Command registry contract tests.
 *
 * Verifies that every command in the catalog has a valid action key,
 * and that the registry can list and execute commands without throwing.
 *
 * Runs against the live control API — the app must be running.
 */

import { describe, test, expect } from "bun:test";

const API = process.env.API_URL ?? "http://localhost:8099";

async function api(path: string, method = "GET", body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return { status: res.status, data: await res.json() as any };
}

describe("control API health", () => {
  test("responds on /health", async () => {
    const { status, data } = await api("/health");
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("control API contract docs", () => {
  test("/help and /openapi expose the same touched canonical routes", async () => {
    const help = await api("/help");
    expect(help.status).toBe(200);
    const endpointPaths = new Set<string>(help.data.endpoints.map((ep: { path: string }) => ep.path));
    expect(endpointPaths.has("/windows/editor/write")).toBe(true);
    expect(endpointPaths.has("/view/reader/open")).toBe(true);
    expect(endpointPaths.has("/view/generative-art/open")).toBe(true);
    expect(endpointPaths.has("/view/markdown/open")).toBe(false);
    expect(endpointPaths.has("/view/art/open")).toBe(false);

    const openapiRes = await fetch(`${API}/openapi.json`);
    expect(openapiRes.status).toBe(200);
    const openapi = await openapiRes.json() as { paths: Record<string, unknown> };
    expect(openapi.paths["/windows/editor/write"]).toBeDefined();
    expect(openapi.paths["/view/reader/open"]).toBeDefined();
    expect(openapi.paths["/view/generative-art/open"]).toBeDefined();
    expect(openapi.paths["/view/markdown/open"]).toBeUndefined();
    expect(openapi.paths["/view/art/open"]).toBeUndefined();
  });

  test("retired legacy view aliases return 404", async () => {
    const markdown = await fetch(`${API}/view/markdown/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: "/tmp/example.md" }),
    });
    expect(markdown.status).toBe(404);

    const art = await fetch(`${API}/view/art/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(art.status).toBe(404);
  });
});

describe("command registry", () => {
  test("lists commands", async () => {
    const { status, data } = await api("/commands/list");
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.commands)).toBe(true);
    expect(data.commands.length).toBeGreaterThan(10);
  });

  test("every command has id and label", async () => {
    const { data } = await api("/commands/list");
    for (const cmd of data.commands) {
      expect(typeof cmd.id).toBe("string");
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(typeof cmd.label).toBe("string");
      expect(cmd.label.length).toBeGreaterThan(0);
    }
  });

  test("list emits canonical ids only", async () => {
    const { data } = await api("/commands/list");
    const ids = new Set<string>(data.commands.map((cmd: { id: string }) => cmd.id));
    expect(ids.has("theme.cycle")).toBe(true);
    expect(ids.has("app.toggle_theme")).toBe(false);
  });

  test("unknown command returns 404", async () => {
    const { status, data } = await api("/commands/run", "POST", { id: "nonexistent.command" });
    expect(status).toBe(404);
    expect(data.ok).toBe(false);
  });

  test("commands.run requires canonical id body field", async () => {
    const { status, data } = await api("/commands/run", "POST", { command: "theme.cycle" });
    expect(status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("id required");
  });

  test("toggle_theme executes without error", async () => {
    // Toggle twice to end up back where we started
    const r1 = await api("/commands/run", "POST", { id: "theme.cycle" });
    expect(r1.status).toBe(200);
    expect(r1.data.ok).toBe(true);

    const r2 = await api("/commands/run", "POST", { id: "theme.cycle" });
    expect(r2.status).toBe(200);
    expect(r2.data.ok).toBe(true);
  });

  test("legacy alias executes without error", async () => {
    const r1 = await api("/commands/run", "POST", { id: "app.toggle_theme" });
    expect(r1.status).toBe(200);
    expect(r1.data.ok).toBe(true);

    const r2 = await api("/commands/run", "POST", { id: "app.toggle_theme" });
    expect(r2.status).toBe(200);
    expect(r2.data.ok).toBe(true);
  });
});

describe("state service", () => {
  test("returns valid desktop state", async () => {
    const { status, data } = await api("/state");
    expect(status).toBe(200);
    expect(data.screen).toBeDefined();
    expect(typeof data.screen.width).toBe("number");
    expect(typeof data.screen.height).toBe("number");
    expect(typeof data.screen.cellAspect).toBe("number");
    expect(typeof data.screen.openWindowCount).toBe("number");
    expect(Array.isArray(data.windows)).toBe(true);
  });

  test("returns runtime stats snapshot", async () => {
    const { status, data } = await api("/runtime/stats");
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.stats.render.fps).toBe("number");
    expect(typeof data.stats.render.avgFrameMs).toBe("number");
    expect(typeof data.stats.render.totalFrames).toBe("number");
    expect(typeof data.stats.rssMb).toBe("number");
    expect(typeof data.stats.heapUsedMb).toBe("number");
    expect(typeof data.stats.agent.active).toBe("boolean");
    expect(typeof data.stats.agent.streaming).toBe("boolean");
    expect(typeof data.stats.agent.messageCount).toBe("number");
    expect(typeof data.stats.agent.toolRunCount).toBe("number");
  });

  test("returns runtime inspection snapshot with UI state", async () => {
    const { status, data } = await api("/runtime/inspection");
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.snapshot.state.app.instanceId).toBe("string");
    expect(typeof data.snapshot.ui.menu.open).toBe("boolean");
    expect(data.snapshot.ui.overlay === null || typeof data.snapshot.ui.overlay.type === "string").toBe(true);
    expect(typeof data.snapshot.stats.render.fps).toBe("number");
  });

  test("every window has required fields", async () => {
    const { data } = await api("/state");
    for (const w of data.windows) {
      expect(typeof w.id).toBe("number");
      expect(typeof w.kind).toBe("string");
      expect(typeof w.title).toBe("string");
      expect(typeof w.left).toBe("number");
      expect(typeof w.top).toBe("number");
      expect(typeof w.width).toBe("number");
      expect(typeof w.height).toBe("number");
      expect(typeof w.zIndex).toBe("number");
      expect(typeof w.focused).toBe("boolean");
    }
  });

  test("window count matches windows array", async () => {
    const { data } = await api("/state");
    expect(data.screen.openWindowCount).toBe(data.windows.length);
  });
});

describe("screenshot text", () => {
  test("returns non-empty ANSI text", async () => {
    const res = await fetch(`${API}/screenshot/text`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(100);
    // Should contain menu bar text
    expect(text).toContain("File");
    expect(text).toContain("Edit");
    expect(text).toContain("View");
  });
});
