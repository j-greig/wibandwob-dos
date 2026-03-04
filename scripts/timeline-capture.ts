#!/usr/bin/env bun
/**
 * Timeline Capture — run a timeline with per-cue screenshots and state capture.
 *
 * Usage: bun run scripts/timeline-capture.ts <timeline.json> [--no-audio]
 *
 * For each cue, captures:
 *   - text screenshot (ANSI stripped)
 *   - full desktop state JSON
 *   - machine-readable capture log
 *
 * Output goes to scratch/timeline-captures/<timestamp>/
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseTimeline } from "../src/services/timeline-service.js";
import { resolveLayout, type DesktopBounds } from "../src/services/scene-layout.js";
import type { SceneWindow, Cue } from "../src/services/timeline-types.js";

const API = "http://127.0.0.1:8099";

const file = process.argv[2];
const noAudio = process.argv.includes("--no-audio");

if (!file) {
  console.error("Usage: bun run scripts/timeline-capture.ts <timeline.json> [--no-audio]");
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
// Capture directory
// ---------------------------------------------------------------------------

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const captureDir = path.join("scratch", "timeline-captures", timestamp);
fs.mkdirSync(captureDir, { recursive: true });

// Copy timeline file into capture dir
fs.copyFileSync(file, path.join(captureDir, "timeline.json"));

const logPath = path.join(captureDir, "capture-log.jsonl");

function logEntry(entry: Record<string, unknown>) {
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api(method: string, apiPath: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getState(): Promise<any> {
  return api("GET", "/state");
}

async function getScreenshotText(): Promise<string> {
  const res = await fetch(`${API}/screenshot/text`);
  return res.text();
}

async function runCommand(id: string, args?: Record<string, unknown>): Promise<void> {
  await api("POST", "/commands/run", { id, args });
}

async function batchOps(ops: unknown[]): Promise<void> {
  await api("POST", "/windows/batch", { ops });
}

// ---------------------------------------------------------------------------
// Primer path resolution (same as timeline-run.ts)
// ---------------------------------------------------------------------------

async function fetchPrimerList(): Promise<{ name: string; path: string }[]> {
  try {
    const res = await api("POST", "/commands/run", { id: "primer.list" }) as any;
    return res.result ?? [];
  } catch { return []; }
}

function buildFilenameIndex(primers: { name: string; path: string }[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const p of primers) {
    if (p.path && typeof p.path === "string") {
      const basename = p.path.split("/").pop()!;
      if (basename && !index.has(basename)) index.set(basename, p.path);
    }
  }
  return index;
}

function resolvePrimerPath(filePath: string | undefined, index: Map<string, string>): string {
  if (!filePath || typeof filePath !== "string") return filePath ?? "";
  if (fs.existsSync(filePath)) return filePath;
  const basename = filePath.split("/").pop()!;
  const resolved = index.get(basename);
  return resolved ?? filePath;
}

function rewritePrimerPaths(index: Map<string, string>): void {
  for (const entry of tl.file.palette ?? []) {
    entry.file = resolvePrimerPath(entry.file, index);
  }
  for (const scene of Object.values(tl.file.scenes ?? {})) {
    for (const sw of scene.windows ?? []) {
      if (sw.open?.type === "primer") {
        sw.open.file = resolvePrimerPath(sw.open.file, index);
      }
    }
  }
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
// Screenshot + capture
// ---------------------------------------------------------------------------

/** Strip ANSI escape codes for plain text capture */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

async function captureBar(
  cueIndex: number,
  cueTime: number,
  cue: Cue,
  elapsedMs: number,
): Promise<void> {
  const label = `cue-${String(cueIndex).padStart(2, "0")}_t${cueTime.toFixed(1)}s`;

  // Brief settle time for windows to render
  await Bun.sleep(200);

  // Text screenshot
  const ansiText = await getScreenshotText();
  const plainText = stripAnsi(ansiText);
  const textPath = path.join(captureDir, `${label}.txt`);
  fs.writeFileSync(textPath, plainText);

  // ANSI screenshot (preserves colors for review)
  const ansiPath = path.join(captureDir, `${label}.ansi`);
  fs.writeFileSync(ansiPath, ansiText);

  // Desktop state
  const state = await getState();
  const statePath = path.join(captureDir, `${label}_state.json`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Describe what SHOULD be on screen
  let expected = "";
  if ("scene" in cue) {
    const scene = tl.file.scenes[cue.scene];
    expected = `SCENE:${cue.scene} theme:${scene?.theme ?? "unchanged"} windows:${scene?.windows.length ?? 0}`;
  } else if ("patch" in cue) {
    const parts: string[] = [];
    if (cue.patch.theme) parts.push(`theme:${cue.patch.theme}`);
    if (cue.patch.set) parts.push(`+${cue.patch.set.length}win`);
    if (cue.patch.close) parts.push(`-${cue.patch.close.length}roles`);
    expected = `PATCH ${parts.join(" ")}`;
  } else if ("command" in cue) {
    expected = `CMD:${cue.command.id}`;
  }

  // Log entry
  logEntry({
    cueIndex,
    t: cueTime,
    elapsedMs,
    expected,
    textFile: `${label}.txt`,
    ansiFile: `${label}.ansi`,
    stateFile: `${label}_state.json`,
    windowCount: state.screen?.openWindowCount,
    theme: state.app?.theme,
    windows: state.windows?.map((w: any) => ({
      id: w.id,
      appType: w.appType,
      title: w.title?.slice(0, 40),
      left: w.left,
      top: w.top,
      width: w.width,
      height: w.height,
    })),
  });

  console.log(`  📸 ${label}  ${expected}  (${state.screen?.openWindowCount} windows, theme:${state.app?.theme})`);
}

// ---------------------------------------------------------------------------
// Role tracking — maps role names to live window IDs
// ---------------------------------------------------------------------------

const roleMap = new Map<string, number>();

function openCommand(sw: SceneWindow): { id: string; args: Record<string, unknown> } {
  const open = sw.open;
  switch (open.type) {
    case "primer":   return { id: "primer.open", args: { filePath: open.file } };
    case "figlet":   return { id: "figlet.open", args: { text: open.text, font: open.font } };
    case "art":      return { id: "art.open", args: {} };
    case "pattern":  return { id: "pattern.open", args: {} };
    case "contour":  return { id: "contour.open", args: {} };
    case "contour-triptych": return { id: "contour_triptych.open", args: {} };
    case "companion": return { id: "companion.open", args: {} };
    case "command":  return { id: open.id, args: open.args ?? {} };
  }
}

function isFiglet(sw: SceneWindow): boolean {
  return sw.open.type === "figlet";
}

/** Get all known window IDs from state */
function getWindowIds(state: any): Set<number> {
  return new Set((state.windows ?? []).map((w: any) => w.id));
}

/** Find the new window ID by diffing state before/after an open */
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

  // Track role
  roleMap.set(sw.role, newId);

  // Position: for figlets, keep measured size, only move.
  // For everything else, apply full layout rect.
  const rect = resolveLayout(sw.layout, bounds);

  if (isFiglet(sw)) {
    // Figlet already self-sized to content. Just move to layout position.
    const win = afterState.windows.find((w: any) => w.id === newId);
    const w = win?.width ?? rect.w;
    const h = win?.height ?? rect.h;
    // Center figlet within the layout rect if it's smaller
    const x = w < rect.w ? rect.x + Math.round((rect.w - w) / 2) : rect.x;
    await batchOps([{ id: newId, x, y: rect.y, w, h }]);
  } else {
    await batchOps([{ id: newId, x: rect.x, y: rect.y, w: rect.w, h: rect.h }]);
  }
}

// ---------------------------------------------------------------------------
// Scene execution
// ---------------------------------------------------------------------------

async function executeScene(sceneName: string): Promise<void> {
  const scene = tl.file.scenes[sceneName];
  if (!scene) return;

  const state = await getState();
  const agentIds = new Set(
    state.windows.filter((w: any) => w.appType === "wibwob-agent").map((w: any) => w.id)
  );

  if (scene.theme) await runCommand("theme.set", { name: scene.theme });

  // Close non-agent windows
  const closeOps = state.windows
    .filter((w: any) => !agentIds.has(w.id))
    .map((w: any) => ({ id: w.id, close: true }));
  if (closeOps.length > 0) await batchOps(closeOps);

  // Clear role map — scene is a full reset
  roleMap.clear();

  // Open and position each window one at a time
  const bounds: DesktopBounds = { width: state.screen.width, height: state.screen.height, topInset: 1, bottomInset: 1 };
  for (const sw of scene.windows) {
    await openAndPosition(sw, bounds);
  }
}

async function executePatch(patch: any): Promise<void> {
  if (patch.theme) await runCommand("theme.set", { name: patch.theme });

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
    const bounds: DesktopBounds = { width: state.screen.width, height: state.screen.height, topInset: 1, bottomInset: 1 };
    for (const sw of patch.set) {
      await openAndPosition(sw, bounds);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`📹 Timeline Capture: "${tl.file.title}" (${tl.file.duration}s, ${tl.cues.length} cues)`);
  console.log(`📁 Output: ${captureDir}\n`);

  // Verify app
  try { await getState(); } catch {
    console.error("❌ Cannot connect to WibWob-DOS at", API);
    process.exit(1);
  }

  // Resolve primer paths
  const primers = await fetchPrimerList();
  if (primers.length > 0) {
    const index = buildFilenameIndex(primers);
    rewritePrimerPaths(index);
    console.log(`🗂 Primer index: ${index.size} entries`);
  }

  // Start audio
  let audioProc: ReturnType<typeof spawn> | null = null;
  if (!noAudio && fs.existsSync(tl.file.track)) {
    audioProc = spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", tl.file.track], { stdio: "ignore" });
    console.log(`🎵 Audio: ${tl.file.track}`);
  }

  const startTime = Date.now();
  console.log(`⏱ Start: ${new Date().toISOString()}\n`);

  // Log header
  logEntry({ type: "header", title: tl.file.title, track: tl.file.track, duration: tl.file.duration, cueCount: tl.cues.length, startTime: new Date().toISOString() });

  // Execute cues with capture after each
  for (let i = 0; i < tl.cues.length; i++) {
    const rc = tl.cues[i];
    const delayMs = rc.t * 1000;
    const elapsed = Date.now() - startTime;
    const wait = Math.max(0, delayMs - elapsed);
    if (wait > 0) await Bun.sleep(wait);

    const actualElapsed = Date.now() - startTime;
    const cue = rc.cue;

    // Execute
    if ("scene" in cue) {
      await executeScene(cue.scene);
    } else if ("patch" in cue) {
      await executePatch(cue.patch);
    } else if ("command" in cue) {
      await runCommand(cue.command.id, cue.command.args);
    }

    // Capture
    await captureBar(i, rc.t, cue, actualElapsed);
  }

  // Final capture after all cues
  await Bun.sleep(500);
  console.log(`\n■ Done. Captures in: ${captureDir}`);
  console.log(`  ${tl.cues.length} cues captured to capture-log.jsonl`);

  if (audioProc) try { audioProc.kill(); } catch {}

  // Summary
  logEntry({ type: "footer", endTime: new Date().toISOString(), totalCues: tl.cues.length });
}

main().catch((e) => { console.error(e); process.exit(1); });
