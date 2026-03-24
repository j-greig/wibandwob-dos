---
name: pi-defuddle
description: "Convert any URL to clean Markdown instantly. Uses Defuddle for content extraction, falls back to pi-web-browse automatically on 403/bot-block. Use when: 'fetch this URL', 'convert to markdown', 'read this page', 'get article content', 'extract this URL'."
---

# pi-defuddle

Fetch any URL as clean Markdown. Fast (no browser). Auto-falls back to headless browser on 403/bot-block.

## Usage

```bash
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url>
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url> --json
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url> --no-fallback
```

## How it works — three-tier fallback chain

1. **Direct fetch + Defuddle** (fast, no browser) — works for static/SSR pages
2. **pi-web-browse** (headless Chromium extension) — if fetch fails (403/429) or page is a JS-rendered SPA (empty content)
3. **Playwright** (globally-installed) — if pi-web-browse isn't installed or also fails. Launches headless Chromium, waits for JS to render, then pipes the rendered HTML back through Defuddle for clean markdown extraction

SPA detection: if direct fetch succeeds but Defuddle extracts zero words (wordCount=0), the page is likely JS-rendered and fallbacks are triggered automatically.

Use `--no-fallback` to skip tiers 2–3 and fail fast.

### Playwright setup (one-time, optional)

```bash
npm i -g playwright && npx playwright install chromium
```

If Playwright is installed globally, it's found automatically. No project-level dependency needed.

## Output

**Markdown** (default): `# Title`, byline, description, then article content.

**JSON** (`--json`): `content`, `title`, `author`, `published`, `description`, `domain`, `wordCount`, `parseTime`, `extractorType`.

## Site-specific extractors

Defuddle has native extractors (better than generic Readability) for: GitHub, Hacker News, Reddit, Twitter/X, YouTube, ChatGPT, Claude, Gemini, Grok.

## Setup

The script is self-healing — if `linkedom` is missing it installs itself automatically on first run.
If that somehow fails, run this once from the repo root:

```bash
cd /Users/james/Repos/wibandwob-dos && bun add linkedom
```

`linkedom` lives in the repo root `node_modules/` (not `vendor/defuddle/`). It only needs to be installed once per machine.
