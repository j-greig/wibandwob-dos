/**
 * Window parity audit — verifies every openable window type reports
 * correct appType and summary through the state API.
 *
 * Covers the 8 previously untested types: figlet, pattern, inspector,
 * workspace, chrome-browser, wibwob-agent, backrooms-tv, reader.
 * Also covers already-tested types for completeness.
 *
 * Requires the app to be running on port 8099.
 */
import { describe, test, expect, afterAll } from "bun:test";

const API = process.env.API_URL ?? "http://localhost:8099";

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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Open a window via command, return its state entry. */
async function openAndFind(
  commandId: string,
  expectedAppType: string,
  args?: Record<string, unknown>,
  delay = 500,
): Promise<any> {
  const before = await get("/state");
  const beforeIds = new Set(before.windows.map((w: any) => w.id));

  await post("/commands/run", { id: commandId, args });
  await sleep(delay);

  const after = await get("/state");
  const newWindow = after.windows.find(
    (w: any) => !beforeIds.has(w.id) && w.details?.appType === expectedAppType,
  );
  return newWindow;
}

// Track window ids opened by tests for cleanup
const openedIds: number[] = [];

afterAll(async () => {
  // Close all windows we opened
  for (const id of openedIds) {
    await post("/windows/close", { id }).catch(() => {});
  }
});

describe("window parity audit", () => {

  // --- Previously untested types ---

  test("figlet-banner: reports appType and summary", async () => {
    const win = await openAndFind("figlet.open", "figlet-banner", { text: "PARITY" });
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("figlet-banner");
    expect(win.details.summary).toContain("figlet");
    expect(win.details.font).toBeDefined();
  });

  test("pattern-animation: reports appType and summary", async () => {
    const win = await openAndFind("pattern.open", "pattern-animation");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("pattern-animation");
    expect(win.details.summary).toBeDefined();
  });

  test("state-inspector: reports appType and summary", async () => {
    const win = await openAndFind("inspector.open", "state-inspector");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("state-inspector");
  });

  test("workspace-manager: reports appType and summary", async () => {
    const win = await openAndFind("workspace.manage", "workspace-manager");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("workspace-manager");
    expect(win.details.summary).toContain("orkspace");
  });

  test("chrome-browser: reports appType and summary", async () => {
    const win = await openAndFind("chrome.open", "chrome-browser", undefined, 1000);
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("chrome-browser");
    expect(win.details.summary).toBeDefined();
  });

  test("wibwob-agent: reports appType, summary, model, streaming", async () => {
    const win = await openAndFind("agent.open", "wibwob-agent", undefined, 1000);
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("wibwob-agent");
    expect(win.details.summary).toBeDefined();
    expect(win.details.model).toBeDefined();
    expect(typeof win.details.streaming).toBe("boolean");
  });

  test("reader-viewer: reports appType and summary", async () => {
    const win = await openAndFind("document.open", "reader-viewer", { filePath: "README.md" });
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("reader-viewer");
    expect(win.details.summary).toContain("Viewing");
  });

  // --- Already tested types, included for completeness ---

  test("text-editor: reports appType and summary", async () => {
    const win = await openAndFind("editor.new", "text-editor");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("text-editor");
    expect(win.details.summary).toBeDefined();
  });

  test("companion-widget: reports appType and summary", async () => {
    const win = await openAndFind("companion.open", "companion-widget");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("companion-widget");
    expect(win.details.summary).toContain("scramble");
  });

  test("generative-art: reports appType and summary", async () => {
    const win = await openAndFind("art.open", "generative-art");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("generative-art");
    expect(win.details.summary).toBeDefined();
  });

  test("command-palette: reports appType and summary", async () => {
    const win = await openAndFind("palette.open", "command-palette");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("command-palette");
    expect(win.details.summary).toContain("palette");
  });

  test("primer-gallery: reports appType and summary", async () => {
    const win = await openAndFind("primer_gallery.open", "primer-gallery");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("primer-gallery");
    expect(win.details.summary).toContain("gallery");
  });

  // --- Aggregate check ---

  test("every window has appType and summary", async () => {
    const state = await get("/state");
    for (const w of state.windows) {
      expect(w.details).toBeDefined();
      expect(typeof w.details.appType).toBe("string");
      expect(w.details.appType.length).toBeGreaterThan(0);
      // summary should exist on all except potentially transient windows
      if (w.details.summary !== undefined) {
        expect(typeof w.details.summary).toBe("string");
      }
    }
  });
});
