# F02: Browser Core

## Parent

- Epic: `e002-browser-and-state-export`
- Epic brief: `.planning/epics/e002-browser-and-state-export/e002-epic-brief.md`

## Objective

Build a text-native markdown browser window that fetches web pages, extracts readable content, renders as scrollable TUI text with navigable links, and supports history and caching.

## Stories

- [x] `s04-browser-window-skeleton/` — C++ BrowserWindow (URL bar, status, scrollable pane, keybindings)
- [x] `s05-fetch-pipeline/` — Python sidecar fetch (readability-lxml + markdownify → RenderBundle JSON)
- [x] `s06-link-navigation/` — cursor selection + numbered refs, back/forward, go-to-URL
- [x] `s07-caching/` — URL+options-keyed cache (raw HTML, markdown, render bundle)

## Acceptance Criteria

- [x] **AC-1:** `browser.open(url)` creates a BrowserWindow displaying readable markdown text
  - Test: IPC test sends `browser.open("https://example.com")`, asserts window created with type `browser`
- [x] **AC-2:** RenderBundle JSON from Python includes title, markdown, links array, and meta
  - Test: unit test calls fetch pipeline, validates bundle against schema
- [x] **AC-3:** Links are navigable via both Tab/Enter cursor and `[N]` numbered input
  - Test: integration test opens page with links, verifies link count and navigation
- [x] **AC-4:** Back/forward history works across 3+ page navigations
  - Test: open A → navigate to B → navigate to C → back → assert B → back → assert A → forward → assert B
- [x] **AC-5:** Cache hit returns stored bundle without network request
  - Test: fetch URL twice, assert second call is cache hit (meta.cache="hit")

## RenderBundle Schema

```json
{
  "url": "https://example.com",
  "title": "Page Title",
  "markdown": "# Heading\n\nBody text...",
  "tui_text": "rendered text with figlet/ANSI blocks",
  "links": [
    {"id": 1, "text": "About", "url": "https://example.com/about"}
  ],
  "assets": [
    {"kind": "ansi_image", "id": "img1", "placement": "after_paragraph_2", "text": "<ansi>"}
  ],
  "meta": {"fetched_at": "ISO-8601", "cache": "hit|miss", "source_bytes": 12345}
}
```

## Architecture

Two-process (existing pattern):
1. C++ BrowserWindow sends `fetch_url(url, options)` via IPC socket
2. Python sidecar: `requests.get` → `readability` → `markdownify` → bundle JSON
3. C++ receives bundle, renders `tui_text` in scrollable TView, manages link state

## BrowserWindow (C++ TView subclass)

Internal layout:
- **URL bar** (1 line): current URL + edit mode
- **Status bar** (1 line): "Fetching...", "Cached", progress
- **Content pane** (remaining): scrollable rendered text
- **Key hints** (1 line): `Enter:open b:back f:fwd /:find g:url i:img h:hdg`

## Keybindings

| Key | Action |
|-----|--------|
| `Enter` | Open selected link |
| `b` | Back |
| `f` | Forward |
| `r` | Refresh |
| `/` | Find |
| `g` | Go to URL |
| `o` | Open in new window |
| `Tab` | Next link |
| `Shift+Tab` | Previous link |

## Caching Strategy

Key: `sha256(url + reader_mode + width + image_mode)`

Storage:
```
cache/browser/<hash>/raw.html
cache/browser/<hash>/content.md
cache/browser/<hash>/bundle.json
```

Eviction: LRU by access time, configurable max size (default 100MB).

## Python Dependencies (additions to requirements.txt)

- `readability-lxml` — article extraction
- `markdownify` — HTML to markdown
- `requests` — HTTP fetch (already available)

## Status

Status: `done`
GitHub issue: #22
PR: —
