# E002: Markdown Browser + State Export

## Objective

Add two foundational capabilities: (1) deterministic state snapshots with workspace save/load/replay, and (2) a retro text-native markdown browser that renders web pages as readable TUI content with figlet-styled headings and ANSI pixel art images. Both human and AI operate the browser as equal symbient surfaces.

## Source of Truth

- Planning canon: `.planning/README.md`
- Epic brief: this file

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.

## Epic Structure (GitHub-first)

- Epic issue: `E002` (`epic` label)
- Features: child issues (`feature` label)
- Stories: child issues under each feature (`story` label)
- Tasks: checklist items or child issues (`task` label)
- Spikes: timeboxed issues (`spike` label)

Naming:
- Epic: `E: markdown browser + state export`
- Feature: `F: <capability>`
- Story: `S: <vertical-slice>`

## Features

- [x] **F1: State Export & Workspace Management** — stable snapshot format, save/load, event logging, replay
  - Brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`
- [x] **F2: Browser Core** — fetch HTML, extract readable content, convert to markdown, render in TUI, navigate links
  - Brief: `.planning/epics/e002-browser-and-state-export/f02-browser-core/f02-feature-brief.md`
- [x] **F3: Rich Rendering** — figlet heading pipeline (3 tiers), ANSI image blocks via chafa, lazy rendering
  - Brief: `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/f03-feature-brief.md`
- [x] **F4: AI Browser Tools** — MCP tools for browser control, page summarisation, clip-to-memory
  - Brief: `.planning/epics/e002-browser-and-state-export/f04-ai-browser-tools/f04-feature-brief.md`

## Story Backlog

Stories are numbered globally within this epic (s01-s99).

### F1: State Export

- [x] **S01:** Versioned snapshot schema + `export_state`/`import_state` IPC commands
- [x] **S02:** `save_workspace`/`open_workspace` REST endpoints + file persistence
- [x] **S03:** Event-triggered snapshot logging (window create/close/move/resize, command exec, timer)
- [ ] **S14:** Fix `import_state` no-op so `open_workspace` applies state to running app

### F2: Browser Core

- [x] **S04:** BrowserWindow skeleton in C++ (URL bar, status, scrollable content pane, keybindings)
- [x] **S05:** Python sidecar fetch pipeline (readability-lxml + markdownify → RenderBundle JSON)
- [x] **S06:** Link navigation (cursor selection + numbered refs), back/forward history, go-to-URL
- [x] **S07:** Caching layer (URL + options keyed, raw HTML + markdown + render bundle stored)

### F3: Rich Rendering

- [x] **S08:** Figlet heading renderer (H1=`big`, H2=`standard`, H3-5=`small`) with toggle modes
- [x] **S09:** ANSI image renderer via chafa with 4 image modes (none/key-inline/all-inline/gallery)
- [x] **S10:** Gallery window (companion view, scroll sync with main browser, image focus)

### F4: AI Browser Tools

- [x] **S11:** MCP tools: `browser.open`, `browser.back`, `browser.forward`, `browser.refresh`, `browser.find`
- [x] **S12:** MCP tools: `browser.set_mode`, `browser.fetch`, `browser.render`
- [x] **S13:** AI actions: summarise page to new window, extract links, clip page to markdown file

## Milestone Plan

### v0 (S01, S04, S05) — Foundation

- State export schema + basic save/load
- `browser.open(url)` → markdown text view (no images, no figlet)
- Numbered links + open link
- Python fetch pipeline returns RenderBundle

### v1 (S02, S06, S07, S08) — Usable Browser

- Workspace save/load via REST
- Caching + back/forward + find + go-to-url
- Figlet headings (H1 only initially, then full 3-tier)
- Reader mode extraction

### v2 (S03, S09, S10, S11-S13) — Full Feature

- Event-triggered snapshot logging
- Image blocks via chafa (4 modes: none/key-inline/all-inline/gallery)
- Gallery window with scroll sync
- Full MCP tool surface for AI browser control
- Clip-to-memory, summarise, extract links

## Key Design Decisions

### Figlet Font Hierarchy

| Heading | Font | Approx height | Notes |
|---------|------|---------------|-------|
| H1 | `big` | 6 lines | Bold, clear, not absurdly wide |
| H2 | `standard` | 6 lines | Classic figlet, slightly smaller glyphs |
| H3-5 | `small` | 5 lines | Readable, clear step down |

Toggle modes: `plain` → `figlet_h1` → `figlet_h1_h2` → `figlet_all` (cycle with `h` key)

### Image Modes

| Mode | Key | Behavior |
|------|-----|----------|
| `none` | `i` cycle | No images rendered |
| `key-inline` | `i` cycle (default) | Hero + first N images inline in text flow |
| `all-inline` | `i` cycle | All images inline |
| `gallery` | `g` toggle | Companion gallery window, main stays text-only |

- Lazy rendering: images only converted when near viewport
- Cache rendered ANSI blocks by `(url, width, mode)`
- `Enter` on inline image opens it focused in gallery
- Gallery highlights image nearest current scroll position
- Selecting image in gallery jumps main view to its anchor

### Link Navigation

Both modes available simultaneously:
- **Cursor selection**: Tab/arrow through links, Enter to follow (TUI native)
- **Numbered refs**: Links shown as `[1]` `[2]` etc, type number to jump (lynx style)

### Image Backend

- **Primary**: chafa (brew install chafa) — best terminal image renderer
- **Fallback**: none initially; chafa required as dependency

### HTML Extraction

- **readability-lxml** for article extraction (strips nav, ads, chrome)
- **markdownify** for HTML→Markdown conversion
- Pipeline: `fetch HTML → readability → markdownify → post-process → RenderBundle`

### State Snapshot Schema (v1)

```json
{
  "version": "1",
  "timestamp": "2026-02-15T04:12:00Z",
  "canvas": { "w": 120, "h": 36 },
  "pattern_mode": "continuous",
  "windows": [
    {
      "id": "w1",
      "type": "browser",
      "title": "Example Page",
      "rect": { "x": 2, "y": 1, "w": 80, "h": 30 },
      "z": 3,
      "focused": true,
      "props": {
        "url": "https://example.com",
        "history": ["https://example.com"],
        "history_index": 0,
        "scroll_y": 0,
        "render_mode": "figlet_h1",
        "image_mode": "key-inline",
        "cache_policy": "default"
      }
    }
  ]
}
```

### Architecture

Two-process model (existing pattern):
- **C++ TUI app**: BrowserWindow (TView subclass), scrolling, link selection, keybindings
- **Python sidecar**: fetch + readability + markdownify + chafa + caching

Data flow:
1. C++ BrowserWindow sends `fetch_url(url)` via IPC
2. Python returns RenderBundle JSON (title, markdown, tui_text, links, assets, meta)
3. C++ renders tui_text in scrollable view, manages link selection and image placement

### New WindowType

`browser` — registered in command registry (E001 infrastructure).

### Browser Keybindings

| Key | Action |
|-----|--------|
| `Enter` | Open selected link / focus image in gallery |
| `b` | Back in history |
| `f` | Forward in history |
| `r` | Refresh current page |
| `/` | Find in page |
| `g` | Go to URL (opens URL input) |
| `o` | Open link in new browser window |
| `i` | Cycle image mode: none → key-inline → all-inline |
| `h` | Cycle heading style: plain → figlet_h1 → figlet_h1_h2 → figlet_all |
| `G` | Toggle gallery window |
| `Tab` | Next link |
| `Shift+Tab` | Previous link |

### API Endpoints (REST)

Core:
- `POST /browser/open` — `{url, window_id?, mode: same|new}`
- `POST /browser/{window_id}/back`
- `POST /browser/{window_id}/forward`
- `POST /browser/{window_id}/refresh`
- `POST /browser/{window_id}/find` — `{query, direction: next|prev}`
- `POST /browser/{window_id}/set_mode` — `{headings?, images?}`
- `POST /browser/{window_id}/goto` — `{url}`

Low-level:
- `POST /browser/fetch` — `{url, reader: readability|raw, format: markdown|tui_bundle}`
- `POST /browser/render` — `{markdown, headings?, images?, width?, theme?}`

State integration:
- `GET /state` — includes browser window props (existing endpoint, extended)
- `POST /workspace/save` — `{path}`
- `POST /workspace/open` — `{path}`
- `POST /state/export` — `{path, format: json|ndjson}`
- `POST /state/import` — `{path, mode: replace|merge}`

### Caching

Cache by `(url, reader_mode, width, image_mode)`:
- `cache/browser/<sha256>/raw.html`
- `cache/browser/<sha256>/content.md`
- `cache/browser/<sha256>/bundle.json`
- `cache/browser/<sha256>/img_<id>_<width>.ansi`

### Security / Safety

- No JS execution (not a JS browser)
- Fetch size limit (configurable, default 5MB)
- Request timeout (configurable, default 30s)
- HTTPS preferred, HTTP allowed with warning
- No cookie/session management

## Dependencies on E001

This epic builds on E001 command registry infrastructure:
- Browser commands registered in `CommandRegistry`
- `exec_command` dispatch for browser actions
- Capability export includes browser tools
- MCP tools auto-generated from registry

## Definition of Done (Epic)

- [x] State snapshots are versioned, deterministic, and round-trip tested
- [x] Workspace save/load persists and restores complete UI state including browser sessions
- [x] `browser.open(url)` renders readable web content in a TUI window
- [x] Figlet headings render at 3 size tiers with toggle
- [x] ANSI images render via chafa with 4 modes and lazy loading
- [x] Gallery window syncs with main browser scroll position
- [x] Link navigation works via both cursor selection and numbered refs
- [x] Back/forward history, caching, find-in-page all functional
- [x] AI can operate browser via MCP tools with full parity
- [x] AI can summarise pages, extract links, clip to markdown files
- [x] `get_state()` includes browser window props for rebootable sessions
- [x] All ACs have tests

## Status

Status: `in-progress`
GitHub issue: #16
PR: #23

## Symbient Tag

`web → markdown → ANSI : the net becomes a window`
