#!/usr/bin/env bun
/**
 * VT100 segment extractor — extract frame ranges from .vt animation files.
 *
 * Usage:
 *   bun run microapps/theattyr/scripts/extract-segment.ts <file.vt> <start%> <end%> [flags]
 *
 * Flags:
 *   --output <path>  Write to file instead of stdout
 *   --ansi           Include ANSI SGR escape codes (inverse → ESC[30;47m)
 *   --blocks         Render inverse-video regions as ░ block characters (primer-safe)
 *   --boxify         Wrap inverse-video regions in Unicode box-drawing (┌─┐│└─┘)
 *   --scan           Show all text content with chunk positions (no extraction)
 *
 * Examples:
 *   bun run microapps/theattyr/scripts/extract-segment.ts van_halen.vt --scan
 *   bun run microapps/theattyr/scripts/extract-segment.ts van_halen.vt 46 56 --blocks
 *   bun run microapps/theattyr/scripts/extract-segment.ts van_halen.vt 46 56 --boxify
 *   bun run microapps/theattyr/scripts/extract-segment.ts prey_col.vt 20 80 --ansi
 */
import { Vt100Player, splitIntoChunks } from "../vt100-parser.js";
import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const VT_DIR = join(import.meta.dir, "..", "vt100");
const args = process.argv.slice(2);
const filename = args[0];
if (!filename) {
  console.error(
    "Usage: extract-segment.ts <file.vt> <start%> <end%> [--output path] [--ansi|--blocks|--boxify] [--scan]",
  );
  process.exit(1);
}

const scanMode = args.includes("--scan");
const ansiMode = args.includes("--ansi");
const blocksMode = args.includes("--blocks");
const boxifyMode = args.includes("--boxify");
const blessedMode = args.includes("--blessed");
const outputIdx = args.indexOf("--output");
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

const filePath = filename.includes("/") ? resolve(filename) : join(VT_DIR, filename);
const data = readFileSync(filePath);
const chunks = splitIntoChunks(data);
console.error(`${filename}: ${chunks.length} chunks, ${data.length} bytes`);

// ── Scan mode ───────────────────────────────────────────────────────────

async function scan() {
  const player = new Vt100Player(80, 24);
  player.load({ name: filename!, description: "", data, chunks, totalBytes: data.length });
  let prevContent = "";
  for (let i = 0; i < chunks.length; i++) {
    await player.tickAsync();
    if (i % 3 !== 0) continue;
    const lines = player.readScreen();
    const contentLines = lines.filter((l) => l.trim().length > 3);
    if (contentLines.length === 0) continue;
    const content = contentLines.map((l) => l.trim()).join(" | ");
    if (content !== prevContent) {
      console.log(`${Math.round((i / chunks.length) * 100)}% (chunk ${i}): ${content.substring(0, 100)}`);
      prevContent = content;
    }
  }
  player.dispose();
}

// ── Frame extraction ────────────────────────────────────────────────────

function readFrame(player: Vt100Player): string {
  const terminal = (player as any).terminal;
  const buf = terminal.buffer.active;
  const rows = terminal.rows as number;
  const cols = terminal.cols as number;

  if (ansiMode) {
    // Emit ANSI codes — convert inverse to explicit bg/fg
    const lines: string[] = [];
    const BOX_ON = "\x1b[30;47m"; // black on white
    const RESET = "\x1b[0m";
    for (let y = 0; y < rows; y++) {
      const line = buf.getLine(y);
      if (!line) { lines.push(""); continue; }
      let result = "";
      let inBox = false;
      for (let x = 0; x < cols; x++) {
        const cell = line.getCell(x);
        if (!cell) { result += " "; continue; }
        const ch = cell.getChars() || " ";
        const inv = cell.isInverse() !== 0;
        const hasFg = cell.getFgColorMode() !== 0;
        const hasBg = cell.getBgColorMode() !== 0;
        const bold = cell.isBold() !== 0;

        if (inv && !inBox) { result += BOX_ON; inBox = true; }
        else if (!inv && inBox) { result += RESET; inBox = false; }

        // Non-inverse color
        if (!inv && (hasFg || hasBg || bold)) {
          const params: number[] = [];
          if (bold) params.push(1);
          if (hasFg) params.push(30 + cell.getFgColor());
          if (hasBg) params.push(40 + cell.getBgColor());
          result += `\x1b[${params.join(";")}m`;
          result += ch;
          result += RESET;
          continue;
        }
        result += ch;
      }
      if (inBox) result += RESET;
      lines.push(result);
    }
    return lines.join("\n");
  }

  if (blessedMode) {
    // Emit blessed tags — primer viewer with tags:true can render these
    const lines: string[] = [];
    for (let y = 0; y < rows; y++) {
      const line = buf.getLine(y);
      if (!line) { lines.push(""); continue; }
      let result = "";
      let inInv = false;
      for (let x = 0; x < cols; x++) {
        const cell = line.getCell(x);
        if (!cell) { result += " "; continue; }
        const ch = cell.getChars() || " ";
        const inv = cell.isInverse() !== 0;
        if (inv && !inInv) { result += "{white-bg}{black-fg}"; inInv = true; }
        else if (!inv && inInv) { result += "{/}"; inInv = false; }
        // Escape blessed tag chars
        result += ch === "{" ? "\\{" : ch === "}" ? "\\}" : ch;
      }
      if (inInv) result += "{/}";
      lines.push(result);
    }
    return lines.join("\n");
  }

  if (blocksMode) {
    // Replace inverse-video spaces with ░ blocks
    const lines: string[] = [];
    for (let y = 0; y < rows; y++) {
      const line = buf.getLine(y);
      if (!line) { lines.push(""); continue; }
      let result = "";
      for (let x = 0; x < cols; x++) {
        const cell = line.getCell(x);
        if (!cell) { result += " "; continue; }
        const ch = cell.getChars() || " ";
        const inv = cell.isInverse() !== 0;
        result += inv && ch === " " ? "░" : ch;
      }
      lines.push(result);
    }
    return lines.join("\n");
  }

  if (boxifyMode) {
    // Find inverse bounding box, wrap in Unicode box-drawing
    const plainLines: string[] = [];
    let boxTop = -1, boxBot = -1, boxLeft = cols, boxRight = 0;
    for (let y = 0; y < rows; y++) {
      const line = buf.getLine(y);
      if (!line) { plainLines.push(""); continue; }
      let s = "";
      for (let x = 0; x < cols; x++) {
        const cell = line.getCell(x);
        if (!cell) { s += " "; continue; }
        s += cell.getChars() || " ";
        if (cell.isInverse() !== 0) {
          if (boxTop === -1) boxTop = y;
          boxBot = y;
          if (x < boxLeft) boxLeft = x;
          if (x > boxRight) boxRight = x;
        }
      }
      plainLines.push(s);
    }
    if (boxTop < 0) return plainLines.join("\n");
    const w = boxRight - boxLeft + 1;
    const out: string[] = [];
    for (let p = 0; p < Math.max(0, boxTop - 1); p++) out.push("");
    out.push(" ".repeat(boxLeft) + "┌" + "─".repeat(w) + "┐");
    for (let y = boxTop; y <= boxBot; y++) {
      const inner = plainLines[y].substring(boxLeft, boxRight + 1).padEnd(w);
      out.push(" ".repeat(boxLeft) + "│" + inner + "│");
    }
    out.push(" ".repeat(boxLeft) + "└" + "─".repeat(w) + "┘");
    while (out.length < rows) out.push("");
    return out.join("\n");
  }

  // Plain text (default)
  return player.readScreen().join("\n");
}

async function extract() {
  const startPct = parseInt(args[1], 10);
  const endPct = parseInt(args[2], 10);
  if (isNaN(startPct) || isNaN(endPct)) {
    console.error("Need start% and end% (e.g. 46 56)");
    process.exit(1);
  }
  const startChunk = Math.floor((startPct / 100) * chunks.length);
  const endChunk = Math.ceil((endPct / 100) * chunks.length);
  console.error(`Extracting chunks ${startChunk}-${endChunk} (${startPct}%-${endPct}%)`);

  const player = new Vt100Player(80, 24);
  player.load({ name: filename!, description: "", data, chunks, totalBytes: data.length });
  for (let i = 0; i < startChunk; i++) await player.tickAsync();

  const frames: string[] = [];
  let prevFrame = "";
  for (let i = startChunk; i <= endChunk; i++) {
    await player.tickAsync();
    const frame = readFrame(player);
    if (frame !== prevFrame) { frames.push(frame); prevFrame = frame; }
  }
  player.dispose();

  const output = frames.join("\n---\n");
  if (outputPath) {
    writeFileSync(outputPath, output);
    console.error(`Wrote ${frames.length} frames to ${outputPath}`);
  } else {
    process.stdout.write(output);
    console.error(`\n${frames.length} unique frames extracted`);
  }
}

if (scanMode) { await scan(); } else { await extract(); }
