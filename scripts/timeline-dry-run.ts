#!/usr/bin/env bun
/**
 * Dry-run a timeline: resolve all cues and print the execution plan
 * including scene diffs against a mock desktop state.
 *
 * Usage: bun run scripts/timeline-dry-run.ts <timeline.json> [width] [height]
 */

import { parseTimeline } from "../src/services/timeline-service.js";
import { planSceneTransition } from "../src/services/scene-planner.js";
import { resolveLayout } from "../src/services/scene-layout.js";
import type { DesktopState } from "../src/core/types.js";

const file = process.argv[2];
const width = parseInt(process.argv[3] || "200", 10);
const height = parseInt(process.argv[4] || "60", 10);

if (!file) {
  console.error("Usage: bun run scripts/timeline-dry-run.ts <timeline.json> [width] [height]");
  process.exit(1);
}

const result = parseTimeline(file);
if (!result.ok) {
  console.error("❌ Validation failed:");
  for (const err of result.errors) console.error(`  • ${err}`);
  process.exit(1);
}

const tl = result.timeline!;
const bounds = { width, height, topInset: 1, bottomInset: 1 };

console.log(`Dry run: "${tl.file.title}"  desktop: ${width}x${height}\n`);

// Simulate empty desktop (only agent window)
let mockState: DesktopState = {
  timestamp: new Date().toISOString(),
  app: { name: "wibwob-dos", mode: "normal", cwd: ".", statePath: "", theme: "wibwob-dark" },
  screen: { width, height, cellAspect: 2.0, openWindowCount: 1 },
  focus: {},
  menu: { open: false },
  windows: [{
    id: 1, kind: "chat", appType: "wibwob-agent", title: "Wib&Wob Agent",
    left: width - 80, top: 0, width: 80, height: 50, zIndex: 0, focused: true, maximized: false,
    details: { appType: "wibwob-agent", summary: "Agent" },
  }],
};

for (let i = 0; i < tl.cues.length; i++) {
  const rc = tl.cues[i];
  const cue = rc.cue;
  const time = rc.t.toFixed(1).padStart(6);

  console.log(`━━━ T=${time}s ━━━`);

  if ("scene" in cue) {
    const scene = tl.file.scenes[cue.scene];
    console.log(`  SCENE: ${cue.scene} (${scene.windows.length} windows, theme: ${scene.theme ?? "unchanged"})`);
    const ops = planSceneTransition(mockState, scene, bounds, {
      protect: tl.file.options?.protect ?? ["agent"],
    });
    for (const op of ops) {
      switch (op.type) {
        case "theme":
          console.log(`    theme → ${op.name}`);
          break;
        case "close":
          console.log(`    close window #${op.windowId}`);
          break;
        case "open":
          console.log(`    open [${op.role}] at (${op.rect.x},${op.rect.y}) ${op.rect.w}x${op.rect.h}`);
          break;
        case "move":
          console.log(`    move [${op.role}] #${op.windowId} → (${op.rect.x},${op.rect.y}) ${op.rect.w}x${op.rect.h}`);
          break;
        case "command":
          console.log(`    cmd: ${op.id}`);
          break;
      }
    }
    // Update mock state for next cue (simplified)
    if (scene.theme) {
      mockState = { ...mockState, app: { ...mockState.app, theme: scene.theme } };
    }
  } else if ("patch" in cue) {
    const p = cue.patch;
    console.log(`  PATCH:`);
    if (p.theme) console.log(`    theme → ${p.theme}`);
    if (p.close) console.log(`    close roles: ${p.close.join(", ")}`);
    if (p.set) {
      for (const sw of p.set) {
        const rect = resolveLayout(sw.layout, bounds);
        console.log(`    set [${sw.role}] at (${rect.x},${rect.y}) ${rect.w}x${rect.h}`);
      }
    }
  } else if ("command" in cue) {
    console.log(`  CMD: ${cue.command.id} ${JSON.stringify(cue.command.args ?? {})}`);
  }
}

console.log(`\n━━━ END (${tl.file.duration}s) ━━━`);
