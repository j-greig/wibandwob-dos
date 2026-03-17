---
id: E050
title: "File Manager v3: Column Browser & Architecture Rewrite"
status: not-started
depends_on: []
---

# E047 — File Manager v3: Column Browser & Architecture Rewrite

## Problem

The current file manager (1858 LOC, single function) has:
- **No column navigation** — two-pane split, not Finder-style columns
- **1800-line god-function** with 23 mutable `let` bindings
- **3 implicit state machines** (browse/search/edit) with no enforcement
- **120 lines of duplicated key handlers** (list vs icon views)
- **Screen-level mouse listener leak** on window close
- **Preview pane grabs focus** — can't navigate back to file list easily

## Vision

macOS Finder column browser adapted for the terminal:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⌂ ~ / src / core /                                      File Mgr  │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ .agents/     │ application/ │▸app-control… │ /**                    │
│ .pi/         │▸core/        │ blessed-aug… │  * Application compo…  │
│ .planning/   │ runtime/     │ cli.ts       │  * Owns startup, me…  │
│ docs/        │ sdk/         │ clipboard.ts │  */                    │
│ microapps/   │ services/    │ command-cat… │                        │
│ scripts/     │ tests/       │ command-reg… │ import blessed from…   │
│▸src/         │ ui/          │ config.ts    │ import { patchBless…   │
│              │ windows/     │ …            │ …                      │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│ 14 items │ 8 dirs, 6 files (42K) │ git:clean │ ↵:open e:edit E:ext │
└─────────────────────────────────────────────────────────────────────┘
```

### Column model
- **N directory columns** — each click into a subdir opens a new column to the right, scrolling left columns
- **Rightmost column for files** — selecting a file shows preview in the **preview pane** (rightmost)
- **Preview pane** — read-only, with markdown rendering, code syntax highlighting, directory stats
- **Enter** from preview → opens in appropriate app (Code Editor for code, text-viewer for markdown, microapp for microapp-saved files)
- **Breadcrumb** is clickable — click any path segment to collapse columns back
- **Backspace** goes up one level (collapses rightmost column)

### Architecture rewrite
- **Module decomposition** — split 1858-line god function into ~10 focused modules
- **Explicit state machine** — `mode: "browse" | "search" | "edit"` union, no impossible states
- **Single action dispatcher** — one `dispatch(action)` function, both views bind keys → actions
- **Clean widget lifecycle** — no leaked screen listeners, proper cleanup

## Architecture

```
src/windows/file-manager/
├── index.ts                    # ~100 lines: createFrame, register, glue
├── state.ts                    # FileManagerState type + transitions
├── columns.ts                  # Column browser: create/destroy/scroll columns
├── preview.ts                  # Preview rendering (md, code, json, dir, search)
├── search.ts                   # ripgrep search engine + result display
├── keys.ts                     # FileAction union + key→action mapper (one source)
├── git.ts                      # Git status refresh + indicators
├── icons.ts                    # fileIcon, fileColour, formatSize — pure functions
├── context-menu.ts             # Right-click menu
├── editor-overlay.ts           # Inline edit mode (blessed.textarea)
└── types.ts                    # Shared types, FileEntry, SortField, etc.
```

### State design

```typescript
type FileManagerMode =
  | { kind: "browse" }
  | { kind: "search"; query: string; results: SearchResult[]; process: ChildProcess | null }
  | { kind: "edit"; filePath: string; dirty: boolean };

interface ColumnState {
  path: string;
  entries: FileEntry[];
  selectedIndex: number;
  scrollOffset: number;
}

interface FileManagerState {
  mode: FileManagerMode;
  columns: ColumnState[];      // array of directory columns (left to right)
  activeColumn: number;        // index of focused column
  previewFile: string | null;  // file being previewed (rightmost pane)
  viewMode: "columns" | "icon";
  sortField: SortField;
  filterValue: string;
  splitRatio: number;          // preview pane width ratio
  splitLocked: boolean;
  git: { root: string | null; statusMap: Map<string, string> };
}
```

### Action dispatcher (DRY fix for duplicated key handlers)

```typescript
type FileAction =
  | "open" | "view" | "edit" | "quicklook"
  | "copy-path" | "yank-contents" | "external-editor" | "reveal"
  | "navigate-into" | "navigate-up" | "navigate-to-column"
  | "filter-focus" | "search-start" | "search-cancel"
  | "toggle-view" | "sort-cycle" | "refresh"
  | "context-menu";

function dispatch(state: FileManagerState, action: FileAction, args?: unknown): void
```

### Preview pane (read-only, formatted)

Uses existing infrastructure:
- `renderMarkdownFile()` from `markdown-service.ts` for `.md` files
- `highlightCode()` from `syntax-highlight.ts` for code files
- Directory stats renderer (already exists in v2)
- JSON pretty-printer (already exists in v2)

**Enter from preview** → routes to appropriate opener:
- `.ts/.js/.py` etc → `microapp.wibwob.slap-editor.open` (Code Editor)
- `.md` → text-viewer in reader mode
- Files with matching microapp → that microapp's open command

### Right-click context menu

Existing context menu preserved, enhanced with column-aware actions:
- Open / Open in Editor / Open External
- Copy Path / Yank Contents
- Reveal in Finder
- New File / New Folder (stub → implement later)

## Features & Stories

### F01 — Architecture: Module decomposition + state machine

- [ ] S01: Define `FileManagerState` type + `ColumnState` in `types.ts`
- [ ] S02: Extract pure functions (icons, git, formatSize) to modules
- [ ] S03: Extract preview renderer to `preview.ts`
- [ ] S04: Extract search engine to `search.ts`
- [ ] S05: Build action dispatcher in `keys.ts`
- [ ] S06: Wire new modules into single entry point `index.ts`
- [ ] S07: Fix screen-level mouse listener leak (cleanup on window destroy)

### F02 — Column browser

- [ ] S08: Column widget: `createColumn()` → blessed list, tracks path + entries
- [ ] S09: Navigation: clicking dir creates new column, backspace collapses
- [ ] S10: Horizontal scroll when columns exceed window width
- [ ] S11: Breadcrumb bar becomes clickable (click segment → collapse to that depth)
- [ ] S12: Column selection sync — active column highlighted, others dimmed

### F03 — Preview pane (formatted, read-only)

- [ ] S13: Preview renders in rightmost pane (after all columns)
- [ ] S14: Markdown rendering with headings, code blocks, lists
- [ ] S15: Code syntax highlighting
- [ ] S16: Directory stats (existing, adapted to column model)
- [ ] S17: Enter from preview → open in appropriate app

### F04 — Polish & integration

- [ ] S18: Context menu works in column view
- [ ] S19: Workspace save/restore includes column state
- [ ] S20: `describeState()` / `captureText()` updated for columns
- [ ] S21: COAT commands updated: `finder.navigate` works with column paths
- [ ] S22: All existing keybinds (Y, E, e, c, o, etc.) work in column mode

## Non-goals

- Tree view (too small for columns — icon view covers that niche)
- Tabs / multi-window file manager (one window, multiple columns)
- Built-in terminal pane
- Full vim editing in preview (that's what Code Editor is for)

## Verification

```bash
bun run health                    # tests + typecheck + COAT + 0 circular deps
npx madge --circular src/         # no new cycles from module split
wibwob commands -q | grep finder  # all finder.* commands still registered
```

Visual: column navigation feels like macOS Finder. Breadcrumb clickable.
Preview renders markdown/code formatted. Enter opens correct app.

## Risk

- **Blessed column layout** — dynamic column count with horizontal scroll is non-trivial in blessed. May need custom positioning math.
- **Migration** — v2 has workspace restore state. v3 column state is different shape. Need migration path.
- **LOC** — rewrite may temporarily increase total LOC before v2 cleanup.

## Key insight from code review

> "The function is a 1,800-line closure ball. Every inner function captures mutable `let` state via closure. Extraction requires first lifting state into a shared object."

The state-first approach (F01 S01–S02) unblocks everything else. Don't start columns until state is clean.
