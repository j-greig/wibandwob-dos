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
  const candidates = [
    "/opt/homebrew/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js", // macOS Homebrew
    "/usr/local/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js",    // Linux global
    `${process.env.HOME}/.npm-global/lib/node_modules/@ogulcancelik/pi-web-browse/web-browse.js`,
  ];
  const { existsSync } = require("fs");
  return candidates.find(existsSync) ?? null;
})();

// Playwright fallback: find globally-installed playwright
const PLAYWRIGHT_PATH = (() => {
  const candidates = [
    `${process.env.HOME}/.npm-global/lib/node_modules/playwright`,
    "/opt/homebrew/lib/node_modules/playwright",
    "/usr/local/lib/node_modules/playwright",
  ];
  const { existsSync } = require("fs");
  return candidates.find((p) => existsSync(p + "/cli.js")) ?? null;
})();

/**
 * Fallback: use Playwright to render JS-heavy pages, then extract with Defuddle.
 * Returns the full HTML string, or null on failure.
 */
async function fetchWithPlaywright(targetUrl: string): Promise<string | null> {
  if (!PLAYWRIGHT_PATH) return null;
  const { spawnSync } = await import("child_process");

  // Inline Node script that launches Chromium and dumps rendered HTML
  const script = `
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(${JSON.stringify(targetUrl)}, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      const html = await page.content();
      process.stdout.write(html);
      await browser.close();
    })().catch(e => { process.stderr.write(e.message); process.exit(1); });
  `;

  const result = spawnSync(
    "node",
    ["-e", script],
    {
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_PATH: PLAYWRIGHT_PATH.replace(/\/playwright$/, "") },
    }
  );

  if (result.status === 0 && result.stdout?.length > 100) {
    return result.stdout;
  }
  if (debugMode) {
    console.error(`🎭 Playwright fallback failed: ${result.stderr || result.error?.message}`);
  }
  return null;
}

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

/** Format and output the Defuddle result */
function outputResult(result: any): void {
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
    const lines: string[] = [];
    if (result.title) lines.push(`# ${result.title}`, "");
    const byline = [result.author, result.published].filter(Boolean).join(" · ");
    if (byline) lines.push(`*${byline}*`, "");
    if (result.description) lines.push(`> ${result.description}`, "");
    lines.push(result.content);
    console.log(lines.join("\n"));
  }
}

/**
 * Try Playwright → Defuddle pipeline. Returns true if it produced content.
 */
async function tryPlaywrightFallback(reason: string): Promise<boolean> {
  if (noFallback || !PLAYWRIGHT_PATH) return false;
  console.error(`⚠️  ${reason} — falling back to Playwright (headless Chromium)…`);
  const html = await fetchWithPlaywright(url!);
  if (!html) {
    console.error(`❌ Playwright fallback failed to fetch page.`);
    return false;
  }
  const doc = parseLinkedomHTML(html, url!);
  const result = await Defuddle(doc, url!, { markdown: true, debug: debugMode });
  if (!result.content?.trim() && result.wordCount === 0) {
    console.error(`❌ Playwright fallback: page rendered but Defuddle extracted no content.`);
    return false;
  }
  outputResult(result);
  return true;
}

try {
  const ua = getInitialUA(url);
  const html = await fetchPage(url, ua);
  const doc = parseLinkedomHTML(html, url);

  const result = await Defuddle(doc, url, {
    markdown: true,
    debug: debugMode,
  });

  // Detect JS-rendered SPA: fetch succeeded but no content extracted
  const isEmpty = !result.content?.trim() && result.wordCount === 0;
  if (isEmpty && !noFallback) {
    console.error(`⚠️  Page fetched but no content extracted (likely JS-rendered SPA).`);

    // Try pi-web-browse first
    const fs = await import("fs");
    if (WEB_BROWSE && fs.existsSync(WEB_BROWSE)) {
      console.error(`   Trying pi-web-browse…`);
      const { spawnSync } = await import("child_process");
      const wb = spawnSync(
        "node",
        [WEB_BROWSE, "--url", url, "--no-daemon", ...(hasFlag("--full") ? ["--full"] : [])],
        { encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] }
      );
      if (wb.status === 0 && wb.stdout?.trim()) {
        process.stdout.write(wb.stdout);
        process.exit(0);
      }
      console.error(`   pi-web-browse failed, trying Playwright…`);
    }

    // Try Playwright as final fallback
    if (await tryPlaywrightFallback("Empty content from direct fetch")) {
      process.exit(0);
    }

    // Nothing worked — output the (empty) result anyway
    console.error(`❌ All fallbacks exhausted. Outputting empty result.`);
    outputResult(result);
    process.exit(1);
  }

  outputResult(result);
} catch (err: any) {
  const msg = err?.message || String(err);

  // Detect likely bot-protection / JS-gate failures
  const isBotBlocked =
    msg.includes("403") ||
    msg.includes("429") ||
    msg.includes("Timed out") ||
    msg.includes("Failed to fetch");

  if (isBotBlocked && !noFallback) {
    // Try pi-web-browse first
    const fs = await import("fs");
    if (WEB_BROWSE && fs.existsSync(WEB_BROWSE)) {
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
    }

    // Try Playwright as final fallback
    if (await tryPlaywrightFallback(`Fetch failed (${msg})`)) {
      process.exit(0);
    }

    console.error(
      `❌ All fallbacks failed for: ${msg}\n` +
        (!WEB_BROWSE ? `💡 pi-web-browse not installed\n` : "") +
        (!PLAYWRIGHT_PATH ? `💡 Playwright not found globally — run: npm i -g playwright && npx playwright install chromium\n` : "")
    );
  } else {
    console.error(`❌ Error: ${msg}`);
  }
  process.exit(1);
}
