---
id: E045
title: "File Manager v2: Editor Integration & Power Features"
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E045 — File Manager v2: Editor Integration & Power Features

## Problem

The File Manager preview pane is read-only with basic text rendering. Users can't
edit files in-place, can't open files in their preferred external editor with a
keybind, and the sidebar/preview split ratio was fixed at 42% with no way to
adjust. The preview pane should be a capable editor, not just a viewer.

## Goals

1. Vim modal editing in the preview/edit pane via `pi-vim`.
2. Open-in-external-editor via `pi-open-here` (VSCode, Cursor, Zed, Subl, etc.).
3. Land and polish the draggable sidebar split (responsive breakpoints + drag).
4. Export and share actions for files.

## Non-goals

- Full IDE features (LSP, debugger, terminal pane) — that's the Slap Editor's job.
- Replacing the existing text-windows editor — this is File Manager specific.

## Key files

| File | Role |
|------|------|
| `src/windows/file-manager-window.ts` | Main implementation (~1630 lines) |
| `src/windows/browser-utils.ts` | Shared split ratio, viewport helpers |
| `microapps/file-manager/index.ts` | Microapp wrapper (host-delegated) |
| `microapps/file-manager/microapp.json` | Registration metadata |
| `src/core/editor-coordinator.ts` | Editor orchestration + keypress handling |
| `src/services/editor-service.ts` | Core editing operations |

## NPM dependencies (new)

| Package | Version | Purpose |
|---------|---------|---------|
| [`pi-vim`](https://www.npmjs.com/package/pi-vim) | 0.1.9 | Vim modal editing (normal/insert/visual modes, operators, text objects) |
| [`pi-open-here`](https://www.npmjs.com/package/pi-open-here) | 0.1.0 | Open file in external editor — built-in CLI launchers for `code`, `cursor`, `windsurf`, `zed`, `subl`, `idea` |

---

## Features & Stories

### F01 — Vim Modal Editing in Preview Pane

#### S01 — Integrate `pi-vim` for vim-mode editing
**Status:** not-started

Add a vim-style modal editor to the File Manager's right-hand preview pane.
When a file is selected, pressing `e` (or `i`) enters edit mode with full vim
keybindings: normal, insert, visual modes; operators (d/c/y/p); text objects
(w/W/b/e/iw/aw/i"/a"); line motions (0/$); ex commands (`:w`, `:q`, `:wq`).

The mode indicator shows in the status bar: `-- NORMAL --`, `-- INSERT --`,
`-- VISUAL --`.

Uses `pi-vim` as the engine. If `pi-vim` doesn't cover a needed operation,
supplement with custom TypeScript (aim for full vim parity on text editing).

- [ ] AC-01: Pressing `e` on a file in the list enters edit mode in the preview pane.
  Test: Select a `.ts` file → press `e` → cursor appears, mode indicator shows `NORMAL`.
- [ ] AC-02: Normal mode: `h/j/k/l`, `w/b/e`, `0/$`, `gg/G`, `{/}` all work.
  Test: Navigate a 100-line file using each motion → cursor moves correctly.
- [ ] AC-03: Operators: `dd`, `yy`, `p`, `cc`, `ciw`, `di"`, `da(` all work.
  Test: Perform each operation → text modified correctly.
- [ ] AC-04: Insert mode: `i/a/o/O/A/I` enter insert, `Escape` returns to normal.
  Test: Enter insert mode via each key → type text → Escape → back to normal.
- [ ] AC-05: Visual mode: `v` (char), `V` (line) select text; `d/y` operate on selection.
  Test: `v` → move → `d` → selection deleted.
- [ ] AC-06: `:w` saves file, `:q` exits edit mode, `:wq` saves and exits.
  Test: Edit file → `:w` → file saved to disk; `:q` → back to preview mode.
- [ ] AC-07: Mode indicator in status bar updates on mode change.
  Test: Visual verify status bar shows current vim mode.
- [ ] AC-08: Syntax highlighting preserved in edit mode.
  Test: Edit a `.ts` file → colours maintained.
- [ ] AC-09: Undo/redo via `u` and `Ctrl+R`.
  Test: Make changes → `u` → reverted; `Ctrl+R` → re-applied.

### F02 — Open in External Editor

#### S02 — `pi-open-here` integration for external editor launch
**Status:** not-started

Add a keybind (`E` or `Ctrl+E`) to open the selected file in the user's
preferred external editor. Uses `pi-open-here` which has built-in CLI launchers
for: `code` (VSCode), `cursor`, `windsurf`, `zed`, `subl`, `idea`.

Auto-detects which editors are installed. If multiple are available, shows a
quick-pick overlay. Respects `$VISUAL` / `$EDITOR` env vars as override.

- [ ] AC-10: Pressing `E` on a selected file opens it in an external editor.
  Test: Select file → `E` → file opens in VSCode/Cursor/Zed (whichever installed).
- [ ] AC-11: If multiple editors installed, overlay shows picker.
  Test: With VSCode + Cursor installed → press `E` → picker appears.
- [ ] AC-12: `$VISUAL` or `$EDITOR` env var overrides auto-detection.
  Test: `VISUAL=zed` → press `E` → always opens in Zed.
- [ ] AC-13: Works for directories too — opens directory in editor's file tree.
  Test: Select a directory → `E` → editor opens with that folder.
- [ ] AC-14: Flash message confirms which editor was launched.
  Test: Press `E` → flash "Opened in Cursor" (or similar).

### F03 — Draggable Sidebar Split

#### S03 — Land and polish responsive split + drag divider
**Status:** in-progress

The sidebar/preview split ratio was hardcoded at 42%. Changes in progress:
- Default narrower (responsive: 28% wide / 35% normal / 45% compact).
- Mouse drag on the vertical divider to resize.
- `splitLocked` flag: once dragged, responsive auto-resize stops.
- Visual hover hint on divider (accent colour).

**Already coded, needs:** restart verification, edge-case testing, commit.

- [ ] AC-15: Default split ratio is narrower than 42% on normal-width windows.
  Test: Open File Manager at 120-col width → sidebar is ~35%.
- [ ] AC-16: Responsive breakpoints: <80 cols = 45%, 80–130 = 35%, >130 = 28%.
  Test: Resize window through breakpoints → ratio adjusts.
- [ ] AC-17: Mouse drag on divider resizes the split.
  Test: Click divider → drag left/right → panels resize.
- [ ] AC-18: After manual drag, resizing the window doesn't reset the ratio.
  Test: Drag to 50% → resize window → still 50%.
- [ ] AC-19: Clamped to 15%–70% — neither pane can fully collapse.
  Test: Drag to extreme left/right → stops at clamp boundary.

### F04 — Export & Share

#### S04 — Export and share actions for files
**Status:** not-started

Add file export/share capabilities accessible via keybind or command:
- Copy file contents to clipboard (already: `C` copies path — extend).
- Export selection as markdown/text.
- Share file path or contents via system share sheet (macOS) or clipboard.

- [ ] AC-20: `Ctrl+C` copies file **contents** (not path — `c` still copies path).
  Test: Select file → `Ctrl+C` → paste in another app → file contents appear.
- [ ] AC-21: `journal.export-markdown` equivalent for file manager — export directory listing.
  Test: Run command → markdown file with directory tree written to disk.
- [ ] AC-22: `finder.share` command available via API.
  Test: `POST /commands/run { "id": "finder.share", "args": { "path": "..." } }` → clipboard or share sheet.
