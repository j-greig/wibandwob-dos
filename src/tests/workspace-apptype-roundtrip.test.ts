/**
 * Workspace appType round-trip hardening.
 *
 * Unit tests: registry restore, legacy remaps, unknown appTypes.
 * Live tests (requires app on port 8099): save → close → load → verify appType.
 *
 * Ref: https://github.com/j-greig/wibandwob-dos/issues/108
 */
import { describe, test, expect, afterAll } from "bun:test";
import { snapshotRegistry, registryRestore } from "../core/snapshot-registry.js";
import type { SnapshotRestoreActions } from "../core/snapshot-registry.js";
import type { PersistableAppType } from "../core/types.js";
import path from "node:path";

const API = process.env.API_URL ?? "http://localhost:8099";
const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post(p: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<any>;
}

async function get(p: string) {
  const res = await fetch(`${API}${p}`);
  return res.json() as Promise<any>;
}

/** Poll /state until predicate holds or timeout. */
async function waitFor(predicate: (state: any) => boolean, timeoutMs = 3000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await get("/state");
    if (predicate(state)) return state;
    await new Promise((r) => setTimeout(r, 200));
  }
  return get("/state");
}

async function closeAllWindows() {
  const state = await get("/state");
  for (const w of state.windows) {
    await post("/windows/close", { id: w.id });
  }
  await waitFor((s) => s.windows.length === 0);
}

function makeRestoreActions(overrides?: Partial<SnapshotRestoreActions>): SnapshotRestoreActions {
  return {
    openPrimerWindow: () => undefined,
    openEditorWindow: () => undefined,
    openBrowserReaderWindow: () => undefined,
    openFigletWindow: () => undefined,
    openPatternWindow: () => undefined,
    openPrimerGalleryWindow: () => undefined,
    openPrimerBrowserWindow: () => undefined,
    openFileManagerWindow: () => undefined,
    openBackroomsTv: () => undefined,
    openBackroomsLogBrowserWindow: () => undefined,
    openBackroomsPrimerPickerWindow: () => undefined,
    openChromeBrowserWindow: () => undefined,
    openCompanionWindow: () => undefined,
    openArtWindow: () => undefined,
    openMonsterCamWindow: () => undefined,
    openWibWobAgentWindow: () => undefined,
    windows: {} as any,  // not used by restore handlers directly
    ...overrides,
  };
}

// All PersistableAppTypes from the registry
const ALL_REGISTRY_TYPES = Object.keys(snapshotRegistry) as PersistableAppType[];

// Types we can open via the control API without external dependencies
const TESTABLE_TYPES: PersistableAppType[] = [
  "primer-viewer",
  "text-editor",
  "figlet-banner",
  "generative-art",
  "pattern-animation",
  "companion-widget",
  "wibwob-agent",
  "monster-cam",
  "primer-gallery",
  "primer-browser",
  "farjs-file-manager",
  "reader-viewer",
  // "reader" retired in E032 — merged into "text-editor" with viewMode: "view"
];

// Types that need external runtime (backrooms needs model, chrome needs browser)
const SKIP_TYPES: PersistableAppType[] = [
  "backrooms-tv",
  "backrooms-log-browser",
  "backrooms-primer-picker",
  "chrome-browser",
];

/** Open a window for a given PersistableAppType. */
async function openWindowForAppType(appType: PersistableAppType): Promise<boolean> {
  const primerPath = path.join(REPO_ROOT, "modules/example-primers/primers/hello-world.txt");
  const openers: Partial<Record<PersistableAppType, () => Promise<any>>> = {
    "primer-viewer": () => post("/view/primer/open", { filePath: primerPath }),
    "text-editor": () => post("/commands/run", { id: "editor.new" }),
    "figlet-banner": () => post("/commands/run", { id: "figlet.open", args: { text: "TEST" } }),
    "generative-art": () => post("/commands/run", { id: "art.open" }),
    "pattern-animation": () => post("/commands/run", { id: "pattern.open" }),
    "companion-widget": () => post("/commands/run", { id: "companion.open" }),
    "wibwob-agent": () => post("/commands/run", { id: "agent.open" }),
    "monster-cam": () => post("/commands/run", { id: "monster_cam.open" }),
    "primer-gallery": () => post("/commands/run", { id: "primer_gallery.open" }),
    "primer-browser": () => post("/commands/run", { id: "primer.browse" }),
    "farjs-file-manager": () => post("/commands/run", { id: "finder.open" }),
    "reader-viewer": () => post("/commands/run", { id: "readme.open" }),
  };
  const opener = openers[appType];
  if (!opener) return false;
  const result = await opener();
  return result?.ok !== false;
}

// ---------------------------------------------------------------------------
// Unit tests — no app required
// ---------------------------------------------------------------------------

describe("snapshot registry coverage", () => {
  test("TESTABLE_TYPES + SKIP_TYPES covers all PersistableAppTypes", () => {
    const covered = new Set([...TESTABLE_TYPES, ...SKIP_TYPES]);
    for (const t of ALL_REGISTRY_TYPES) {
      expect(covered.has(t)).toBe(true);
    }
    // No type in both lists
    for (const t of TESTABLE_TYPES) {
      expect(SKIP_TYPES.includes(t)).toBe(false);
    }
  });

  test("registry key count matches PersistableAppType union", () => {
    // 16 types as of this writing — if this fails, update TESTABLE/SKIP lists
    expect(ALL_REGISTRY_TYPES.length).toBe(17);
  });
});

describe("snapshot restore edge cases", () => {
  test("unknown appType is rejected", () => {
    const result = registryRestore(
      {
        kind: "unknown" as any,
        title: "Fake Window",
        left: 0, top: 0, width: 40, height: 20,
        payload: { appType: "totally-fake-nonexistent-type" },
      },
      makeRestoreActions(),
    );
    expect(result).toBeUndefined();
  });

  test("legacy wibwob-chat-v2 remaps to wibwob-agent", () => {
    let openedAgent = false;
    const actions = makeRestoreActions({
      openWibWobAgentWindow: () => { openedAgent = true; return undefined; },
    });

    const result = registryRestore(
      {
        kind: "chat" as any,
        title: "Wib&Wob Chat",
        left: 10, top: 5, width: 60, height: 30,
        payload: { appType: "wibwob-chat-v2" },
      },
      actions,
    );
    expect(result).not.toBe(false);
    expect(openedAgent).toBe(true);
  });

  test("legacy chat-transcript remaps to wibwob-agent", () => {
    let openedAgent = false;
    const actions = makeRestoreActions({
      openWibWobAgentWindow: () => { openedAgent = true; return undefined; },
    });

    const result = registryRestore(
      {
        kind: "chat" as any,
        title: "Old Chat",
        left: 0, top: 0, width: 40, height: 20,
        payload: { appType: "chat-transcript" },
      },
      actions,
    );
    expect(result).not.toBe(false);
    expect(openedAgent).toBe(true);
  });

  test("kind-only fallback works for old workspace files without appType", () => {
    let openedPrimer = false;
    const actions = makeRestoreActions({
      openPrimerWindow: () => { openedPrimer = true; return undefined; },
    });

    const result = registryRestore(
      {
        kind: "primer" as any,
        title: "Old Primer",
        left: 0, top: 0, width: 40, height: 20,
        filePath: "/some/file.txt",
        payload: {},  // no appType — old format
      },
      actions,
    );
    expect(result).not.toBe(false);
    expect(openedPrimer).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Live round-trip tests — require app on port 8099
// ---------------------------------------------------------------------------

describe("live workspace appType round-trip", () => {
  const testWorkspace = `_test-apptype-rt-${Date.now()}`;

  afterAll(async () => {
    try { await closeAllWindows(); } catch {}
  });

  test("appType matches at top level and in details", async () => {
    await post("/commands/run", { id: "editor.new" });
    await post("/commands/run", { id: "companion.open" });
    await post("/commands/run", { id: "figlet.open", args: { text: "PARITY" } });

    const state = await waitFor((s) => s.windows.length >= 3);
    for (const w of state.windows) {
      if (w.details?.appType) {
        // Top-level appType should agree with nested details.appType
        if (w.appType) {
          expect(w.appType).toBe(w.details.appType);
        }
      }
    }
    await closeAllWindows();
  });

  for (const appType of TESTABLE_TYPES) {
    test(`round-trip: ${appType}`, async () => {
      await closeAllWindows();

      const opened = await openWindowForAppType(appType);
      if (!opened) {
        console.warn(`Skipping ${appType} — could not open`);
        return;
      }

      // Wait for window to appear with correct appType
      const beforeState = await waitFor(
        (s) => s.windows.some((w: any) => w.details?.appType === appType),
      );
      const beforeWindow = beforeState.windows.find((w: any) => w.details?.appType === appType);
      expect(beforeWindow).toBeDefined();

      // Save
      const saveResult = await post("/workspace/save", { name: testWorkspace });
      expect(saveResult.ok).toBe(true);

      // Close all
      await closeAllWindows();
      const emptyState = await waitFor((s) => s.windows.length === 0);
      expect(emptyState.windows.length).toBe(0);

      // Load
      const loadResult = await post("/workspace/load", { name: testWorkspace });
      expect(loadResult.ok).toBe(true);

      // Wait for restore
      const afterState = await waitFor(
        (s) => s.windows.some((w: any) => w.details?.appType === appType),
        5000,
      );
      const afterWindow = afterState.windows.find((w: any) => w.details?.appType === appType);
      expect(afterWindow).toBeDefined();
      expect(afterWindow.details.appType).toBe(appType);

      await closeAllWindows();
    });
  }
});
