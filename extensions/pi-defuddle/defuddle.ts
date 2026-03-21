#!/usr/bin/env bun
/**
 * pi-defuddle — URL → clean Markdown (no headless browser needed)
 *
 * Uses Defuddle (kepano/defuddle, vendor/defuddle) for content extraction.
 * Works on static/SSR pages. For JS-gated or bot-protected sites, use pi-web-browse instead.
 *
 * Usage:
 *   bun extensions/pi-defuddle/defuddle.ts <url>
 *   bun extensions/pi-defuddle/defuddle.ts <url> --json
 *   bun extensions/pi-defuddle/defuddle.ts <url> --debug
 */

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

  if (isBotBlocked) {
    console.error(
      `❌ Fetch failed: ${msg}\n\n` +
        `💡 This page may require a real browser. Try:\n` +
        `   web-browse.js --url "${url}"\n`
    );
  } else {
    console.error(`❌ Error: ${msg}`);
  }
  process.exit(1);
}
