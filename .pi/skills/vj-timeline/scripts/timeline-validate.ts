#!/usr/bin/env bun
/**
 * Validate a timeline file and print resolved cue schedule.
 * Usage: bun run scripts/timeline-validate.ts <timeline.json>
 */

import { parseTimeline } from "../src/services/timeline-service.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: bun run scripts/timeline-validate.ts <timeline.json>");
  process.exit(1);
}

const result = parseTimeline(file);

if (!result.ok) {
  console.error("❌ Validation failed:\n");
  for (const err of result.errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
}

const tl = result.timeline!;
console.log(`✅ Valid timeline: "${tl.file.title}"`);
console.log(`   Track:    ${tl.file.track}`);
console.log(`   Duration: ${tl.file.duration}s`);
console.log(`   Scenes:   ${Object.keys(tl.file.scenes).length}`);
console.log(`   Cues:     ${tl.cues.length}`);
if (tl.file.palette) {
  console.log(`   Palette:  ${tl.file.palette.length} primers`);
}
if (tl.beatMap) {
  console.log(`   Beat map: ${tl.beatMap.bpm} BPM, ${tl.beatMap.beats.length} beats, ${tl.beatMap.sections.length} sections`);
}

console.log("\n   Cue schedule:");
for (let i = 0; i < tl.cues.length; i++) {
  const rc = tl.cues[i];
  const cue = rc.cue;
  const time = rc.t.toFixed(1).padStart(6);
  let desc: string;
  if ("scene" in cue) {
    desc = `SCENE → ${cue.scene}`;
  } else if ("patch" in cue) {
    const parts: string[] = [];
    if (cue.patch.theme) parts.push(`theme:${cue.patch.theme}`);
    if (cue.patch.set) parts.push(`+${cue.patch.set.length} windows`);
    if (cue.patch.close) parts.push(`-${cue.patch.close.length} roles`);
    desc = `PATCH: ${parts.join(", ")}`;
  } else {
    desc = `CMD: ${cue.command.id}`;
  }
  console.log(`   ${time}s  ${desc}`);
}
