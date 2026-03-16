/**
 * Window control API smoke tests.
 * Verifies the shared runtime window service path behind /windows/*.
 * Requires the app to be running on port 8099.
 */
import { afterAll, describe, expect, test } from "bun:test";

const API = process.env.API_URL ?? "http://localhost:8099";

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as any };
}

async function getState() {
  const { status, data } = await api("/state");
  expect(status).toBe(200);
  return data;
}

const openedWindowIds: number[] = [];

afterAll(async () => {
  for (const id of openedWindowIds) {
    await api("/windows/close", "POST", { id }).catch(() => {});
  }
});

describe("window control API", () => {
  test("open, move, resize, focus, write, and close an editor window", async () => {
    const marker = `window-service-${Date.now()}`;
    const before = await getState();
    const beforeIds = new Set(before.windows.map((window: any) => window.id));

    const opened = await api("/view/editor/open", "POST", {
      title: `Window Control ${marker}`,
      initial: "alpha",
    });
    expect(opened.status).toBe(200);
    expect(opened.data.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const afterOpen = await getState();
    const target = afterOpen.windows.find(
      (window: any) => !beforeIds.has(window.id) && window.details?.appType === "text-editor",
    );
    expect(target).toBeDefined();
    openedWindowIds.push(target.id);

    const moved = await api("/windows/move", "POST", {
      id: target.id,
      left: 14,
      top: 7,
    });
    expect(moved.status).toBe(200);
    expect(moved.data.ok).toBe(true);

    const resized = await api("/windows/resize", "POST", {
      id: target.id,
      width: 54,
      height: 16,
    });
    expect(resized.status).toBe(200);
    expect(resized.data.ok).toBe(true);

    const written = await api("/windows/editor/write", "POST", {
      id: target.id,
      text: "beta",
    });
    expect(written.status).toBe(200);
    expect(written.data.ok).toBe(true);

    const focused = await api("/windows/focus", "POST", { id: target.id });
    expect(focused.status).toBe(200);
    expect(focused.data.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const afterMutations = await getState();
    const updated = afterMutations.windows.find((window: any) => window.id === target.id);
    expect(updated).toBeDefined();
    expect(updated.left).toBe(14);
    expect(updated.top).toBe(7);
    expect(updated.width).toBe(54);
    expect(updated.height).toBe(16);
    expect(updated.focused).toBe(true);
    expect(updated.details?.contentPreview).toContain("alphabeta");

    const closed = await api("/windows/close", "POST", { id: target.id });
    expect(closed.status).toBe(200);
    expect(closed.data.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const afterClose = await getState();
    expect(afterClose.windows.some((window: any) => window.id === target.id)).toBe(false);
  });

  test("batch layout returns one result per op", async () => {
    const marker = `window-batch-${Date.now()}`;
    const before = await getState();
    const beforeIds = new Set(before.windows.map((window: any) => window.id));

    await api("/view/editor/open", "POST", {
      title: `Batch One ${marker}`,
      initial: "one",
    });
    await api("/view/editor/open", "POST", {
      title: `Batch Two ${marker}`,
      initial: "two",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const afterOpen = await getState();
    const opened = afterOpen.windows.filter(
      (window: any) => !beforeIds.has(window.id) && window.details?.appType === "text-editor",
    );
    expect(opened.length).toBe(2);
    openedWindowIds.push(...opened.map((window: any) => window.id));

    const batch = await api("/windows/batch", "POST", {
      ops: [
        { id: opened[0].id, left: 8, top: 5, width: 40, height: 12 },
        { id: opened[1].id, close: true },
      ],
    });
    expect(batch.status).toBe(200);
    expect(batch.data.ok).toBe(true);
    expect(JSON.stringify(batch.data.results)).toBe(JSON.stringify([true, true]));
  });

  test("legacy short-form window geometry fields are rejected", async () => {
    const move = await api("/windows/move", "POST", {
      id: 999999,
      x: 10,
      y: 5,
    });
    expect(move.status).toBe(400);
    expect(move.data.ok).toBe(false);
    expect(move.data.error).toContain("left and top");

    const resize = await api("/windows/resize", "POST", {
      id: 999999,
      w: 30,
      h: 12,
    });
    expect(resize.status).toBe(400);
    expect(resize.data.ok).toBe(false);
    expect(resize.data.error).toContain("width and height");

    const batch = await api("/windows/batch", "POST", {
      ops: [{ id: 999999, x: 1, y: 2, w: 3, h: 4 }],
    });
    expect(batch.status).toBe(400);
    expect(batch.data.ok).toBe(false);
    expect(batch.data.error).toContain("canonical");
  });
});
