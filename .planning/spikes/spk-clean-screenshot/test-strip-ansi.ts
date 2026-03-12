/**
 * Standalone test: fetch raw screenshot from live app, apply strip functions,
 * save before/after to test-captures/.
 *
 * Run from the WORKTREE so it picks up the new strip-ansi module:
 *   cd ../wibandwob-dos-spike-clean-screenshot
 *   bun run ../.planning/spikes/spk-clean-screenshot/test-strip-ansi.ts
 *
 * Or from main tree pointing at worktree:
 *   bun run .planning/spikes/spk-clean-screenshot/test-strip-ansi.ts
 */

import { stripAnsi, stripBlessedChrome } from "/Users/james/Repos/wibandwob-dos-spike-clean-screenshot/src/services/strip-ansi.ts";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8099";
const OUT = path.join(import.meta.dir, "test-captures");
fs.mkdirSync(OUT, { recursive: true });

async function capture(label: string, url: string) {
  console.log(`\n── ${label} ──`);
  const res = await fetch(url);
  const raw = await res.text();

  const stripped = stripAnsi(raw);
  const clean = stripBlessedChrome(raw);

  fs.writeFileSync(path.join(OUT, `${label}-raw.txt`), raw);
  fs.writeFileSync(path.join(OUT, `${label}-strip-ansi.txt`), stripped);
  fs.writeFileSync(path.join(OUT, `${label}-clean.txt`), clean);

  console.log(`  raw:        ${raw.length} bytes, ${raw.split("\n").length} lines`);
  console.log(`  stripAnsi:  ${stripped.length} bytes`);
  console.log(`  clean:      ${clean.length} bytes`);
  console.log(`  preview (clean, first 5 lines):`);
  clean.split("\n").slice(0, 5).forEach(l => console.log(`    ${l}`));
}

// Full screen
await capture("fullscreen", `${BASE}/screenshot/text`);

// Get window IDs from state
const state = await (await fetch(`${BASE}/state`)).json() as any;
for (const w of state.windows) {
  await capture(`window-${w.id}-${w.kind}`, `${BASE}/screenshot/text?id=${w.id}`);
}

// Also test captureText via /windows/text for comparison
console.log("\n── captureText comparison ──");
for (const w of state.windows) {
  const res = await (await fetch(`${BASE}/windows/text?id=${w.id}`)).json() as any;
  const file = path.join(OUT, `window-${w.id}-captureText.txt`);
  if (res.ok && res.text) {
    fs.writeFileSync(file, res.text);
    console.log(`  window ${w.id} (${w.kind}): ${res.text.length} bytes → ${file}`);
  } else {
    console.log(`  window ${w.id} (${w.kind}): no captureText available`);
  }
}

console.log(`\nAll captures saved to ${OUT}`);
