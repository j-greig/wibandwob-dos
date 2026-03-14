import { describe, expect, test } from "bun:test";

const API = "http://localhost:8099";

async function post(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() as any };
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json() as Promise<any>;
}

async function waitFor(
  predicate: (value: any) => boolean,
  fetcher: () => Promise<any>,
  timeoutMs = 3000,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fetcher();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return fetcher();
}

describe("picker flow hardening", () => {
  test("editor picker is inspectable and cancellable", async () => {
    await post("/commands/run", { id: "desktop.clear-all", args: { all: true } });
    try {
      const openResult = await post("/commands/run", { id: "editor.picker.open" });
      expect(openResult.status).toBe(200);
      expect(openResult.data.ok).toBe(true);
      expect(openResult.data.opened).toBe(true);

      const inspection = await waitFor(
        (value) =>
          value.snapshot?.ui?.blocked === true &&
          value.snapshot?.ui?.overlay?.type === "file-browser",
        () => get("/runtime/inspection"),
      );
      expect(inspection.snapshot.ui.overlay.label).toBe("Open Text File");
      expect(inspection.snapshot.ui.blockers.some((blocker: any) => blocker.type === "file-browser")).toBe(true);

      const cancelResult = await post("/overlay/cancel");
      expect(cancelResult.status).toBe(200);

      const cleared = await waitFor(
        (value) => value.snapshot?.ui?.blocked === false,
        () => get("/runtime/inspection"),
      );
      expect(cleared.snapshot.ui.overlay).toBe(null);
    } finally {
      await post("/commands/run", { id: "desktop.clear-all", args: { all: true } });
    }
  });

  test("markdown picker can continue through overlay controls", async () => {
    await post("/commands/run", { id: "desktop.clear-all", args: { all: true } });
    try {
      const beforeState = await get("/state");

      const openResult = await post("/commands/run", { id: "markdown.picker.open" });
      expect(openResult.status).toBe(200);
      expect(openResult.data.ok).toBe(true);
      expect(openResult.data.opened).toBe(true);

      const inspection = await waitFor(
        (value) =>
          value.snapshot?.ui?.blocked === true &&
          value.snapshot?.ui?.overlay?.type === "centered-list",
        () => get("/runtime/inspection"),
      );
      expect(inspection.snapshot.ui.overlay.label).toBe("Open Markdown");
      expect(inspection.snapshot.ui.blockers.some((blocker: any) => blocker.type === "centered-list")).toBe(true);

      const selectResult = await post("/overlay/select", { index: 0 });
      expect(selectResult.status).toBe(200);

      const confirmResult = await post("/overlay/confirm");
      expect(confirmResult.status).toBe(200);

      const afterState = await waitFor(
        (value) => value.windows.length > beforeState.windows.length,
        () => get("/state"),
        4000,
      );
      expect(afterState.windows.length).toBeGreaterThan(beforeState.windows.length);

      const cleared = await waitFor(
        (value) => value.snapshot?.ui?.blocked === false,
        () => get("/runtime/inspection"),
      );
      expect(cleared.snapshot.ui.overlay).toBe(null);
    } finally {
      await post("/commands/run", { id: "desktop.clear-all", args: { all: true } });
    }
  });
});
