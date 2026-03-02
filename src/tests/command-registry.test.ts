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

  test("unknown command returns 404", async () => {
    const { status, data } = await api("/commands/run", "POST", { id: "nonexistent.command" });
    expect(status).toBe(404);
    expect(data.ok).toBe(false);
  });

  test("toggle_theme executes without error", async () => {
    // Toggle twice to end up back where we started
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
