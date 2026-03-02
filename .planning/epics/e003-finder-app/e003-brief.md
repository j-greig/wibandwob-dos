---
Status: not-started
Type: epic
GitHub issue: #104
PR: —
---

# E003 — Finder App

## TL;DR

A Finder window for WibWob-DOS (TS TUI) that lets users browse the filesystem
and search file contents. The window has a search field in the top-right chrome
area. Two search modes: simple (grep/ripgrep-style substring and glob matching)
and advanced (QMD-powered semantic and keyword search across indexed markdown
collections).

## Read First

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/020-target-architecture.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/020-target-architecture.md)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/000-docs-overview.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/000-docs-overview.md)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/004-window-type-registry-and-factories.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/004-window-type-registry-and-factories.md)

## Architecture Bucket

Content Surfaces (per 000-docs-overview.md).

## Objective

Give WibWob-DOS a native file browser and search surface. The Finder is a
first-class window type registered through the window factory and command
registry. It should feel like a classic file manager (directory tree or list
on the left, file preview on the right) with an integrated search field that
makes both local filesystem search and QMD knowledge-base search accessible
without leaving the TUI.

## Motivation

Currently there is no way to browse or search files from inside the TUI
desktop. Users must drop to a terminal. A Finder window makes the desktop
self-sufficient for file navigation and, with QMD integration, turns the
desktop into a knowledge-base search tool — the same QMD collections the
agent uses become directly accessible to the human.

## Design

### Window Layout

```
┌─ Finder ─────────────────────────────── [Search: ________] ┐
│ /Users/james/Repos/wibandwob-dos                           │
│ ┌──────────────┬───────────────────────────────────────────┐│
│ │ ..           │                                           ││
│ │ .planning/   │  (file preview or search results)        ││
│ │ src/         │                                           ││
│ │ docs/        │                                           ││
│ │ package.json │                                           ││
│ │ README.md    │                                           ││
│ └──────────────┴───────────────────────────────────────────┘│
│ 6 items | 2 dirs, 4 files                 [Simple|Advanced] │
└─────────────────────────────────────────────────────────────┘
```

- Left pane: directory listing (navigable with arrow keys, Enter to descend).
- Right pane: file preview when a file is selected, or search results when a
  search is active.
- Top-right chrome: search input field, always visible.
- Bottom-right: mode toggle between Simple and Advanced search.
- Status bar: item count, path breadcrumb.

### Simple Search (Unix Search)

Grep-style search over the current directory tree:

- Substring match across file contents (shelling out to ripgrep or grep).
- Glob filtering on filenames (e.g. *.md, src/**/*.ts).
- Results shown as a flat list: file path, line number, matching line.
- Selecting a result opens the file preview pane at that line.
- Runs as a spawned child process; streams results incrementally.

### Advanced Search (QMD)

QMD-powered search over indexed markdown collections:

- Invokes QMD CLI or HTTP API (localhost:8181) with structured queries.
- Supports lex (BM25 keyword), vec (semantic), and hyde (hypothetical doc)
  query types — surfaced as a simple text input that defaults to auto-expand
  for single-line queries.
- Results show: document title, collection, score, and a context snippet.
- Selecting a result opens the full document in the preview pane (via
  qmd get) or optionally in a separate Document Reader window.
- QMD collections are auto-discovered via qmd status.
- If QMD is not installed or not running, Advanced mode is greyed out with
  a status message; Simple mode remains fully functional.

### Integration Points

- Window factory: registered as type "finder" in the window type registry.
- Command registry: "open_finder" command, available from Applications menu.
- Agent tools: the Finder becomes an agent-visible surface — the agent can
  open a Finder, navigate to a path, or trigger a search via commands.
- Workspace persistence: Finder state (current path, last search, split
  position) saved and restored with workspace snapshots.

## Acceptance Criteria

- [ ] AC-1: Finder window opens from Applications menu and displays directory
  contents for a given path.
  Test: Open Finder via command; verify directory listing renders with correct
  item count; navigate into a subdirectory and back.

- [ ] AC-2: Simple search returns grep-style results for a query string
  scoped to the current directory tree.
  Test: Open Finder at repo root; search for "WindowFacade"; verify results
  include file paths, line numbers, and matching lines from known files.

- [ ] AC-3: Advanced search returns QMD results when QMD is available.
  Test: With QMD running and a collection indexed, search for a known term;
  verify results include title, score, and snippet; select a result and
  verify preview renders document content.

- [ ] AC-4: Advanced search degrades gracefully when QMD is unavailable.
  Test: With QMD stopped, switch to Advanced mode; verify a clear status
  message appears; verify Simple search still works.

- [ ] AC-5: File preview pane shows content of the selected file or search
  result with basic syntax awareness (line numbers at minimum).
  Test: Select a .ts file in the directory listing; verify preview shows
  file content with line numbers.

- [ ] AC-6: Finder is registered in the window factory and command registry
  and is agent-accessible.
  Test: Verify "open_finder" appears in command list; verify agent can open
  a Finder and trigger a search via the command surface.

- [ ] AC-7: Finder state persists across workspace save/restore.
  Test: Open Finder at a specific path with a search active; save workspace;
  restore workspace; verify Finder reopens with same path and search.

## Planned Features / Stories

- [ ] F01 — Core Finder window (directory listing, navigation, file preview)
- [ ] F02 — Simple search (grep/rg integration, incremental results)
- [ ] F03 — Advanced search (QMD integration, query modes, graceful fallback)
- [ ] F04 — Command registry and agent surface integration
- [ ] F05 — Workspace persistence for Finder state

## Dependencies

- Window factory and command registry (018-command-registry-and-tool-adapter-prd.md)
  should be stable before F04.
- QMD must be installed and collections indexed for F03 to be testable.
- No hard dependency on E002 (root migration) — can be built inside
  spikes/ts-tui-mvp and migrated later.

## Open Questions

- Should the Finder support opening files in the built-in editor, or only
  preview? Probably both — preview by default, Enter or double-action to
  open in editor.
- Should QMD indexing be triggerable from the Finder UI (e.g. "Reindex"
  button), or is that out of scope?
- File icons / type indicators in the directory listing — worth doing in
  a text TUI, or just use trailing / for dirs and file extensions?
