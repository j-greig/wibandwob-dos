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

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| [`pi-vim`](https://www.npmjs.com/package/pi-vim) | 0.1.9 | Vim modal editing | Very new (hours old), blessed compat unknown — **spike first** |
| [`pi-open-here`](https://www.npmjs.com/package/pi-open-here) | 0.1.0 | External editor launch | More stable, lightweight, low risk |

---

## Features & Stories

### F00 — Validation Spike

#### S00 — Spike: validate `pi-vim` works inside a blessed box element
**Status:** not-started

Before committing to F01, validate that `pi-vim` can drive a blessed text widget:
- Does it assume a browser DOM or Node streams?
- Can it receive keypress events from blessed's event system?
- Does it handle blessed's tag-based colour rendering?
- What's the performance like on a 1000-line file?

If `pi-vim` doesn't work with blessed, evaluate alternatives:
- Build a minimal vim engine in TypeScript (normal/insert/visual + core operators)
- Use `@anthropic/vim-engine` or similar if it exists
- Fork `pi-vim` and adapt for blessed

**Timebox: 4 hours.**

- [ ] AC-00: Spike produces a written verdict (works / needs adaptation / build custom) with evidence.
  Test: Document in `.planning/spikes/spk-pi-vim-blessed/spike.md`.

### F01 — Vim Modal Editing in Preview Pane

#### S01 — Integrate vim-mode editing
**Status:** not-started (blocked on S00 spike)

Add a vim-style modal editor to the File Manager's right-hand preview pane.
When a file is selected, pressing `e` (or `i`) enters edit mode with full vim
keybindings: normal, insert, visual modes; operators (d/c/y/p); text objects
(w/W/b/e/iw/aw/i"/a"); line motions (0/$); ex commands (`:w`, `:q`, `:wq`).

The mode indicator shows in the status bar: `-- NORMAL --`, `-- INSERT --`,
`-- VISUAL --`.

**COAT compliance**: expose `finder.edit` and `finder.save` commands in the
catalog so vim editing is API-callable. The vim keybindings are TUI chrome
over these commands.

- [ ] AC-01: `finder.edit` command registered in `command-catalog.ts`.
  Test: `wibwob commands -q | grep finder.edit` returns the command.
- [ ] AC-02: `finder.save` command registered in `command-catalog.ts`.
  Test: `wibwob commands -q | grep finder.save` returns the command.
- [ ] AC-03: Pressing `e` on a file in the list enters edit mode in the preview pane.
  Test: Select a `.ts` file → press `e` → cursor appears, mode indicator shows `NORMAL`.
- [ ] AC-04: Normal mode: `h/j/k/l`, `w/b/e`, `0/$`, `gg/G`, `{/}` all work.
  Test: Navigate a 100-line file using each motion → cursor moves correctly.
- [ ] AC-05: Operators: `dd`, `yy`, `p`, `cc`, `ciw`, `di"`, `da(` all work.
  Test: Perform each operation → text modified correctly.
- [ ] AC-06: Insert mode: `i/a/o/O/A/I` enter insert, `Escape` returns to normal.
  Test: Enter insert mode via each key → type text → Escape → back to normal.
- [ ] AC-07: Visual mode: `v` (char), `V` (line) select text; `d/y` operate on selection.
  Test: `v` → move → `d` → selection deleted.
- [ ] AC-08: `:w` saves file, `:q` exits edit mode, `:wq` saves and exits.
  Test: Edit file → `:w` → file saved to disk; `:q` → back to preview mode.
- [ ] AC-09: Mode indicator in status bar updates on mode change.
  Test: Visual verify status bar shows current vim mode.
- [ ] AC-10: Syntax highlighting preserved in edit mode.
  Test: Edit a `.ts` file → colours maintained.
- [ ] AC-11: Undo/redo via `u` and `Ctrl+R`.
  Test: Make changes → `u` → reverted; `Ctrl+R` → re-applied.
- [ ] AC-12: `finder.edit` API call opens edit mode from outside.
  Test: `POST /commands/run { "id": "finder.edit", "args": { "path": "/tmp/test.ts" } }` → edit mode active.
- [ ] AC-13: Integration test for `finder.edit` and `finder.save`.
  Test: `bun run test:integration` includes file manager edit tests.

### F02 — Open in External Editor

#### S02 — `pi-open-here` integration for external editor launch
**Status:** not-started

Add a keybind (`Shift+E`) to open the selected file in the user's preferred
external editor. Uses `pi-open-here` which has built-in CLI launchers for:
`code` (VSCode), `cursor`, `windsurf`, `zed`, `subl`, `idea`.

Auto-detects which editors are installed. If multiple are available, shows a
quick-pick overlay. Respects `$VISUAL` / `$EDITOR` env vars as override.

- [ ] AC-14: Pressing `Shift+E` on a selected file opens it in an external editor.
  Test: Select file → `Shift+E` → file opens in VSCode/Cursor/Zed (whichever installed).
- [ ] AC-15: If multiple editors installed, overlay shows picker.
  Test: With VSCode + Cursor installed → press `Shift+E` → picker appears.
- [ ] AC-16: `$VISUAL` or `$EDITOR` env var overrides auto-detection.
  Test: `VISUAL=zed` → press `Shift+E` → always opens in Zed.
- [ ] AC-17: Works for directories too — opens directory in editor's file tree.
  Test: Select a directory → `Shift+E` → editor opens with that folder.
- [ ] AC-18: Flash message confirms which editor was launched.
  Test: Press `Shift+E` → flash "Opened in Cursor" (or similar).
- [ ] AC-19: `finder.open-external` command registered in catalog (COAT: API-callable).
  Test: `POST /commands/run { "id": "finder.open-external", "args": { "path": "..." } }` works.

### F03 — Draggable Sidebar Split

#### S03 — Land and polish responsive split + drag divider
**Status:** in-progress

Code is on `main` branch in `src/windows/file-manager-window.ts`. Changes:
- Default narrower (responsive: 28% wide / 35% normal / 45% compact).
- Mouse drag on the vertical divider to resize.
- `splitLocked` flag: once dragged, responsive auto-resize stops.
- Visual hover hint on divider (accent colour).
- Bug fix: `frame?.body` optional chaining to avoid init crash.

**Needs:** restart verification, edge-case testing, commit.

- [ ] AC-20: Default split ratio is narrower than 42% on normal-width windows.
  Test: Open File Manager at 120-col width → sidebar is ~35%.
- [ ] AC-21: Responsive breakpoints: <80 cols = 45%, 80–130 = 35%, >130 = 28%.
  Test: Resize window through breakpoints → ratio adjusts.
- [ ] AC-22: Mouse drag on divider resizes the split.
  Test: Click divider → drag left/right → panels resize.
- [ ] AC-23: After manual drag, resizing the window doesn't reset the ratio.
  Test: Drag to 50% → resize window → still 50%.
- [ ] AC-24: Clamped to 15%–70% — neither pane can fully collapse.
  Test: Drag to extreme left/right → stops at clamp boundary.

### F04 — Export & Share

#### S04 — Export and share actions for files
**Status:** not-started

Add file export/share capabilities accessible via keybind or command.
**First deliverable**: register `finder.share` in `command-catalog.ts`.

- [ ] AC-25: `finder.share` registered in `command-catalog.ts` with args schema.
  Test: `wibwob commands -q | grep finder.share` returns the command.
- [ ] AC-26: `Y` (yank) copies file **contents** to clipboard (not path — `c` still copies path).
  Test: Select file → `Y` → paste in another app → file contents appear.
- [ ] AC-27: `finder.export-listing` command exports directory tree as markdown.
  Test: `POST /commands/run { "id": "finder.export-listing" }` → markdown file written.
- [ ] AC-28: `finder.share` available via API — copies path or contents to clipboard.
  Test: API call → clipboard populated.
- [ ] AC-29: Integration tests for new commands.
  Test: `bun run test:integration` covers finder.share and finder.export-listing.
