# Autoresearch — File Manager UI Quality & Features

## Objective

Improve the File Manager window (src/windows/browser-windows.ts, function openFileManagerWindow).
Score screenshots against a 5-axis rubric. Higher is better. Target: beat baseline convincingly.

## Files in Scope

ONLY `src/windows/browser-windows.ts` may be modified. No other source files.

## Feature Goals (beyond visual scoring)

1. **Markdown preview**: .md files should render with formatted markdown in the preview pane (figlet headings, code blocks, etc.) using `renderMarkdown` / `renderMarkdownFile` from `../services/markdown-service.js`
2. **Syntax-aware preview**: JSON files should show with structure/formatting, other code files with line numbers
3. **Working search**: The `s` search feature uses ripgrep — verify it works end-to-end and fix any issues
4. **Directory preview bug**: Selecting a directory in the file list can crash the app — guard against this
5. **General UI enhancements**: Better file type indicators, improved layout, breadcrumb navigation, file size display, etc.

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Use of space, balance between file list and preview, toolbar clarity.
Good: list/preview proportional, toolbar buttons discoverable, status bar informative.
Bad: preview too narrow, wasted space, toolbar cramped.

### READABILITY (R)
Text legibility, information hierarchy, scannable content.
Good: file names clear, preview formatted well, search results scannable.
Bad: dense unformatted text walls, no visual anchors, line numbers hard to read.

### AESTHETIC (A)
Colour harmony via theme tokens, visual interest, icon quality.
Good: theme-consistent, file type icons meaningful, borders/chrome polished.
Bad: monochrome, generic, no visual variety.

### COHERENCE (Co)
Feels like one designed thing. Toolbar, list, preview, status bar connected.
Good: unified chrome, consistent spacing, filter/search feel integrated.
Bad: widgets feel bolted on, status bar orphaned, preview disconnected.

### CHARACTER (Ch)
Personality, charm. Does it feel like a proper file manager worth using?
Good: thoughtful details, breadcrumbs, file metadata, keyboard shortcuts visible.
Bad: bare-minimum browser, no personality, could be any ls output.

## Primary Metric

ui_score = (L + R + A + Co + Ch) / 5

## Scoring Discipline

- Score EACH axis independently before averaging
- Compare against baseline screenshot, not memory
- Same score = discard (no neutral keeps)
- Feature additions (markdown preview, search fix) count toward readability and character

## Key Imports Available

From `../services/markdown-service.js`:
- `renderMarkdown(text, width, opts)` — returns string[] of formatted lines
- `renderMarkdownFile(filePath, width, opts)` — reads file and renders
- `PLAIN_HEADING_CONFIG`, `DEFAULT_FIGLET_HEADING_CONFIG`

Already imported in browser-windows.ts:
- `theme()`, `createScrollbar()`, `clipToVisibleWidth`, `padToWidth`
- `createRestyleBundle`, `createSelectableList`, `deferRender`
- `setViewportContent` (local helper)

## Constraints

- No new npm dependencies
- Must pass `bun run typecheck`
- Module must load — File Manager must appear in app and be openable
- Use theme tokens everywhere — never hardcode colours
- The preview pane uses `tags: false` by default — if enabling tags for blessed colour markup, test carefully
- `setViewportContent` does line-fitting; markdown rendering returns pre-formatted lines that may need different handling
- Directory selection must NOT crash the app

## Current Structure

- Toolbar: path label + filter/search/view-mode buttons
- Filter row (left) + search row (right)
- Left pane: selectable list (list view) or icon grid (icon view)
- Right pane: preview (raw text with line numbers)
- Status bar: item count + sort/refresh buttons
- Keyboard: enter=open, v=view, /=filter, s=search, tab=toggle view, backspace=parent

## What's Been Tried

- #1 baseline (4.4): Small 72x20 window, plain dir listing, no colour, no markdown preview
- #2 keep (6.0): Responsive sizing (85% screen), dir preview with contents, file type icons, markdown rendering, JSON pretty-print, dir crash fix
- #3 keep (6.6): Breadcrumb nav, total file size in status, docs/ folder visible
- #4 keep (7.0): Tags on preview, coloured dir preview (cyan dirs, green files), gray line numbers, escaped braces
- #5 keep (7.6): Dynamic title bar, dir child counts (3), file sizes in preview, keyboard hints in status
- #6 keep (8.0): Coloured file type icons in list (green md, cyan dirs, yellow ts/js, magenta json, gray sizes)
- #7 keep (9.0): Search overhaul — colour-coded results, match line arrows, result count in title, Quick Look, copy path, reveal in Finder, right-click context menu
