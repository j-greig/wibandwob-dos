#!/usr/bin/env node
/**
 * Standalone image hydrator — runs as a subprocess to avoid blocking the main event loop.
 * Reads markdown on stdin, finds ![alt](url) patterns, converts images to ASCII via chafa,
 * outputs updated markdown on stdout.
 *
 * Usage: echo "markdown" | node src/services/image-hydrator.mjs [--symbols braille|block] [--max-images 3] [--max-cols 60]
 */
import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const symbols = args.includes("--symbols") ? args[args.indexOf("--symbols") + 1] : "braille";
const maxImages = args.includes("--max-images") ? parseInt(args[args.indexOf("--max-images") + 1]) : 3;
const maxCols = args.includes("--max-cols") ? parseInt(args[args.indexOf("--max-cols") + 1]) : 60;

// Read all stdin
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const markdown = Buffer.concat(chunks).toString("utf8");

const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const matches = Array.from(markdown.matchAll(imageRegex));

if (matches.length === 0) {
  process.stdout.write(markdown);
  process.exit(0);
}

let out = markdown;
let count = 0;

for (const match of matches) {
  if (count >= maxImages) break;
  const full = match[0];
  const alt = match[1] ?? "";
  const src = match[2] ?? "";
  if (!src) continue;

  const ascii = convertImage(src, maxCols, symbols);
  const replacement = ascii ? `\n${ascii}\n` : (alt ? `[${alt}]` : "");
  out = out.replace(full, replacement);
  count++;
}

process.stdout.write(out.replace(/\n{3,}/g, "\n\n").trimEnd());
process.exit(0);

function convertImage(url, cols, syms) {
  const tmpPath = `/tmp/chafa-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
  try {
    // Download
    execFileSync("curl", [
      "-sL", "--max-time", "3",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-o", tmpPath, url,
    ], { timeout: 4000 });

    // Check file type
    const fileType = execFileSync("file", ["--brief", tmpPath], { encoding: "utf8", timeout: 2000 }).trim();
    if (!/image|PNG|JPEG|GIF|WebP|bitmap/i.test(fileType)) {
      try { unlinkSync(tmpPath); } catch {}
      return null;
    }

    // Get dimensions
    const sipsOut = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", tmpPath], {
      encoding: "utf8", timeout: 3000,
    });
    const pw = parseInt(sipsOut.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "0");
    const ph = parseInt(sipsOut.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "0");
    if (pw < 150 || ph < 150) {
      try { unlinkSync(tmpPath); } catch {}
      return null;
    }

    const aspect = ph / pw;
    const c = Math.min(cols, pw);
    const rows = Math.max(5, Math.round(c * aspect / 2));

    const result = execFileSync("chafa", [
      "-f", "symbols", "-c", "256",
      "-s", `${c}x${rows}`, "--symbols", syms, tmpPath,
    ], { encoding: "utf8", timeout: 5000 });

    try { unlinkSync(tmpPath); } catch {}
    if (!result.trim()) return null;
    return result.replace(/\x1b\[\?25[lh]/g, "").trimEnd();
  } catch {
    try { unlinkSync(tmpPath); } catch {}
    return null;
  }
}
