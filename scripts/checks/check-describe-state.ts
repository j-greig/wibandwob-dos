#!/usr/bin/env bun
// @name    check-describe-state
// @desc    Verify all window types implement describeState correctly
/**
 * Runtime describeState coverage checker.
 *
 * Connects to the running app via control API, opens each window type,
 * inspects /state, and asserts every window has a non-empty appType
 * and reasonable metadata.
 *
 * Usage: bun run scripts/check-describe-state.ts
 * Requires: app running on the configured control API.
 */

const BASE = process.env.API_URL ?? process.env.WW_API ?? "http://127.0.0.1:8099";

interface DesktopState {
  windows: Array<{
    id: number;
    kind: string;
    appType?: string;
    title: string;
    details?: Record<string, unknown>;
  }>;
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function closeWindow(id: number): Promise<void> {
  await post("/windows/close", { id });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Window types to test, with their open endpoint and any required args
const WINDOW_TYPES: Array<{
  name: string;
  endpoint: string;
  body?: Record<string, unknown>;
  expectedAppType: string;
  skipClose?: boolean;
}> = [
  { name: "editor", endpoint: "/view/editor/open", body: { title: "Test Buffer", initial: "hello" }, expectedAppType: "text-editor" },
  { name: "figlet", endpoint: "/view/figlet/open", body: { text: "TEST" }, expectedAppType: "figlet-banner" },
  { name: "art", endpoint: "/view/art/open", expectedAppType: "generative-art" },
  { name: "companion", endpoint: "/view/companion/open", expectedAppType: "companion-widget" },
  { name: "primer-browser", endpoint: "/view/primer-browser/open", expectedAppType: "primer-browser" },
  { name: "file-manager", endpoint: "/view/file-manager/open", expectedAppType: "file-manager" },
  { name: "primer-gallery", endpoint: "/view/primer-gallery/open", expectedAppType: "primer-gallery" },
  { name: "music-player", endpoint: "/view/music-player/open", expectedAppType: "music-player" },
  { name: "monster-cam", endpoint: "/view/monster-cam/open", expectedAppType: "monster-cam" },
  { name: "palette", endpoint: "/view/palette/open", expectedAppType: "command-palette" },
  { name: "inspector", endpoint: "/view/inspector/open", expectedAppType: "state-inspector" },
  { name: "workspace", endpoint: "/view/workspace/open", expectedAppType: "workspace-manager" },
];

async function main() {
  // Check health first
  try {
    await get("/health");
  } catch {
    console.error(`ERROR: App not running on ${BASE}. Start it first.`);
    process.exit(1);
  }

  const failures: string[] = [];
  const opened: number[] = [];

  for (const wt of WINDOW_TYPES) {
    process.stdout.write(`  ${wt.name.padEnd(20)}`);
    try {
      await post(wt.endpoint, wt.body ?? {});
      await sleep(300); // let the window register

      const state: DesktopState = await get("/state");
      const win = state.windows.find((w) => w.appType === wt.expectedAppType);

      if (!win) {
        const fallback = state.windows[state.windows.length - 1];
        if (fallback && !fallback.appType) {
          failures.push(`${wt.name}: opened but appType is empty (kind=${fallback.kind})`);
          console.log("FAIL — no appType");
          opened.push(fallback.id);
        } else if (fallback && fallback.appType !== wt.expectedAppType) {
          failures.push(`${wt.name}: expected appType="${wt.expectedAppType}" got "${fallback.appType}"`);
          console.log(`FAIL — wrong appType: ${fallback.appType}`);
          opened.push(fallback.id);
        } else {
          failures.push(`${wt.name}: window not found in state after open`);
          console.log("FAIL — not found");
        }
        continue;
      }

      // Check details exist
      if (!win.details || Object.keys(win.details).length === 0) {
        failures.push(`${wt.name}: appType="${win.appType}" but details is empty`);
        console.log("WARN — empty details");
      } else {
        console.log(`OK  appType=${win.appType}  details: ${Object.keys(win.details).join(", ")}`);
      }

      if (!wt.skipClose) {
        opened.push(win.id);
      }
    } catch (err) {
      failures.push(`${wt.name}: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`FAIL — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Clean up
  console.log(`\nCleaning up ${opened.length} test windows...`);
  for (const id of opened) {
    try {
      await closeWindow(id);
      await sleep(100);
    } catch { /* ignore */ }
  }

  // Report
  console.log("\n" + "=".repeat(60));
  if (failures.length === 0) {
    console.log(`ALL ${WINDOW_TYPES.length} WINDOW TYPES PASSED`);
    console.log("Every window has non-empty appType and metadata.");
  } else {
    console.log(`${failures.length} FAILURES:`);
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
