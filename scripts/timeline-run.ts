#!/usr/bin/env bun
/**
 * Execute a timeline against a running WibWob-DOS instance via control API.
 *
 * Usage: bun run scripts/timeline-run.ts <timeline.json> [--no-audio]
 *
 * This is the external runner for smoke testing. It fires cues over HTTP.
 * The in-app timeline service dispatches in-process for tighter timing.
 */

import { spawn } from "bun";
import fs from "node:fs";
import { parseTimeline } from "../src/services/timeline-service.js";
import { resolveLayout, type DesktopBounds } from "../src/services/scene-layout.js";
import type { SceneWindow } from "../src/services/timeline-types.js";

const API = "http://127.0.0.1:8099";

const file = process.argv[2];
const noAudio = process.argv.includes("--no-audio");

if (!file) {
  console.error("Usage: bun run scripts/timeline-run.ts <timeline.json> [--no-audio]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const result = parseTimeline(file);
if (!result.ok) {
  console.error("❌ Validation failed:");
  for (const err of result.errors) console.error(`  • ${err}`);
  process.exit(1);
}

const tl = result.timeline!;

// ---------------------------------------------------------------------------
// Primer path resolution
// ---------------------------------------------------------------------------
// If a primer file path does not exist on disk, fetch primer.list and try to
// match by filename (basename). Rewrites paths in memory before execution so
// timelines with stale/guessed paths still work.

interface PrimerEntry { name: string; file?: string; path?: string }

async function fetchPrimerList(): Promise<PrimerEntry[]> {
  try {
    const res = await fetch(`${API}/commands/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "primer.list" }),
    });
    const data = await res.json() as { result?: PrimerEntry[] };
    return data.result ?? [];
  } catch {
    return [];
  }
}

/** Build a map from bare filename (e.g. "circuit-trace.txt") → absolute path. */
function buildFilenameIndex(primers: PrimerEntry[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const p of primers) {
    const filePath = p.path ?? p.file;
    if (!filePath || typeof filePath !== "string" || filePath.length === 0) continue;
    const parts = filePath.split("/");
    const basename = parts[parts.length - 1];
    if (!basename) continue;
    // First entry wins (avoids dupes from module shadowing)
    if (!index.has(basename)) index.set(basename, filePath);
  }
  return index;
}

/** Rewrite a single primer file path if it doesn't exist on disk. */
function resolvePrimerPath(filePath: string | undefined, index: Map<string, string>): string {
  if (!filePath || typeof filePath !== "string") return filePath ?? "";
  if (fs.existsSync(filePath)) return filePath;
  const basename = filePath.split("/").pop()!;
  const resolved = index.get(basename);
  if (resolved) {
    console.warn(`  ⚑ primer path rewritten: ${basename}`);
    console.warn(`    was: ${filePath}`);
    console.warn(`    now: ${resolved}`);
    return resolved;
  }
  console.warn(`  ✗ primer not found in primer.list: ${filePath}`);
  return filePath; // return original; let downstream handle the miss
}

/** Walk all primer refs in the timeline and rewrite paths in place. */
function rewriteTimelinePrimerPaths(index: Map<string, string>): void {
  // Palette
  for (const entry of tl.file.palette ?? []) {
    entry.file = resolvePrimerPath(entry.file, index);
  }

  // Scenes
  for (const scene of Object.values(tl.file.scenes ?? {})) {
    for (const sw of scene.windows ?? []) {
      if (sw.open.type === "primer") {
        sw.open.file = resolvePrimerPath(sw.open.file, index);
      }
    }
  }

  // Cues — patches can also carry primer refs
  for (const rc of tl.cues) {
    const cue = rc.cue;
    if ("patch" in cue && cue.patch.set) {
      for (const sw of cue.patch.set) {
        if (sw.open?.type === "primer") {
          sw.open.file = resolvePrimerPath(sw.open.file, index);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fetch live desktop bounds
// ---------------------------------------------------------------------------

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getState(): Promise<{ screen: { width: number; height: number }; windows: { id: number; appType: string }[] }> {
  return api("GET", "/state") as any;
}

async function runCommand(id: string, args?: Record<string, unknown>): Promise<void> {
  await api("POST", "/commands/run", { id, args });
}

async function batchOps(ops: unknown[]): Promise<void> {
  await api("POST", "/windows/batch", { ops });
}

// ---------------------------------------------------------------------------
// Scene execution via control API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Role tracking — maps role names to live window IDs
// ---------------------------------------------------------------------------

const roleMap = new Map<string, number>();

/** Map a SceneWindow.open to a command + args. */
function openCommand(sw: SceneWindow): { id: string; args: Record<string, unknown> } {
  const open = sw.open;
  switch (open.type) {
    case "primer":
      return { id: "primer.open", args: { filePath: open.file } };
    case "figlet":
      return { id: "figlet.open", args: { text: open.text, font: open.font } };
    case "art":
      return { id: "art.open", args: {} };
    case "pattern":
      return { id: "pattern.open", args: {} };
    case "contour":
      return { id: "contour.open", args: {} };
    case "contour-triptych":
      return { id: "contour_triptych.open", args: {} };
    case "companion":
      return { id: "companion.open", args: {} };
    case "command":
      return { id: open.id, args: open.args ?? {} };
  }
}

function isFiglet(sw: SceneWindow): boolean {
  return sw.open.type === "figlet";
}

function getWindowIds(state: any): Set<number> {
  return new Set((state.windows ?? []).map((w: any) => w.id));
}

function findNewWindowId(beforeIds: Set<number>, afterState: any): number | undefined {
  for (const w of afterState.windows ?? []) {
    if (!beforeIds.has(w.id)) return w.id;
  }
  return undefined;
}

/** Open one window, identify its ID, position it, track its role. */
async function openAndPosition(
  sw: SceneWindow,
  bounds: DesktopBounds,
): Promise<void> {
  const beforeState = await getState();
  const beforeIds = getWindowIds(beforeState);

  const cmd = openCommand(sw);
  await runCommand(cmd.id, cmd.args);
  await Bun.sleep(100);

  const afterState = await getState();
  const newId = findNewWindowId(beforeIds, afterState);
  if (!newId) return;

  roleMap.set(sw.role, newId);

  const rect = resolveLayout(sw.layout, bounds);

  if (isFiglet(sw)) {
    // Figlet already self-sized to content. Just move, keep measured size.
    const win = afterState.windows.find((w: any) => w.id === newId);
    const w = win?.width ?? rect.w;
    const h = win?.height ?? rect.h;
    const x = w < rect.w ? rect.x + Math.round((rect.w - w) / 2) : rect.x;
    await batchOps([{ id: newId, x, y: rect.y, w, h }]);
  } else {
    await batchOps([{ id: newId, x: rect.x, y: rect.y, w: rect.w, h: rect.h }]);
  }
}

async function executeScene(sceneName: string): Promise<void> {
  const scene = tl.file.scenes[sceneName];
  if (!scene) return;

  const state = await getState();
  const bounds: DesktopBounds = {
    width: state.screen.width,
    height: state.screen.height,
    topInset: 1,
    bottomInset: 1,
  };

  if (scene.theme) {
    await runCommand("theme.set", { name: scene.theme });
  }

  // Close non-agent windows
  const agentIds = new Set(
    state.windows.filter((w: any) => w.appType === "wibwob-agent").map((w: any) => w.id)
  );
  const closeOps = state.windows
    .filter((w: any) => !agentIds.has(w.id))
    .map((w: any) => ({ id: w.id, close: true }));
  if (closeOps.length > 0) {
    await batchOps(closeOps);
  }

  // Clear role map — scene is a full reset
  roleMap.clear();

  // Open and position each window one at a time
  for (const sw of scene.windows) {
    await openAndPosition(sw, bounds);
  }
}

async function executePatch(patch: any): Promise<void> {
  if (patch.theme) {
    await runCommand("theme.set", { name: patch.theme });
  }

  // Close by role
  if (patch.close) {
    const closeIds: { id: number; close: true }[] = [];
    for (const role of patch.close) {
      const winId = roleMap.get(role);
      if (winId) {
        closeIds.push({ id: winId, close: true });
        roleMap.delete(role);
      }
    }
    if (closeIds.length > 0) await batchOps(closeIds);
  }

  // Open new windows one at a time
  if (patch.set) {
    const state = await getState();
    const bounds: DesktopBounds = {
      width: state.screen.width,
      height: state.screen.height,
      topInset: 1,
      bottomInset: 1,
    };
    for (const sw of patch.set) {
      await openAndPosition(sw, bounds);
    }
  }
}

// ---------------------------------------------------------------------------
// Main playback loop
// ---------------------------------------------------------------------------

async function main() {
  console.log(`▶ Running: "${tl.file.title}" (${tl.file.duration}s, ${tl.cues.length} cues)\n`);

  // Verify app is running
  try {
    await getState();
  } catch {
    console.error("❌ Cannot connect to WibWob-DOS at", API);
    console.error("   Start the app first: bun run dev");
    process.exit(1);
  }

  // Resolve primer paths — rewrite any stale paths before execution
  {
    const primers = await fetchPrimerList();
    if (primers.length > 0) {
      const index = buildFilenameIndex(primers);
      rewriteTimelinePrimerPaths(index);
      console.log(`🗂 Primer index: ${index.size} entries loaded`);
    } else {
      console.warn("⚠ Could not fetch primer list — paths used as-is");
    }
  }

  // Start audio
  let audioProc: ReturnType<typeof spawn> | null = null;
  if (!noAudio && fs.existsSync(tl.file.track)) {
    audioProc = spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", tl.file.track], { stdio: "ignore" });
    console.log(`🎵 Audio: ${tl.file.track}`);
  } else if (!noAudio) {
    console.warn(`⚠ Track not found: ${tl.file.track} (running without audio)`);
  }

  const startTime = Date.now();
  console.log(`⏱ Start: ${new Date().toISOString()}\n`);

  // Schedule cues
  for (const rc of tl.cues) {
    const delayMs = rc.t * 1000;
    const elapsed = Date.now() - startTime;
    const wait = Math.max(0, delayMs - elapsed);

    if (wait > 0) await Bun.sleep(wait);

    const now = ((Date.now() - startTime) / 1000).toFixed(1);
    const cue = rc.cue;

    if ("scene" in cue) {
      console.log(`  ${now}s  SCENE → ${cue.scene}`);
      await executeScene(cue.scene);
    } else if ("patch" in cue) {
      console.log(`  ${now}s  PATCH`);
      await executePatch(cue.patch);
    } else if ("command" in cue) {
      console.log(`  ${now}s  CMD: ${cue.command.id}`);
      await runCommand(cue.command.id, cue.command.args);
    }
  }

  // Wait for track to finish
  const remaining = tl.durationMs - (Date.now() - startTime);
  if (remaining > 0) {
    console.log(`\n  Holding for ${(remaining / 1000).toFixed(1)}s...`);
    await Bun.sleep(remaining);
  }

  console.log(`\n■ Done.`);
  if (audioProc) {
    try { audioProc.kill(); } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
