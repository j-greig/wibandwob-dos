#!/usr/bin/env bun
/**
 * Review a timeline capture — compare expected vs actual for each cue.
 *
 * Usage: bun run scripts/timeline-review.ts <capture-dir>
 *
 * Reads the capture-log.jsonl and state files, then prints a report
 * showing what SHOULD have been on screen vs what WAS on screen.
 */

import fs from "node:fs";
import path from "node:path";

const captureDir = process.argv[2];

if (!captureDir || !fs.existsSync(captureDir)) {
  console.error("Usage: bun run scripts/timeline-review.ts <capture-dir>");
  console.error("\nAvailable captures:");
  const base = "scratch/timeline-captures";
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      console.error(`  ${base}/${d}`);
    }
  }
  process.exit(1);
}

const logPath = path.join(captureDir, "capture-log.jsonl");
if (!fs.existsSync(logPath)) {
  console.error(`❌ No capture-log.jsonl in ${captureDir}`);
  process.exit(1);
}

// Read the timeline used
const tlPath = path.join(captureDir, "timeline.json");
const timeline = fs.existsSync(tlPath) ? JSON.parse(fs.readFileSync(tlPath, "utf8")) : null;

// Parse log
const entries = fs.readFileSync(logPath, "utf8")
  .trim()
  .split("\n")
  .map(line => JSON.parse(line))
  .filter(e => e.cueIndex !== undefined);

console.log(`\n📋 Timeline Review: ${captureDir}`);
if (timeline) {
  console.log(`   Title: ${timeline.title}`);
  console.log(`   Track: ${timeline.track}`);
  console.log(`   Duration: ${timeline.duration}s`);
}
console.log(`   Cues captured: ${entries.length}\n`);

// ---------------------------------------------------------------------------
// Review each cue
// ---------------------------------------------------------------------------

let issues = 0;

for (const entry of entries) {
  const t = entry.t?.toFixed(1) ?? "?";
  const idx = String(entry.cueIndex).padStart(2);
  const theme = entry.theme ?? "?";
  const winCount = entry.windowCount ?? "?";

  console.log(`━━━ Cue ${idx} @ T=${t}s ━━━`);
  console.log(`  Expected: ${entry.expected}`);
  console.log(`  Actual:   theme:${theme}  windows:${winCount}`);

  // Show window layout
  if (entry.windows) {
    for (const w of entry.windows) {
      const pos = `@${w.left},${w.top} ${w.width}x${w.height}`;
      console.log(`    ${w.appType?.padEnd(20) ?? "unknown".padEnd(20)} ${(w.title ?? "").slice(0, 30).padEnd(30)} ${pos}`);
    }
  }

  // Check for problems
  const problems: string[] = [];

  // Problem: figlet windows wider than 80% of any reasonable desktop
  if (entry.windows) {
    for (const w of entry.windows) {
      if (w.appType === "figlet-banner" && w.width > 150) {
        problems.push(`⚠ Figlet "${w.title?.slice(8, 30)}" is ${w.width} wide — probably too wide`);
      }
    }
  }

  // Problem: only 1 window (excluding agent) — too sparse
  const nonAgentWindows = (entry.windows ?? []).filter((w: any) => w.appType !== "wibwob-agent");
  if (nonAgentWindows.length < 2) {
    problems.push(`⚠ Only ${nonAgentWindows.length} non-agent window(s) — scene is sparse`);
  }

  // Problem: windows stacked at 0,0
  const atOrigin = (entry.windows ?? []).filter((w: any) => w.left === 0 && w.top === 0);
  if (atOrigin.length > 2) {
    problems.push(`⚠ ${atOrigin.length} windows at (0,0) — likely stacked/unpositioned`);
  }

  // Problem: expected theme vs actual
  if (entry.expected?.includes("theme:")) {
    const match = entry.expected.match(/theme:(\S+)/);
    if (match && match[1] !== theme) {
      problems.push(`❌ Theme mismatch: expected ${match[1]}, got ${theme}`);
    }
  }

  // Problem: timing drift
  if (entry.elapsedMs !== undefined && entry.t !== undefined) {
    const drift = Math.abs(entry.elapsedMs - entry.t * 1000);
    if (drift > 500) {
      problems.push(`⚠ Timing drift: ${drift.toFixed(0)}ms off target`);
    }
  }

  if (problems.length > 0) {
    issues += problems.length;
    for (const p of problems) {
      console.log(`  ${p}`);
    }
  }

  // Show text screenshot preview (first 3 non-empty lines)
  const textFile = path.join(captureDir, entry.textFile);
  if (fs.existsSync(textFile)) {
    const lines = fs.readFileSync(textFile, "utf8")
      .split("\n")
      .filter(l => l.trim().length > 0)
      .slice(1, 4); // skip menu bar
    if (lines.length > 0) {
      console.log(`  Preview:`);
      for (const l of lines) {
        console.log(`    ${l.slice(0, 80)}`);
      }
    }
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`━━━ Summary ━━━`);
console.log(`  Cues: ${entries.length}`);
console.log(`  Issues: ${issues}`);
if (issues === 0) {
  console.log(`  ✅ No issues detected`);
} else {
  console.log(`  ⚠ Review issues above`);
}

console.log(`\nFiles:`);
console.log(`  Text captures:  ${captureDir}/cue-*.txt`);
console.log(`  ANSI captures:  ${captureDir}/cue-*.ansi`);
console.log(`  State captures: ${captureDir}/cue-*_state.json`);
console.log(`  Capture log:    ${logPath}`);
