# Autoresearch — Chrome Browser Content Extraction

## Objective
Improve the Chrome Browser's ability to extract clean, readable content from
complex web pages. Fix issues with: nav/aria section handling, JS-rendered
content detection, text visibility decisions, complex page layouts.

## Current Problems
1. Readability often fails on complex pages → falls back to basic DOM strip
2. Nav/aria landmarks not properly stripped (role="navigation", cookie banners, etc.)
3. JS-rendered content missed — only waits for networkidle2, not DOM mutations
4. No retry with longer wait for slow JS rendering
5. Thin-content fallback DOM walk doesn't respect computed visibility well
6. No handling of common SPA patterns (React hydration, Next.js, etc.)
7. No structured data extraction (JSON-LD, microdata) as fallback

## Architecture
- `src/services/chrome-browser-service.ts` — puppeteer CDP, Readability, Turndown, image handling (854 lines)
- `src/windows/chrome-browser-window.ts` — blessed window, toolbar, markdown rendering (473 lines)
- `src/services/markdown-service.ts` — markdown→blessed rendering
- `src/services/image-hydrator.mjs` — image→ASCII conversion

## Key Files to Modify
- `src/services/chrome-browser-service.ts` — puppeteer CDP, Readability, Turndown, image handling (854 lines)
- `src/windows/chrome-browser-window.ts` — blessed window, toolbar, navigation (473 lines)
- `src/services/markdown-service.ts` — markdown→ANSI rendering: figlet headings, tables, code, lists (434 lines)
- `src/services/image-hydrator.mjs` — image→ASCII conversion subprocess (100 lines)

## Scoring
Test against a set of complex pages and score extraction quality:
- Content completeness: does it get the main article/content?
- Noise removal: are nav, footer, cookie banners, ads stripped?
- Structure preservation: headings, lists, code blocks, tables intact?
- JS content: does it catch dynamically rendered text?
- Image discovery: does it find and render key images?

## Test URLs (score each 1-10, average)
1. https://en.wikipedia.org/wiki/ASCII_art — complex wiki with tables, images, sections
2. https://news.ycombinator.com — JS-light but complex nav structure
3. https://github.com/nicbarker/clay — repo README with mixed content
4. https://developer.mozilla.org/en-US/docs/Web/HTML — reference docs with nav landmarks

## Rubric
EXTRACTION (main content captured), NOISE (junk removed), STRUCTURE (formatting preserved),
JS_HANDLING (dynamic content caught), DISPLAY (how it looks in the TUI) — each 1-10, averaged.

## Constraints
- Modify: `src/services/chrome-browser-service.ts`, `src/windows/chrome-browser-window.ts`
- Must pass `bun run typecheck`
- RESTART required after changes (src/ files)
- Chrome must be running or launchable
