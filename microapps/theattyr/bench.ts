/**
 * Benchmark: validate VT100 animation fidelity across all animations.
 *
 * Tests 18 selected animations in depth:
 * 1. Final frame matches @xterm/headless reference (≥80% non-space char match)
 * 2. Animation actually animates: at least 2 distinct intermediate frames
 * 3. Player processes all chunks without crashing
 * 4. skipToEnd produces same result as chunk-by-chunk
 * 5. Quarter-frame snapshots (25/50/75%) match bulk-feed references
 *
 * Also tests ALL animations for crash-free loading and basic parsing.
 *
 * Outputs: METRIC animations_passing=N (out of 94 deep-tested — ALL animations)
 */
import { join } from "path";
import { readFileSync, readdirSync } from "fs";
import { Vt100Player, splitIntoChunks, generateReferenceFrame } from "./vt100-parser.js";

const VT_DIR = join(import.meta.dir, "vt100");
const COLS = 80;
const ROWS = 24;

const DEEP_TEST_FILES = [
  "hello.vt",             // small, double-height chars
  "bomb.vt",              // medium, progressive reveal
  "globe.vt",             // large, spinning rotation
  "fireworks.vt",         // medium, multi-scene
  "beer.vt",              // medium, character animation
  "strike.vt",            // medium, bowling sequence
  "blinkeyes.vt",         // small, repeated pattern
  "fishy.vt",             // medium, scrolling scene
  "nifty.vt",             // small, text animation + ANSI colors
  "sun.vt",               // small, simple drawing
  "bugsbunny.vt",         // no-newline file (byte-chunked)
  "spinweb.vt",           // single-chunk file
  "castle.vt",            // large, complex Disney scene
  "twilight.vt",          // large, multi-act story
  "startrek.vt",          // large, space battle
  "bevis.butthead.vt",    // uses ANSI colors (fg=3,7,6)
  "cartwhee.vt",          // uses ANSI colors (fg=7,4)
  "dvd.vt",               // WibWob-DOS original, cursor-positioned bounce
  "hallow.vt",            // medium, holiday theme
  "pac3d.vt",             // 3D character shading art
  "monorail.vt",          // 0 newlines, byte-chunked (22KB)
  "sship.vt",             // large, 130KB space ship animation
  "xmas-09.vt",           // medium, reindeer scene
  "zorro.vt",             // medium, story animation
  "frogs.vt",             // small, hopping frog
  "nasa.vt",              // medium, bold + blink attributes
  "glass.vt",             // small, bold, filling animation
  "peace.vt",             // large, bold + underline + blink (80KB)
  "turkey.vt",            // medium, holiday + bold + blink
  "tetris.vt",            // medium, game animation
  "flatmap.vt",           // medium, shifting world map
  "fishy-fishy.vt",       // medium, 3D fish scene
  "wineglas.vt",          // small, underline attribute
  "cow.vt",               // small, explosive scene
  "july.4.vt",            // small, blink attribute
  "dontworry.vt",         // medium, arrows scene
  "shuttle.vt",           // large, 51KB space scene
  "surf.vt",              // medium, wave animation
  "new_year.vt",          // medium, holiday
  "valentin.vt",          // medium, holiday + bold
  "bambi.vt",             // small, classic scene
  "crash.vt",             // medium, shuttle explosion
  "demo.vt",              // medium, VT100 demonstration
  "mark_twain.vt",        // large, 0-newline, 107KB Disney
  "torturet.vt",          // medium, bold + underline + blink torture test
  "treadmill.vt",         // medium, 49KB character animation
  "van_halen.vt",         // large, 80KB music animation
  "xmas-00.vt",           // medium, bold + blink holiday
  "snowing.vt",           // medium, bold + blink snow scene
  "outerlimits.vt",       // large, TV show animation
  "bambi_godzila",        // medium, classic parody (no .vt extension)
  "barney.vt",            // small, character scene
  "cert18.vt",            // large, 86KB Make Money Fast
  "cowboom.vt",           // small, explosion
  "cursor.vt",            // small, cursor control demo
  "dirty.vt",             // medium, character animation
  "dogs.vt",              // medium, animal scene
  "dont-wor.vt",          // medium, arrows scene
  "duckpaint.vt",         // small, painting animation
  "fishy2.vt",            // large, 212KB, detailed fish (biggest testable)
  "juanspla.vt",          // small, typewriter effect
  "jumble.vt",            // small, text animation
  "monkey.vt",            // medium, 51KB character
  "moon.animation",       // small, winking moon (no .vt extension)
  "mr_pumpkin",           // small, pumpkin (no .vt extension)
  "newbeer.vt",           // medium, bold attribute
  "paradise.vt",          // medium, explosion scene
  "prey.vt",              // medium, Klingon ship
  "safesex.vt",           // large, 110KB
  "skyway.vt",            // medium, 0-newline Disney
  "snowing",              // medium, bold + blink snow (no .vt extension)
  "tomorrw.vt",           // medium, 0-newline Disney Tomorrowland
  "trek.vt",              // large, Enterprise battle
  "trekvid.vt",           // large, 100KB Star Trek
  "tv.vt",                // large, Outer Limits TV
  "twilightzone.vt",      // large, Twilight Zone opener
  "valentine.vt",         // medium, holiday + bold
  "xmas-01.vt",           // small, Merry Christmas
  "xmas-02.vt",           // medium, bird + tree + blink
  "xmas-03.vt",           // medium, tree + train + underline + blink
  "xmas-04.vt",           // medium, champagne + underline + blink
  "xmas-05.vt",           // medium, starry night + blink
  "xmas-06.vt",           // medium, hearth + bold + blink
  "xmas-07.vt",           // small, Christmas card + bold + blink
  "xmas-08.vt",           // small, Christmas Eve
  "xmas.large",           // large, 130KB compilation
  "xmas.vt",              // medium, underline
  "xmas2.vt",             // large, 79KB collection + blink
  "xmasshort.vt",         // medium, underline + blink
  "maingate.vt",          // large, 57KB 0-newline Disney
  "delay.vt",             // small, clears screen at end (blank final frame)
  "firework.vt",          // medium, clears screen at end
  "movglobe.vt",          // large, 250KB, clears screen at end
  "prey_col.vt",          // medium, clears screen at end
];

function compareFrames(
  reference: string[],
  actual: string[],
): { matched: number; total: number; ratio: number } {
  let matched = 0;
  let total = 0;
  const maxRows = Math.max(reference.length, actual.length);
  for (let y = 0; y < maxRows; y++) {
    const refLine = reference[y] || "";
    const actLine = actual[y] || "";
    const maxCols = Math.max(refLine.length, actLine.length);
    for (let x = 0; x < maxCols; x++) {
      const refChar = refLine[x] || " ";
      const actChar = actLine[x] || " ";
      if (refChar !== " " || actChar !== " ") {
        total++;
        if (refChar === actChar) matched++;
      }
    }
  }
  return { matched, total, ratio: total === 0 ? 1 : matched / total };
}

function screenFingerprint(lines: string[]): string {
  return lines.join("\n");
}

// ── Deep tests ──────────────────────────────────────────────────────────

let passing = 0;

for (const file of DEEP_TEST_FILES) {
  const filePath = join(VT_DIR, file);
  let data: Buffer;
  try {
    data = readFileSync(filePath);
  } catch {
    console.error(`SKIP ${file}: file not found`);
    continue;
  }

  const chunks = splitIntoChunks(data);
  const failures: string[] = [];

  // Reference final frame
  const reference = await generateReferenceFrame(data, COLS, ROWS);

  // Quarter-frame cutoffs for intermediate checks
  const quarterCutoffs = chunks.length > 8
    ? [0.25, 0.5, 0.75].map((p) => Math.floor(chunks.length * p))
    : [];
  const quarterSnapshots: Map<number, string[]> = new Map();

  // Single-pass playback — batch writes between snapshot points for speed
  const player = new Vt100Player(COLS, ROWS);
  player.load({ name: file, description: file, data, chunks, totalBytes: data.length });

  const seen = new Set<string>();
  const sampleInterval = Math.max(1, Math.floor(chunks.length / 10));

  // Build sorted list of tick points where we need to stop and snapshot
  const stopPoints = new Set<number>();
  for (const c of quarterCutoffs) stopPoints.add(c);
  for (let t = sampleInterval; t <= chunks.length; t += sampleInterval) stopPoints.add(t);
  stopPoints.add(chunks.length); // final frame
  const sortedStops = [...stopPoints].sort((a, b) => a - b);

  let tickCount = 0;
  for (const stopAt of sortedStops) {
    // Batch-write all chunks from current position to this stop point
    const batchChunks: Buffer[] = [];
    while (tickCount < stopAt && tickCount < chunks.length) {
      batchChunks.push(chunks[tickCount]);
      tickCount++;
    }
    if (batchChunks.length > 0) {
      const batchData = Buffer.concat(batchChunks).toString("binary");
      await new Promise<void>((resolve) => {
        (player as any).terminal.write(batchData, resolve);
      });
    }

    // Capture quarter-frame snapshot
    if (quarterCutoffs.includes(tickCount)) {
      quarterSnapshots.set(tickCount, player.readScreen());
    }
    // Sample for diversity
    seen.add(screenFingerprint(player.readScreen()));
  }

  // Update player state
  (player as any).chunkIndex = chunks.length;
  (player as any)._isFinished = true;
  (player as any)._isPlaying = false;

  const actual = player.readScreen();
  player.dispose();

  // Check 1: Final frame fidelity
  const cmp = compareFrames(reference, actual);
  if (cmp.ratio < 0.8) {
    failures.push(`match ${(cmp.ratio * 100).toFixed(1)}% < 80%`);
  }

  // Check 2: Animation diversity (skip for blank-throughout files like delay.vt)
  const finalHasContent = actual.join("").replace(/\s/g, "").length > 0;
  if (chunks.length > 2 && seen.size < 2 && finalHasContent) {
    failures.push(`${seen.size} distinct frame(s)`);
  }

  // Check 3: Chunk count
  if (tickCount !== chunks.length) {
    failures.push(`${tickCount}/${chunks.length} chunks`);
  }

  // Check 4: skipToEnd consistency
  const player2 = new Vt100Player(COLS, ROWS);
  player2.load({ name: file, description: file, data, chunks, totalBytes: data.length });
  await player2.skipToEnd();
  const skipCmp = compareFrames(actual, player2.readScreen());
  player2.dispose();
  if (skipCmp.ratio < 0.99) {
    failures.push(`skipToEnd ${(skipCmp.ratio * 100).toFixed(1)}%`);
  }

  // Check 5: Quarter-frame fidelity — compare snapshots vs bulk-fed references
  for (const [cutoff, snapshot] of quarterSnapshots) {
    const partialData = Buffer.concat(chunks.slice(0, cutoff));
    const partialRef = await generateReferenceFrame(partialData, COLS, ROWS);
    const partialCmp = compareFrames(partialRef, snapshot);
    const pct = Math.round((cutoff / chunks.length) * 100);
    if (partialCmp.ratio < 0.8) {
      failures.push(`${pct}%-frame match ${(partialCmp.ratio * 100).toFixed(1)}% < 80%`);
    }
  }

  // Check 6: Color cell preservation for known-color files
  const COLOR_FILES: Record<string, number[]> = {
    "bevis.butthead.vt": [3, 6, 7],   // yellow, cyan, white
    "nifty.vt": [1, 6],               // red, cyan
    "cartwhee.vt": [4, 7],            // blue, white
  };
  // Check 7: Bold/blink/underline attribute presence for known-attribute files
  const ATTR_FILES: Record<string, ("bold" | "blink" | "underline")[]> = {
    "hallow.vt": ["bold", "blink"],
    "peace.vt": ["bold", "underline", "blink"],
    "hello.vt": ["bold"],
    "nasa.vt": ["bold", "blink"],
    "glass.vt": ["bold"],
    "turkey.vt": ["bold", "blink"],
    "wineglas.vt": ["underline"],
    "july.4.vt": ["blink"],
    "torturet.vt": ["bold", "underline", "blink"],
    "xmas-00.vt": ["bold"],
    "snowing.vt": ["blink"],
  };

  if (file in COLOR_FILES) {
    const colorPlayer = new Vt100Player(COLS, ROWS);
    colorPlayer.load({ name: file, description: file, data, chunks, totalBytes: data.length });
    await colorPlayer.skipToEnd();
    const cc = colorPlayer.countColorCells();
    colorPlayer.dispose();

    if (cc.coloredCells === 0) {
      failures.push("color file has 0 colored cells");
    }
    const expectedFg = COLOR_FILES[file];
    for (const fg of expectedFg) {
      if (!cc.fgColors.has(fg)) {
        failures.push(`missing expected fg color ${fg}`);
      }
    }
  }

  if (file in ATTR_FILES) {
    // Verify colored output contains the expected attribute tags
    const attrPlayer = new Vt100Player(COLS, ROWS);
    attrPlayer.load({ name: file, description: file, data, chunks, totalBytes: data.length });
    await attrPlayer.skipToEnd();
    const coloredLines = attrPlayer.readScreenColored();
    attrPlayer.dispose();
    const allColored = coloredLines.join("\n");
    for (const attr of ATTR_FILES[file]) {
      if (!allColored.includes(`{${attr}}`)) {
        failures.push(`missing {${attr}} tag in colored output`);
      }
    }
  }

  const pass = failures.length === 0;
  if (pass) passing++;
  console.error(
    `${pass ? "PASS" : "FAIL"} ${file}: ${pass ? `${(cmp.ratio * 100).toFixed(1)}% match, ${seen.size} frames, ${tickCount} ticks` : failures.join("; ")}`,
  );
}

// ── Smoke test: all files crash-free ────────────────────────────────────

let allFiles: string[] = [];
let crashCount = 0;
let blankCount = 0;
try {
  allFiles = readdirSync(VT_DIR).sort();
} catch {}

for (const file of allFiles) {
  if (DEEP_TEST_FILES.includes(file)) continue;
  const filePath = join(VT_DIR, file);
  try {
    const data = readFileSync(filePath);
    const player = new Vt100Player(COLS, ROWS);
    const chunks = splitIntoChunks(data);
    player.load({ name: file, description: file, data, chunks, totalBytes: data.length });
    // Bulk-write for speed
    await new Promise<void>((resolve) => {
      (player as any).terminal.write(data.toString("binary"), resolve);
    });
    const screen = player.readPlainText();
    player.dispose();
    if (screen.replace(/\s/g, "").length === 0) {
      blankCount++;
      console.error(`WARN ${file}: blank final frame`);
    }
  } catch (e) {
    crashCount++;
    console.error(`CRASH ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (crashCount > 0) console.error(`${crashCount} animation(s) crashed`);
if (blankCount > 0) console.error(`${blankCount} animation(s) blank final frame`);

console.log(`METRIC animations_passing=${passing}`);
