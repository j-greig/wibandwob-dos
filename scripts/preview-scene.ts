#!/usr/bin/env bun
/**
 * preview-scene — open a named scene from a timeline JSON and screenshot it.
 *
 * Usage:
 *   bun run scripts/preview-scene.ts <timeline.json> <scene-name>
 *   bun run scripts/preview-scene.ts <timeline.json> <scene-name> --patch <patch-index>
 *
 * Opens all windows for the scene (+ optional patch), positions them,
 * takes a screenshot, and prints the path.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const PORT = process.env.CONTROL_API_PORT ?? "8099";
const BASE = `http://127.0.0.1:${PORT}`;
const DISPLAY = process.env.DISPLAY_NUM ?? "2";
const PRIMER_BASE =
  process.env.PRIMER_BASE ??
  "/Users/james/Repos/wibandwob-dos/scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers";

const args = process.argv.slice(2);
const timelinePath = args[0];
const sceneName = args[1];

if (!timelinePath || !sceneName) {
  console.error("Usage: preview-scene.ts <timeline.json> <scene-name>");
  process.exit(1);
}

function api(method: string, path: string, body?: unknown) {
  const res = fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.then((r) => r.json()).catch(() => ({}));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolvePrimer(file: string): string {
  if (path.isAbsolute(file)) return file;
  return path.join(PRIMER_BASE, file);
}

async function run() {
  if (!existsSync(timelinePath)) {
    console.error(`Timeline not found: ${timelinePath}`);
    process.exit(1);
  }

  const tl = JSON.parse(readFileSync(timelinePath, "utf8"));
  const scenes: Record<string, any> = tl.scenes ?? {};
  const scene = scenes[sceneName];

  if (!scene) {
    console.error(
      `Scene "${sceneName}" not found. Available: ${Object.keys(scenes).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`\n▶  preview-scene: ${sceneName}`);
  console.log(`   Timeline: ${timelinePath}`);

  // Clear desktop
  await api("POST", "/commands/run", { id: "desktop.clear-all", args: {} });
  await sleep(400);

  // Set theme
  if (scene.theme) {
    await api("POST", "/commands/run", {
      id: "theme.set",
      args: { name: scene.theme },
    });
    await sleep(100);
  }

  // Open each window and collect IDs
  const windows: Array<{ role: string; layout: any; id?: number }> = [];

  for (const win of scene.windows ?? []) {
    const { open, layout, role } = win;
    let result: any = {};

    if (open.type === "primer") {
      const filePath = resolvePrimer(open.file);
      result = await api("POST", "/view/primer/open", { filePath });
    } else if (open.type === "figlet") {
      result = await api("POST", "/view/figlet/open", {
        text: open.text,
        font: open.font,
      });
    } else if (open.type === "art") {
      result = await api("POST", "/view/art/open", {});
    }

    await sleep(250);

    // Get the latest window ID from state
    const state: any = await api("GET", "/state");
    const nonAgent = (state.windows ?? []).filter(
      (w: any) => w.appType !== "wibwob-agent"
    );
    const latest = nonAgent[nonAgent.length - 1];
    if (latest) {
      windows.push({ role, layout, id: latest.id });
      console.log(`   opened [${role}] id=${latest.id}`);
    }
  }

  // Batch position all windows
  if (windows.length > 0) {
    const ops = windows
      .filter((w) => w.id && w.layout)
      .map((w) => ({
        id: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
      }));

    if (ops.length > 0) {
      await api("POST", "/windows/batch", { ops });
      await sleep(500);
    }
  }

  // Screenshot
  const outPath = `/tmp/preview-${sceneName}-${Date.now()}.png`;
  execSync(`screencapture -x -D ${DISPLAY} ${outPath}`);
  console.log(`\n   📸 ${outPath}\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
