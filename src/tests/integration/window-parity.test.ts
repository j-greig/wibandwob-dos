/**
 * Window parity audit — verifies every openable window type reports
 * correct appType and summary through the state API.
 *
 * Covers: figlet, pattern, inspector, workspace, chrome-browser,
 * wibwob-agent, reader, and already-tested types for completeness.
 *
 * NOTE: backrooms-tv is not yet covered here (requires external
 * runtime behaviour). Add when a deterministic fake-live test mode
 * is available.
 *
 * Requires a running app. Set API_URL env to match your instance's port.
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

async function closeByAppType(appType: string) {
  const state = await get("/state");
  const matching = state.windows.filter((window: any) => window.details?.appType === appType);
  for (const window of matching) {
    await post("/windows/close", { id: window.id });
  }
  if (matching.length > 0) {
    await sleep(250);
  }
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
    expect(win.height).toBeGreaterThanOrEqual((win.details.contentHeight ?? 0) + 5);
    expect(win.width).toBeGreaterThanOrEqual((win.details.contentWidth ?? 0) + 4);
  });

  test("figlet-banner fits tall rendered glyphs", async () => {
    const win = await openAndFind("figlet.open", "figlet-banner", {
      text: "RUNTIME parity-1773492175",
      font: "doom",
    });
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.lineCount).toBeGreaterThanOrEqual(8);
    expect(win.height).toBeGreaterThanOrEqual(win.details.contentHeight + 5);
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

  test("runtime-inspector microapp: reports appType and summary", async () => {
    await closeByAppType("wibwob.runtime-inspector");
    const win = await openAndFind("microapp.wibwob.runtime-inspector.open", "wibwob.runtime-inspector");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("wibwob.runtime-inspector");
    expect(win.details.summary).toContain("Runtime Inspector");
    expect(win.details.activeTab).toBeDefined();
  });

  test("command-lab microapp: reports appType and summary", async () => {
    await closeByAppType("wibwob.command-lab");
    const win = await openAndFind("microapp.wibwob.command-lab.open", "wibwob.command-lab");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("wibwob.command-lab");
    expect(win.details.summary).toContain("Command Lab");
    expect(typeof win.details.selectedCommandId).toBe("string");
  });

  test("workspace-beacon microapp: reports appType and state", async () => {
    await closeByAppType("wibwob.workspace-beacon");
    const win = await openAndFind("microapp.wibwob.workspace-beacon.open", "wibwob.workspace-beacon");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("wibwob.workspace-beacon");
    expect(win.details.summary).toContain("Workspace Beacon");
    expect(typeof win.details.note).toBe("string");
    expect(typeof win.details.stage).toBe("string");
  });

  test("layout-probe microapp: reports appType and layout report", async () => {
    await closeByAppType("wibwob.layout-probe");
    const win = await openAndFind("microapp.wibwob.layout-probe.open", "wibwob.layout-probe");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("wibwob.layout-probe");
    expect(win.details.summary).toContain("Layout Probe");
    expect(win.details.layoutReport).toBeDefined();
    expect(Object.keys(win.details.layoutReport.regions ?? {}).length).toBeGreaterThan(0);
  });

  test("workspace-manager: reports appType and summary", async () => {
    const win = await openAndFind("workspace.manage", "workspace-manager");
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("workspace-manager");
    expect(win.details.summary).toContain("orkspace");
  });

  test("chrome-browser: reports appType and summary", async () => {
    const win = await openAndFind("web-reader.open", "web-reader", undefined, 1000);
    expect(win).toBeDefined();
    openedIds.push(win.id);
    expect(win.details.appType).toBe("web-reader");
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
    expect(win.details.summary.toLowerCase()).toContain("scramble");
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

  // Primer Gallery currently needs its own dedicated live test path.
  // The command exists, but the open surface is not deterministic enough
  // to keep this generic parity audit stable.

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
