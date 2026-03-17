#!/usr/bin/env bun
/**
 * Generate a DVD screensaver VT100 animation file.
 *
 * Bounces "DVD" text around an 80×24 terminal using ANSI escape sequences
 * (cursor positioning + clear screen). Output: microapps/theattyr/vt100/dvd.vt
 *
 * Usage: bun run microapps/theattyr/gen-dvd-vt.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";

const COLS = 80;
const ROWS = 24;
const FRAMES = 120; // ~4 seconds at 30fps
const DELAY_LINES = 3; // empty lines between frames as crude timing

// Simple block-letter "DVD" (5 rows tall, 17 cols wide)
const DVD_ART = [
  " ___  _  _ ___  ",
  " |  \\ | || |  \\ ",
  " | |\\\\| || | |\\\\ ",
  " |__/ \\_/ |__/ ",
  "                ",
];
const ART_W = 17;
const ART_H = 5;

// ESC sequences
const ESC = "\x1b";
const CLEAR = `${ESC}[2J`;
const HOME = `${ESC}[H`;
const moveTo = (row: number, col: number) => `${ESC}[${row + 1};${col + 1}H`;

let x = 3;
let y = 2;
let dx = 2;
let dy = 1;

let output = "";

for (let frame = 0; frame < FRAMES; frame++) {
  // Clear screen and home cursor
  output += CLEAR + HOME;

  // Draw the DVD art at current position
  for (let row = 0; row < ART_H; row++) {
    output += moveTo(y + row, x);
    output += DVD_ART[row];
  }

  // Move
  x += dx;
  y += dy;

  // Bounce
  if (x <= 0 || x + ART_W >= COLS) {
    dx = -dx;
    x += dx * 2;
  }
  if (y <= 0 || y + ART_H >= ROWS) {
    dy = -dy;
    y += dy * 2;
  }

  // Add newlines as frame delimiter (theattyr reads line-by-line)
  output += "\n";
  for (let d = 0; d < DELAY_LINES; d++) {
    output += "\n";
  }
}

// Final frame: leave the art visible
output += CLEAR + HOME;
for (let row = 0; row < ART_H; row++) {
  output += moveTo(y + row, x);
  output += DVD_ART[row];
}
output += moveTo(ROWS - 1, 0);
output += "                         WibWob-DOS DVD Screensaver";

const outPath = join(import.meta.dir, "vt100", "dvd.vt");
writeFileSync(outPath, Buffer.from(output, "binary"));
console.log(`Written ${output.length} bytes to ${outPath}`);
