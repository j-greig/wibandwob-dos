#!/usr/bin/env bun
/**
 * Scaffold a new timeline from a track file.
 *
 * Usage: bun run scripts/timeline-new.ts <track.mp3> [--name my-show]
 *
 * Does:
 *   1. Probes track duration via ffprobe
 *   2. Fetches available primers from running app
 *   3. Writes a starter timeline JSON with empty scenes and timing markers
 *   4. Prints next steps
 *
 * Gives the agent (or human) a valid skeleton to fill in.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const API = "http://127.0.0.1:8099";

const trackArg = process.argv[2];
const nameFlag = process.argv.indexOf("--name");
const name = nameFlag !== -1 ? process.argv[nameFlag + 1] : undefined;

if (!trackArg) {
  console.error("Usage: bun run scripts/timeline-new.ts <track.mp3> [--name my-show]");
  process.exit(1);
}

const trackPath = path.resolve(trackArg);
if (!fs.existsSync(trackPath)) {
  console.error(`❌ Track not found: ${trackPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Probe track
// ---------------------------------------------------------------------------

let duration = 60;
try {
  const out = execSync(`ffprobe "${trackPath}" -show_entries format=duration -v quiet -of csv="p=0"`, { encoding: "utf8" });
  duration = Math.round(parseFloat(out.trim()));
  console.log(`🎵 Track: ${path.basename(trackPath)} (${duration}s)`);
} catch {
  console.warn("⚠ ffprobe not available, defaulting to 60s duration");
}

// ---------------------------------------------------------------------------
// Fetch primers
// ---------------------------------------------------------------------------

let primerNames: string[] = [];
try {
  const res = await fetch(`${API}/commands/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "primer.list" }),
  });
  const data = await res.json() as any;
  primerNames = (data.result ?? [])
    .filter((p: any) => p.name.endsWith(".txt"))
    .map((p: any) => p.name);
  console.log(`🗂 ${primerNames.length} primers available`);
} catch {
  console.warn("⚠ App not running — primer list unavailable");
}

// ---------------------------------------------------------------------------
// Generate section markers
// ---------------------------------------------------------------------------

const barDuration = 2; // default 2s per bar
const totalBars = Math.floor(duration / barDuration);
const sections = [
  { name: "intro",  startT: 0,                        endT: Math.round(duration * 0.15) },
  { name: "build",  startT: Math.round(duration * 0.15), endT: Math.round(duration * 0.35) },
  { name: "drop",   startT: Math.round(duration * 0.35), endT: Math.round(duration * 0.6) },
  { name: "groove", startT: Math.round(duration * 0.6),  endT: Math.round(duration * 0.8) },
  { name: "outro",  startT: Math.round(duration * 0.8),  endT: duration },
];

// ---------------------------------------------------------------------------
// Build skeleton
// ---------------------------------------------------------------------------

const showName = name ?? path.basename(trackPath, path.extname(trackPath));
const outputPath = path.join("scratch", "timelines", `${showName}.json`);

const skeleton = {
  version: 1,
  title: showName,
  track: trackPath,
  duration,

  _comment_sections: "Estimated sections — adjust to match actual track structure",
  beatMap: {
    bpm: 120,
    key: "C minor",
    duration,
    beats: [] as any[],
    sections: sections.map(s => ({
      name: s.name,
      startBeat: Math.round(s.startT * 2),
      endBeat: Math.round(s.endT * 2),
      startT: s.startT,
      endT: s.endT,
    })),
  },

  _comment_palette: "Pick 6-10 primers that match the track mood. Use filenames only — runner resolves paths.",
  palette: [
    { name: "TODO", file: "PICK_A_PRIMER.txt", note: "why this primer fits" },
  ],

  _comment_scenes: "Define 4-6 scenes. Each is a complete desktop state.",
  scenes: {
    intro: {
      name: "intro",
      theme: "wibwob-dark",
      windows: [
        { role: "backdrop", open: { type: "primer", file: "PICK_A_PRIMER.txt" }, layout: "hero-left" },
        { role: "headline", open: { type: "figlet", text: showName.toUpperCase(), font: "slant" }, layout: "top-right-corner" },
      ],
    },
    drop: {
      name: "drop",
      theme: "wibwob-phosphor",
      windows: [
        { role: "backdrop", open: { type: "primer", file: "PICK_A_PRIMER.txt" }, layout: "backdrop" },
        { role: "headline", open: { type: "figlet", text: "DROP", font: "banner" }, layout: "top-right-corner" },
        { role: "lyric",    open: { type: "figlet", text: "WORDS HERE", font: "small" }, layout: "lyric-bar" },
      ],
    },
    finale: {
      name: "finale",
      theme: "wibwob-dark",
      windows: [
        { role: "backdrop", open: { type: "primer", file: "PICK_A_PRIMER.txt" }, layout: "hero-center" },
        { role: "closing",  open: { type: "figlet", text: "END", font: "small" }, layout: "lyric-bar" },
      ],
    },
  },

  _comment_cues: `Cues fire at exact times. Need 40-60 for a ${duration}s track. One per bar minimum.`,
  cues: [
    { at: { t: 0 }, scene: "intro" },
    { at: { t: sections[2].startT }, scene: "drop" },
    { at: { t: sections[4].startT }, scene: "finale" },
  ],

  options: {
    protect: ["agent"],
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));

console.log(`\n✅ Skeleton written: ${outputPath}`);
console.log(`\nNext steps:`);
console.log(`  1. Edit ${outputPath}`);
console.log(`  2. Fill in palette with real primer filenames`);
console.log(`  3. Define scenes for each section`);
console.log(`  4. Add 40-60 cues (patches between scenes for density)`);
console.log(`  5. Validate: bun run scripts/timeline-validate.ts ${outputPath}`);
console.log(`  6. Dry-run:  bun run scripts/timeline-dry-run.ts ${outputPath}`);
console.log(`  7. Capture:  bun run scripts/timeline-capture.ts ${outputPath}`);
if (primerNames.length > 0) {
  console.log(`\nSample primers for palette:`);
  // Pick 10 random ones
  const shuffled = primerNames.sort(() => Math.random() - 0.5).slice(0, 10);
  for (const p of shuffled) {
    console.log(`  - ${p}`);
  }
}
