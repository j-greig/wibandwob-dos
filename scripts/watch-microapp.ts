#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";

interface MicroappManifest {
  name?: string;
  entry?: string;
  microapp?: {
    id?: string;
    title?: string;
  };
  dev?: {
    watch?: string[];
    reopenCommand?: string;
    reopenArgs?: Record<string, unknown>;
  };
}

interface RuntimeWindowState {
  id: number;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  details?: {
    appType?: string;
  };
}

const DEFAULT_WATCH = ["index.ts", "microapp.json"];

function usage(): never {
  console.error("Usage: bun run scripts/watch-microapp.ts <microapp-dir> [--open] [--debounce <ms>] [--api <url>]");
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(apiBase: string, pathname: string, method = "GET", body?: unknown): Promise<any> {
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text.trim() !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    throw new Error(`API ${method} ${pathname} failed: ${response.status} ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function parseArgs(argv: string[]) {
  if (argv.length === 0) usage();
  const args = [...argv];
  const microappDir = path.resolve(args.shift()!);
  let debounceMs = 250;
  let open = false;
  let apiBase = process.env.MICROAPP_WATCH_API ?? "http://127.0.0.1:8099";
  while (args.length > 0) {
    const arg = args.shift()!;
    if (arg === "--open") {
      open = true;
      continue;
    }
    if (arg === "--debounce") {
      const raw = args.shift();
      if (!raw) usage();
      debounceMs = Number(raw);
      if (!Number.isFinite(debounceMs) || debounceMs < 0) usage();
      continue;
    }
    if (arg === "--api") {
      apiBase = args.shift() ?? "";
      if (!apiBase) usage();
      continue;
    }
    usage();
  }
  return { microappDir, debounceMs, open, apiBase };
}

function loadManifest(microappDir: string): MicroappManifest {
  const manifestPath = path.join(microappDir, "microapp.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as MicroappManifest;
}

function uniqueParentDirs(microappDir: string, watchEntries: string[]): string[] {
  return [...new Set(
    watchEntries.map((entry) => path.dirname(path.resolve(microappDir, entry))),
  )];
}

function matchesWatchedFile(microappDir: string, watchEntries: string[], directory: string, filename?: string | null): boolean {
  if (!filename) return true;
  const absoluteChanged = path.resolve(directory, filename.toString());
  return watchEntries
    .map((entry) => path.resolve(microappDir, entry))
    .some((watched) => absoluteChanged === watched || absoluteChanged.startsWith(`${watched}${path.sep}`));
}

async function waitForCommand(apiBase: string, commandId: string, attempts = 20): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const payload = await api(apiBase, "/commands/list") as { commands: Array<{ id: string }> };
    if (payload.commands.some((command) => command.id === commandId)) {
      return;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for command ${commandId}`);
}

async function listMicroappWindows(apiBase: string, appType: string): Promise<RuntimeWindowState[]> {
  const state = await api(apiBase, "/state") as { windows: RuntimeWindowState[] };
  return state.windows.filter((window) => window.details?.appType === appType);
}

async function waitForClosedWindows(apiBase: string, ids: number[], appType: string, attempts = 20): Promise<void> {
  if (ids.length === 0) return;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = await listMicroappWindows(apiBase, appType);
    const openIds = new Set(current.map((window) => window.id));
    if (ids.every((id) => !openIds.has(id))) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${appType} windows to close`);
}

async function closeWindow(apiBase: string, id: number): Promise<void> {
  await api(apiBase, "/windows/close", "POST", { id });
}

async function reopenMicroappWindows(
  apiBase: string,
  reopenCommand: string,
  reopenArgs: Record<string, unknown>,
  windows: RuntimeWindowState[],
  appType: string,
): Promise<void> {
  if (windows.length === 0) return;
  const before = new Set((await listMicroappWindows(apiBase, appType)).map((window) => window.id));
  for (const window of windows) {
    await api(apiBase, "/commands/run", "POST", {
      id: reopenCommand,
      args: reopenArgs,
    });
    await sleep(250);
    const current = await listMicroappWindows(apiBase, appType);
    const reopened = current.find((candidate) => !before.has(candidate.id));
    if (!reopened) {
      continue;
    }
    before.add(reopened.id);
    await api(apiBase, "/windows/batch", "POST", {
      ops: [{
        id: reopened.id,
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
      }],
    });
    await sleep(50);
  }
}

async function reloadMicroapp(microappDir: string, apiBase: string, openOnBoot: boolean): Promise<void> {
  const manifest = loadManifest(microappDir);
  const appType = manifest.microapp?.id;
  if (!appType) {
    throw new Error(`Missing microapp.id in ${path.join(microappDir, "microapp.json")}`);
  }
  const reopenCommand = manifest.dev?.reopenCommand ?? `microapp.${appType}.open`;
  const reopenArgs = manifest.dev?.reopenArgs ?? {};
  const priorWindows = await listMicroappWindows(apiBase, appType);

  for (const window of priorWindows) {
    await closeWindow(apiBase, window.id);
  }
  await waitForClosedWindows(apiBase, priorWindows.map((window) => window.id), appType);

  const result = await api(apiBase, "/commands/run", "POST", { id: "microapps.reload" });
  await waitForCommand(apiBase, reopenCommand);

  if (openOnBoot && priorWindows.length === 0) {
    await api(apiBase, "/commands/run", "POST", { id: reopenCommand, args: reopenArgs });
  } else {
    await reopenMicroappWindows(apiBase, reopenCommand, reopenArgs, priorWindows, appType);
  }

  const stamp = new Date().toLocaleTimeString();
  console.log(`[watch-microapp] ${stamp} ${manifest.name ?? appType} reloaded`, JSON.stringify(result));
}

async function main() {
  const { microappDir, debounceMs, open, apiBase } = parseArgs(process.argv.slice(2));
  const manifest = loadManifest(microappDir);
  const watchEntries = manifest.dev?.watch?.length ? manifest.dev.watch : DEFAULT_WATCH;
  const parentDirs = uniqueParentDirs(microappDir, watchEntries);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reloadInFlight = false;
  let queued = false;

  const triggerReload = () => {
    if (reloadInFlight) {
      queued = true;
      return;
    }
    reloadInFlight = true;
    void reloadMicroapp(microappDir, apiBase, open)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[watch-microapp] reload failed: ${message}`);
      })
      .finally(() => {
        reloadInFlight = false;
        if (queued) {
          queued = false;
          triggerReload();
        }
      });
  };

  for (const directory of parentDirs) {
    fs.watch(directory, { persistent: true }, (_eventType, filename) => {
      if (!matchesWatchedFile(microappDir, watchEntries, directory, filename)) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(triggerReload, debounceMs);
    });
  }

  console.log(`[watch-microapp] watching ${microappDir}`);
  console.log(`[watch-microapp] files: ${watchEntries.join(", ")}`);
  console.log(`[watch-microapp] api: ${apiBase}`);

  if (open) {
    await reloadMicroapp(microappDir, apiBase, true);
  }
}

void main();
