/**
 * Workspace round-trip test.
 * Requires the app to be running on port 8099.
 *
 * Tests: save workspace → load workspace → verify windows match.
 */
import { describe, test, expect } from "bun:test";

const API =
  process.env.API_URL ??
  process.env.WW_API ??
  "http://localhost:8099";

async function post(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<any>;
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json() as Promise<any>;
}

async function getWindowSummaries() {
  const state = await get("/state");
  return state.windows.map((w: any) => ({
    kind: w.kind,
    title: w.title,
    appType: w.details?.appType,
  })).sort((a: any, b: any) => a.title.localeCompare(b.title));
}

async function getWindowByAppType(appType: string) {
  const state = await get("/state");
  return state.windows.find((window: any) => window.details?.appType === appType);
}

async function clearDesktop() {
  try {
    await post("/overlay/cancel");
  } catch {
    // Ignore when no overlay is active.
  }
  const state = await get("/state");
  for (const windowRecord of state.windows) {
    await post("/windows/close", { id: windowRecord.id });
  }
  await new Promise((r) => setTimeout(r, 350));
  const after = await get("/state");
  expect(after.windows.length).toBe(0);
}

describe("workspace round-trip", () => {
  const testName = `_test-roundtrip-${Date.now()}`;

  test("save → close all → load → windows match", async () => {
    await clearDesktop();

    // 1. Open a known set of windows
    await post("/commands/run", { id: "editor.new" });
    await post("/commands/run", { id: "companion.open" });
    await post("/commands/run", { id: "figlet.open", args: { text: "TEST" } });
    await post("/view/primer/open", { filePath: "microapps/example-primers/primers/hello-world.txt" });

    await new Promise((r) => setTimeout(r, 500));
    const before = await getWindowSummaries();
    expect(before.length).toBeGreaterThanOrEqual(4);

    // 2. Save workspace
    const saveResult = await post("/workspace/save", { name: testName });
    expect(saveResult.ok).toBe(true);

    // 3. Close all windows
    const state = await get("/state");
    for (const w of state.windows) {
      await post("/windows/close", { id: w.id });
    }
    await new Promise((r) => setTimeout(r, 300));
    const empty = await get("/state");
    expect(empty.windows.length).toBe(0);

    // 4. Load workspace back
    const loadResult = await post("/workspace/load", { name: testName });
    expect(loadResult.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 1000));

    // 5. Verify windows match
    const after = await getWindowSummaries();
    expect(after.length).toBe(before.length);

    for (let i = 0; i < before.length; i++) {
      expect(after[i].kind).toBe(before[i].kind);
      expect(after[i].title).toBe(before[i].title);
    }

    await clearDesktop();
  });

  test("theme persists across save/load", async () => {
    await clearDesktop();

    // Set a known theme
    await post("/commands/run", { id: "theme.set", args: { name: "wibwob-dark-nord" } });
    await new Promise((r) => setTimeout(r, 300));

    // Save
    await post("/workspace/save", { name: testName + "-theme" });

    // Switch theme
    await post("/commands/run", { id: "theme.set", args: { name: "wibwob-light" } });
    await new Promise((r) => setTimeout(r, 300));
    const mid = await get("/state");
    expect(mid.app.theme).toBe("wibwob-light");

    // Load — should restore nord
    await post("/workspace/load", { name: testName + "-theme" });
    await new Promise((r) => setTimeout(r, 500));
    const after = await get("/state");
    expect(after.app.theme).toBe("wibwob-dark-nord");

    // Restore dark
    await post("/commands/run", { id: "theme.set", args: { name: "wibwob-dark" } });
    await clearDesktop();
  });

  test("workspace-beacon microapp state persists across save/load", async () => {
    await clearDesktop();

    await post("/commands/run", { id: "microapp.wibwob.workspace-beacon.open" });
    await new Promise((r) => setTimeout(r, 350));
    await post("/commands/run", {
      id: "microapp.wibwob.workspace-beacon.set-note",
      args: { note: "Microapp proof restore marker" },
    });
    await post("/commands/run", { id: "microapp.wibwob.workspace-beacon.cycle-stage" });
    await post("/commands/run", { id: "microapp.wibwob.workspace-beacon.toggle-pin" });
    await new Promise((r) => setTimeout(r, 250));

    const before = await getWindowByAppType("wibwob.workspace-beacon");
    expect(before).toBeDefined();
    expect(before.details.note).toBe("Microapp proof restore marker");
    expect(before.details.stage).toBe("draft");
    expect(before.details.pinned).toBe(true);

    const saveResult = await post("/workspace/save", { name: `${testName}-beacon` });
    expect(saveResult.ok).toBe(true);

    await clearDesktop();

    const loadResult = await post("/workspace/load", { name: `${testName}-beacon` });
    expect(loadResult.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 900));

    const restored = await getWindowByAppType("wibwob.workspace-beacon");
    expect(restored).toBeDefined();
    expect(restored.details.note).toBe("Microapp proof restore marker");
    expect(restored.details.stage).toBe("draft");
    expect(restored.details.pinned).toBe(true);

    await clearDesktop();
  });

  test("move and resize API use canonical field names", async () => {
    await clearDesktop();

    await post("/commands/run", { id: "companion.open" });
    await new Promise((r) => setTimeout(r, 300));
    const state = await get("/state");
    const win = state.windows[state.windows.length - 1];

    await post("/windows/move", { id: win.id, left: 10, top: 5 });
    await new Promise((r) => setTimeout(r, 200));
    const after = await get("/state");
    const moved = after.windows.find((w: any) => w.id === win.id);
    expect(moved.left).toBe(10);
    expect(moved.top).toBe(5);

    await post("/windows/resize", { id: win.id, width: 30, height: 15 });
    await new Promise((r) => setTimeout(r, 200));
    const resized = await get("/state");
    const sized = resized.windows.find((w: any) => w.id === win.id);
    expect(sized.width).toBe(30);
    expect(sized.height).toBe(15);

    await post("/windows/close", { id: win.id });
    await clearDesktop();
  });
});
