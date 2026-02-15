# F04: AI Browser Tools (MCP Integration)

## Parent

- Epic: `e002-browser-and-state-export`
- Epic brief: `.planning/epics/e002-browser-and-state-export/e002-epic-brief.md`

## Objective

Expose the browser as a full MCP tool surface so the embedded AI (Wib&Wob chat) can open URLs, navigate, read content, summarise pages, extract links, and clip content to markdown files — true symbient parity with the human operator.

## Stories

- [x] `s11-mcp-browser-core/` — MCP tools: open, back, forward, refresh, find
- [x] `s12-mcp-browser-modes/` — MCP tools: set_mode, fetch, render
- [x] `s13-ai-actions/` — summarise page to new window, extract links by type, clip to markdown file

## MCP Tools

### Core Navigation (S11)

| Tool | Args | Description |
|------|------|-------------|
| `browser.open` | `url, window_id?, mode: same\|new` | Open URL in browser window |
| `browser.back` | `window_id` | Navigate back |
| `browser.forward` | `window_id` | Navigate forward |
| `browser.refresh` | `window_id` | Refresh current page |
| `browser.find` | `window_id, query, direction: next\|prev` | Find text in page |

### Mode Control (S12)

| Tool | Args | Description |
|------|------|-------------|
| `browser.set_mode` | `window_id, headings?, images?` | Change render modes |
| `browser.fetch` | `url, reader: readability\|raw, format: markdown\|tui_bundle` | Low-level fetch |
| `browser.render` | `markdown, headings?, images?, width?` | Low-level render |
| `browser.get_content` | `window_id, format: text\|markdown\|links` | Read current page content |

### AI Actions (S13)

| Tool | Args | Description |
|------|------|-------------|
| `browser.summarise` | `window_id, target: new_window\|clipboard\|file` | Summarise current page |
| `browser.extract_links` | `window_id, filter?: regex` | Extract links matching pattern |
| `browser.clip` | `window_id, path?, include_images: bool` | Save page as markdown file |

## Acceptance Criteria

- [x] **AC-1:** AI can open a URL and read the rendered content via MCP
  - Test: MCP call `browser.open(url)` → `browser.get_content(id, "text")`, assert non-empty
- [x] **AC-2:** AI can navigate back/forward and the history state updates
  - Test: open A, open B, `browser.back()`, `browser.get_content()` returns A's content
- [x] **AC-3:** AI can change heading and image modes via MCP
  - Test: `browser.set_mode(id, headings="figlet_h1")`, verify render mode in `get_state()`
- [x] **AC-4:** `browser.summarise` produces a summary in a new window
  - Test: open page, `browser.summarise(id, target="new_window")`, assert new window created with summary text
- [x] **AC-5:** `browser.clip` writes a markdown file to disk
  - Test: open page, `browser.clip(id, path="/tmp/test_clip.md")`, assert file exists with content
- [x] **AC-6:** `browser.extract_links` returns filtered link list
  - Test: open page with known links, extract with filter, assert correct subset returned

## Symbient Parity Principle

Every browser action available to the human via keyboard is available to the AI via MCP. The AI is not a second-class citizen — it can browse, read, clip, and summarise with the same authority as the human operator.

## Clip-to-Memory Design

`browser.clip` saves to a markdown file (not the mem/qmd system):
- Default path: `clips/<url-slug>-<timestamp>.md`
- File contains: title, URL, extraction timestamp, markdown content
- Optional: include ANSI image blocks as code-fenced blocks
- AI can specify custom path

## Implementation Notes

- MCP tools registered via E001 command registry
- Tools dispatch through `exec_command` with `actor="ai"` attribution
- Browser state included in `get_state()` for workspace persistence
- All MCP tools are thin wrappers around the same IPC commands the human keybindings use

## Status

Status: `done`
GitHub issue: #20
PR: —
