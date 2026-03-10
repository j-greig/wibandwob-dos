---
id: E030
title: ZINE Multi-File Editor
status: not-started
issue: ~
pr: ~
depends_on: [E028]
---

# E030 — ZINE Multi-File Editor

ZINE becomes a persistent multi-document editor. A hideable left sidebar
lists all discovered `.canvas.yaml` files. Clicking one loads it into the
main canvas area — same hot-reload, same panel editing. Works like VSCode's
file explorer or the Primer Browser, but for canvas documents.

## Problem

1. ZINE opens exactly one file and forgets it when closed. No file switching
   without closing and reopening.
2. No discovery — you must know the file path. No way to browse what canvas
   docs exist.
3. Each open is a fresh window with its own watcher. Ten ZINEs = ten watchers,
   ten windows, no shared file list.

## Outcome

One ZINE window. Sidebar lists all `.canvas.yaml` files found under
`content/` (and any user-configured paths). Click to load. Sidebar
hides/shows with a toggle key or button. Hot reload still works on the
active file.

---

## Design

### Sidebar

Blessed `list` on the left, fixed width (default 24 cols). Toggle with `[`
or a sidebar button in the ZINE status bar.

When hidden: canvas gets full width. When shown: canvas shrinks by sidebar
width + 1 (divider).

Sidebar entries:
- Filename without path and extension (e.g. `demo` not `demo.canvas.yaml`)
- Active file highlighted with `▶` prefix
- Grouped by directory if files span multiple dirs (simple header rows)

### File discovery

Scan `content/` recursively for `*.canvas.yaml` at open time + on sidebar
toggle. Debounced rescan on `fs.watch` of the `content/` directory tree
(watch dirs not files, 500ms debounce).

Validation: only list files where YAML parses without error AND has
`format: "sy2-canvas-v1"` (or equivalent) in `meta`. Bad files shown with
`⚠` prefix and are not loadable.

### File switching

Clicking a sidebar entry:
1. Closes the current file watcher
2. Resets `cePanelDefs`, `columnHeaderMap`, `contentOverrides`,
   `panelPositionOverrides`
3. Loads new file, rebuilds layout, attaches new watcher
4. Updates window title to `ZINE: <new title>`

No new window opened. Same blessed nodes, swapped content.

### Sidebar toggle

- Key `[` toggles sidebar
- Status bar shows `[ ]` or `[▶]` sidebar indicator
- Sidebar state persists in `describeState()` for API visibility
- Agent can toggle via `POST /windows/input` with `[`

### API

`microapp.wibwob.zine.open` already accepts `filePath`. No change needed.
`describeState()` gains:
```ts
sidebarOpen: boolean;
availableFiles: string[];  // absolute paths of discovered canvas files
activeFile: string;        // currently loaded file path
```

---

## Stories

- [ ] S01 — Sidebar UI (blessed list, toggle, divider, width)
- [ ] S02 — File discovery (recursive scan, validation, grouped display)
- [ ] S03 — File switching (swap content in-place, title update, watcher handoff)
- [ ] S04 — describeState + API parity

---

## Acceptance criteria

- [ ] AC-1: Sidebar shows with `[` key, hides with `[` again — canvas reflows
- [ ] AC-2: All `.canvas.yaml` files under `content/` listed on open
- [ ] AC-3: Active file has `▶` indicator in sidebar
- [ ] AC-4: Clicking a sidebar entry loads that file, rebuilds canvas, updates title
- [ ] AC-5: Hot reload still works after switching files (new watcher on new file)
- [ ] AC-6: Invalid/unparseable YAML files shown with `⚠`, not loadable
- [ ] AC-7: `describeState()` includes `sidebarOpen`, `availableFiles`, `activeFile`
- [ ] AC-8: `bun run typecheck` clean
- [ ] AC-9: Smoke — open ZINE, toggle sidebar, switch file, confirm title changes

## Out of scope

- Creating new canvas files from within ZINE (future)
- Renaming/deleting files from sidebar (future)
- User-configured additional scan paths (future — hardcoded `content/` for now)
- Nested tree expand/collapse (flat list for now, dir headers only)
