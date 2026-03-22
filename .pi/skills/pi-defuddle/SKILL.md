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

## How it works

1. Fetches the URL directly (fast, no browser)
2. If that gets a 403/429/timeout, automatically retries via pi-web-browse (`--no-daemon`)
3. If pi-web-browse also fails (CAPTCHA, DataDome), exits with an error

Use `--no-fallback` to skip step 2 and fail fast.

## Output

**Markdown** (default): `# Title`, byline, description, then article content.

**JSON** (`--json`): `content`, `title`, `author`, `published`, `description`, `domain`, `wordCount`, `parseTime`, `extractorType`.

## Site-specific extractors

Defuddle has native extractors (better than generic Readability) for: GitHub, Hacker News, Reddit, Twitter/X, YouTube, ChatGPT, Claude, Gemini, Grok.

## No setup needed

Deps live in `vendor/defuddle/node_modules/` — no install step required.
