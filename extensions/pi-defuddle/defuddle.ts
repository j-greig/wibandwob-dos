#!/usr/bin/env bun
/**
 * pi-defuddle — URL → clean Markdown (no headless browser needed)
 *
 * Uses Defuddle (kepano/defuddle, vendor/defuddle) for content extraction.
 * Works on static/SSR pages. On 403/bot-block, automatically falls back to
 * pi-web-browse (headless Chromium) if available.
 *
 * Usage:
 *   bun extensions/pi-defuddle/defuddle.ts <url>
 *   bun extensions/pi-defuddle/defuddle.ts <url> --json
 *   bun extensions/pi-defuddle/defuddle.ts <url> --debug
 *   bun extensions/pi-defuddle/defuddle.ts <url> --no-fallback
 */

// Self-heal: ensure linkedom is available before the imports that need it.
// If missing, install it into the repo root so Bun can resolve it.
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, "../..");
if (!existsSync(resolve(repoRoot, "node_modules/linkedom"))) {
  console.error("⚙️  linkedom not found — installing into repo root (one-time setup)...");
  const { spawnSync } = await import("child_process");
  const r = spawnSync("bun", ["add", "linkedom"], { cwd: repoRoot, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("❌ Failed to install linkedom. Run: bun add linkedom");
    process.exit(1);
  }
}

import { fetchPage, getInitialUA } from "../../vendor/defuddle/src/fetch.ts";
import { parseLinkedomHTML } from "../../vendor/defuddle/src/utils/linkedom-compat.ts";
import { Defuddle } from "../../vendor/defuddle/src/node.ts";

const args = process.argv.slice(2);

function hasFlag(...flags: string[]): boolean {
  return flags.some((f) => args.includes(f));
}

const url = args.find((a) => !a.startsWith("-"));
const jsonMode = hasFlag("--json", "-j");
const debugMode = hasFlag("--debug");
const noFallback = hasFlag("--no-fallback");

// Fallback browser: try common global npm paths, then PATH
const WEB_BROWSE = (() => {
  const { spawnSync: which } = require("child_process");
  const candidates = [
    "/opt/homebrew/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js", // macOS Homebrew
    "/usr/local/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js",    // Linux global
    `${process.env.HOME}/.npm-global/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js`,
  ];
  const { existsSync } = require("fs");
  return candidates.find(existsSync) ?? null;
})();

if (!url || hasFlag("--help", "-h")) {
  console.log(`pi-defuddle — URL → Markdown (no headless browser)

Usage:
  bun extensions/pi-defuddle/defuddle.ts <url>           # markdown output
  bun extensions/pi-defuddle/defuddle.ts <url> --json    # full metadata as JSON
  bun extensions/pi-defuddle/defuddle.ts <url> --debug   # debug extraction pipeline

Notes:
  - Works on static/SSR pages (GitHub, blogs, docs, HN, Reddit, YouTube etc.)
  - For JS-gated or Cloudflare/bot-protected pages, use pi-web-browse instead
  - Defuddle has site-specific extractors for: GitHub, HN, Reddit, Twitter/X, YouTube,
    ChatGPT, Claude, Gemini, Grok
`);
  process.exit(0);
}

try {
  const ua = getInitialUA(url);
  const html = await fetchPage(url, ua);
  const doc = parseLinkedomHTML(html, url);

  const result = await Defuddle(doc, url, {
    markdown: true,
    debug: debugMode,
  });

  if (jsonMode) {
    const out: Record<string, unknown> = {
      url,
      title: result.title,
      author: result.author,
      published: result.published,
      description: result.description,
      domain: result.domain,
      wordCount: result.wordCount,
      parseTime: result.parseTime,
      extractorType: result.extractorType,
      content: result.content,
    };
    if (debugMode) out.debug = result.debug;
    console.log(JSON.stringify(out, null, 2));
  } else {
    // Readable markdown output
    const lines: string[] = [];
    if (result.title) lines.push(`# ${result.title}`, "");
    const byline = [result.author, result.published].filter(Boolean).join(" · ");
    if (byline) lines.push(`*${byline}*`, "");
    if (result.description) lines.push(`> ${result.description}`, "");
    lines.push(result.content);
    console.log(lines.join("\n"));
  }
} catch (err: any) {
  const msg = err?.message || String(err);

  // Detect likely bot-protection / JS-gate failures
  const isBotBlocked =
    msg.includes("403") ||
    msg.includes("429") ||
    msg.includes("Timed out") ||
    msg.includes("Failed to fetch");

  if (isBotBlocked && !noFallback) {
    const fs = await import("fs");
    if (fs.existsSync(WEB_BROWSE)) {
      console.error(`⚠️  Fetch failed (${msg}) — falling back to pi-web-browse…`);
      const { spawnSync } = await import("child_process");
      const result = spawnSync(
        "node",
        [WEB_BROWSE, "--url", url, "--no-daemon", ...(hasFlag("--full") ? ["--full"] : [])],
        { encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] }
      );
      if (result.status === 0) {
        process.stdout.write(result.stdout);
        process.exit(0);
      }
      console.error(`❌ pi-web-browse also failed: ${result.stderr || result.error?.message}`);
    } else {
      console.error(
        `❌ Fetch failed: ${msg}\n\n` +
          `💡 pi-web-browse not found at expected path:\n` +
          `   ${WEB_BROWSE}\n`
      );
    }
  } else {
    console.error(`❌ Error: ${msg}`);
  }
  process.exit(1);
}
