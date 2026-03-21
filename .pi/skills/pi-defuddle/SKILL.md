---
name: pi-defuddle
description: "Convert any URL to clean Markdown instantly — no headless browser needed. Uses Defuddle for content extraction. Faster than pi-web-browse for static/SSR pages. Use when: 'fetch this URL', 'convert to markdown', 'read this page', 'get article content', 'extract this URL'. Falls back to pi-web-browse suggestion when page is bot-protected or JS-gated."
---

# pi-defuddle

Convert a URL to clean Markdown using Defuddle. Faster than pi-web-browse (no browser startup) — works on static/SSR pages.

## When to use this vs pi-web-browse

| Use pi-defuddle | Use pi-web-browse |
|-----------------|-------------------|
| Blogs, docs, news sites | Cloudflare/bot-protected pages |
| GitHub repos/issues/PRs | Single-page apps (React/Vue/Angular) |
| Hacker News, Reddit | Sites requiring login/cookies |
| YouTube (transcript via API) | Sites with Anubis PoW challenge |
| Twitter/X posts | Interactive dashboards |

Defuddle has **site-specific extractors** for: GitHub, HN, Reddit, Twitter/X, YouTube, ChatGPT, Claude, Gemini, Grok — these produce better output than generic Readability extraction.

## Usage

```bash
# Markdown output (default)
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url>

# Full metadata as JSON (title, author, published, wordCount, domain, etc.)
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url> --json

# Debug extraction pipeline (shows which elements were removed and why)
bun /Users/james/Repos/wibandwob-dos/extensions/pi-defuddle/defuddle.ts <url> --debug
```

## Output

**Markdown mode** (default): Prints `# Title`, byline, description quote, then clean article markdown.

**JSON mode** (`--json`): Returns structured object with:
- `content` — full markdown
- `title`, `author`, `published`, `description`, `domain`
- `wordCount`, `parseTime` (ms)
- `extractorType` — which extractor fired (e.g. `github`, `hackernews`, `youtube`)

## Examples

```bash
# Read a blog post
bun .../defuddle.ts https://stephango.com/saw

# Get a GitHub issue as markdown
bun .../defuddle.ts https://github.com/some/repo/issues/123

# HN thread
bun .../defuddle.ts https://news.ycombinator.com/item?id=12345

# YouTube video (gets transcript if available)
bun .../defuddle.ts https://youtube.com/watch?v=xxxxx

# Full metadata
bun .../defuddle.ts https://example.com/article --json
```

## When it fails

If you see `❌ Fetch failed` with a 403/429 or timeout, the page is bot-protected. Switch to:
```bash
web-browse.js --url <url>
```

## No setup needed

Dependencies live in `vendor/defuddle/node_modules/` (installed when defuddle submodule was set up). No separate install step.
