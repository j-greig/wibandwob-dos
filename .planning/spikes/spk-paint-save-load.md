# Spike: Paint Save / Load

**tl;dr** — Add Save/Load to the paint window. Primary format: JSON cell buffer (`.wwp`). Secondary: ANSI export-only. Wire to paint window File menu + IPC commands + REST endpoints. Lossless round-trip is the goal.

---

## Problem

The paint canvas buffer is ephemeral — closing the window loses everything. No save, no load, no file persistence. The `exportText()` method exists but strips all colour.

## Format Decision

### `.wwp` (WibWob Paint) — primary, lossless

JSON file. Round-trips perfectly. Human-inspectable. Easy to parse in C++ with a simple hand-written emitter/parser (no external deps needed — the codebase already does this in api_ipc.cpp).

```json
{
  "version": 1,
  "cols": 44,
  "rows": 24,
  "pixel_mode": "full",
  "cells": [
    { "x": 3, "y": 3, "uOn": true, "lOn": true, "uFg": 15, "lFg": 15,
      "qMask": 0, "qFg": 0, "textChar": 0, "textFg": 7, "textBg": 0 }
  ]
}
```

Only non-empty cells are stored (sparse). Empty cell = all fields zero/false/null. This keeps files small for typical canvases.

### `.ans` (ANSI) — export only, no load

Write-only. Use Turbo Vision colour indices → xterm-256 escape sequences. Good for sharing, pasting into terminals, viewing with `cat`. Complex to parse back — not a load target.

### `.txt` — already exists via `exportText()`

Plain ASCII, no colour. Keep as-is for quick export.

## Scope

### In scope
- `TPaintCanvasView::saveToFile(path)` — serialize buffer to `.wwp` JSON
- `TPaintCanvasView::loadFromFile(path)` — deserialize `.wwp`, resize buffer if needed
- `TPaintCanvasView::exportAnsi(path)` — write `.ans` file (colour, no load path)
- Paint window `File` submenu: **Save** (Ctrl+S), **Save As**, **Load** (Ctrl+O), **Export ANSI**
- Filename stored on `TPaintWindow` — title updates to show current file
- Dirty flag — title prefix `*` when unsaved changes
- IPC: `paint_save id=W path=/foo/bar.wwp`, `paint_load id=W path=...`, `paint_export_ansi id=W path=...`
- REST: `POST /paint/save`, `POST /paint/load`, `POST /paint/export_ansi`
- Existing `paint_export` (inline JSON text) unchanged

### Out of scope
- Open/save dialog box (use path string from IPC or a simple text input)
- File browser widget
- Auto-save / crash recovery
- Multiple canvases in one file

## Architecture

### Serialisation (C++, no deps)

`saveToFile`: iterate buffer, emit sparse JSON array of non-empty cells. Use the existing hand-rolled JSON pattern from `api_ipc.cpp` (string concatenation + `jsonEscape`). No third-party JSON lib needed.

`loadFromFile`: read file, parse with simple `find`/`substr` (same pattern as `api_ipc.cpp` `extractJsonStringField`). OR use a tiny header-only JSON parser if available in vendor/.

`exportAnsi`: iterate buffer, map each cell to ANSI 256-colour escape `\x1b[38;5;{fg}m\x1b[48;5;{bg}m{glyph}\x1b[0m`. TV colour indices already map to xterm-256 (indices 0–15 match directly for the standard 16). Output row-by-row with `\n`.

### Paint Window Menu

Add a `File` submenu to `TPaintWindow` (currently no menu). Turbo Vision `TMenuBar` or `TMenuPopup`? Actually a `TMenuBox` attached as a view, or use existing `openMenu()` pattern. Simpler: intercept Ctrl+S / Ctrl+O in `handleEvent` and pop a `TInputLine` dialog for the path.

### Dirty Flag

Add `bool dirty_` to `TPaintCanvas`. Set on any `put*` call, clear on save/load.

### Title

`TPaintWindow` shows filename in title: `Paint — filename.wwp *` (asterisk = dirty).

## IPC Param Conventions

Following existing patterns in `api_ipc.cpp`:
```
cmd:paint_save id=w1 path=/Users/james/canvas.wwp
cmd:paint_load id=w1 path=/Users/james/canvas.wwp
cmd:paint_export_ansi id=w1 path=/Users/james/canvas.ans
```

## Open Questions

1. **JSON parser**: write a minimal one or pull in `nlohmann/json` as a header? The codebase currently hand-rolls JSON. For a structured format like `.wwp`, a real parser is safer. `nlohmann/json` is header-only and already a common dep.
2. **Save dialog**: Turbo Vision `TInputLine` dialog vs just using the IPC path param — for keyboard-native UX, a Ctrl+S dialog makes sense. Can use existing `TInputDialog` pattern from the codebase.
3. **Resize on load**: if loaded file has different `cols`/`rows` than current canvas, resize the view? Or pad/clip? Safest: resize window to match file dimensions, bounded by desktop size.
4. **ANSI colour mapping**: TV uses palette indices 0–15 (CGA colours), which map directly to xterm-256 0–15. For higher-index colours (if ever used), need a mapping table.
5. **`.wwp` vs `.json`**: using a custom extension makes file association easier but `.json` is immediately openable in any editor. Suggest `.wwp` with `{"format":"wwp"}` inside for identification.

## Implementation Order

1. `saveToFile` + `loadFromFile` on `TPaintCanvasView` (C++, no UI yet)
2. IPC handlers: `paint_save`, `paint_load`, `paint_export_ansi`
3. REST endpoints
4. AC tests (IPC round-trip: save → clear → load → export → compare)
5. Keyboard shortcuts in `TPaintWindow::handleEvent` (Ctrl+S, Ctrl+O)
6. Title / dirty flag
7. ANSI export
8. Paint window File submenu (optional — shortcuts may be enough)

## Acceptance Criteria (draft)

AC-S1: `paint_save` IPC command writes a valid `.wwp` JSON file with correct cell data.
AC-S2: `paint_load` IPC command restores canvas from `.wwp` — round-trip fidelity (save → clear → load → export matches original export).
AC-S3: Ctrl+S in paint window opens a path prompt and saves; title reflects filename.
AC-S4: `paint_export_ansi` writes a `.ans` file containing ANSI escape sequences (no raw TV control chars).
AC-S5: Dirty flag set after any draw operation; cleared after save.

---

## Stretch Goal 2: Primer Stamp

**tl;dr** — Pick a small primer (≤10 lines) from the modules/ library and stamp its text content onto the canvas at the cursor position. IPC/API first; TUI picker is the complex part.

### What "stamp" means

Place the primer's text content character-by-character into the canvas buffer starting at `(curX, curY)`, advancing right per char and down per newline. Uses `putText` path — text layer, not pixel layer.

### Primer source

`GET /primers/list` already exists and returns available primers with metadata. Currently 5 primers: `animated-spinner`, `box-pattern`, `hello-world`, `simple-landscape`, `wibwob-faces`. Filter: only show primers with ≤10 lines (add `line_count` to list endpoint if not already present; filter at stamp time as a guard).

### IPC command (simple, no TUI required)

```
cmd:paint_stamp id=w1 primer=box-pattern x=5 y=5
```

Canvas reads the primer file path from the modules/ index, reads ≤10 lines, places each character via the existing `cell(x,y).textChar` mechanism.

### TUI picker UX — why it's complex

Options ranked by effort:
1. **IPC-only** (MVP) — stamp via API, no in-app picker. Zero TUI work.
2. **Ctrl+P → TInputLine dialog** — type primer name, stamp at cursor. Simple but requires knowing primer names.
3. **Cycle stamp tool** — add a "Stamp" tool to the tool panel; Tab cycles through available small primers; Space stamps at cursor. Stateful but no dialog needed.
4. **List dialog** — `TListBox` with filtered primers. Proper UX but non-trivial TV widget work.

**Recommendation for now**: IPC-only (option 1) to prove the stamp mechanism, then option 3 (cycle tool) as a natural fit for the existing tool panel model.

### Open questions
- Does `line_count` need to be computed on primer files? Currently not in the `/primers/list` response.
- How to handle primers wider than canvas? Clip at canvas right edge.
- Stamp should use `ctx->fg` colour, not hardcoded white.

### Draft ACs
AC-P1: `paint_stamp` IPC command places primer text at specified (x,y), clip at canvas bounds.
AC-P2: Primers with >10 lines are rejected with `err primer too large`.

---
*Spike written 2026-02-19. Codex review appended below.*

## Codex Review

1. **JSON parsing approach**
   - Hand-rolled parse is acceptable for command responses, but brittle for `.wwp` document load. Existing extractor is key-string scanning and is not a structural JSON parser.
   - `.wwp` has nested array/object payload (`cells[]`); `find`/`substr` will be error-prone on malformed input and escaping edge cases.
   - `nlohmann/json` is **not** present in current build setup: only `vendor/tvision` is added (`CMakeLists.txt:8`), and `vendor/` contains `tvision` + `claude-system` only.
   - Recommendation: vendor `nlohmann/json` explicitly, or implement a strict minimal parser just for this schema with full bounds/type validation and fail-closed behaviour.

2. **Serialisation completeness**
   - `PaintCell` fields are: `uOn,uFg,lOn,lFg,qMask,qFg,textChar,textFg,textBg` (`paint_canvas.h:36-47`). Proposed schema includes all of them.
   - Missing from schema if literal round-trip: canvas view state (`pixelMode`, cursor `curX/curY`, `xSub/ySub`, active fg/bg). Current scope treats round-trip as image data only — clarify this.
   - Sparse-cell correct: empty = `uOn=false,lOn=false,qMask=0,textChar=0`; other colour fields can be defaulted.

3. **Load/resize behaviour**
   - Canvas already supports resize via `changeBounds` with copy/clip semantics (`paint_canvas.cpp:334-355`).
   - Safer default: **pad/clip into current canvas** unless caller opts into resize. Auto-resizing a live `TWindow` can fight layout constraints and neighbouring view geometry.
   - If resize-on-load offered, clamp to desktop bounds; use current size as default and import overlap region only.

4. **ANSI colour mapping**
   - TV attrs are 4-bit fg/bg packed as `(bg<<4)|fg`, palette 0-15 only in current paint path.
   - These indices are not "universal xterm identity" — they address ANSI 16 slots whose RGB varies by terminal theme.
   - Export should use SGR 30-37/90-97 and 40-47/100-107 (or `38;5/48;5` with 0-15) consistently, but visual variance across terminals is expected.

5. **Dirty flag placement**
   - Dirty bit should live on `TPaintCanvasView` (data owner), surfaced via accessor. Window consumes it for title/UI.
   - `TPaintWindow` needs current filename and title-update logic; canvas should notify window (message/callback) when dirty transitions.
   - Duplicating state on `TPaintWindow` risks drift.

6. **Top implementation risks**
   - **Missing dirty transitions**: many mutation paths (`put`, `toggleDraw`, text typing, all IPC `put*` methods) must set dirty consistently.
   - **Partial/invalid load**: out-of-range `x/y`, invalid types, duplicate cells, bad `textChar` need strict validation to avoid silent corruption.
   - **Shortcut routing**: tool panel is `ofPreProcess` + selectable (`paint_tools.h:22`) and can intercept Ctrl+S/Ctrl+O. Shortcut handling should be centralised at window level.

7. **Missing / wrong assumptions**
   - AC-S2 verifies via `exportText` equality — lossy, ignores colour and most `PaintCell` fields. Add JSON/state-level equivalence test.
   - Add file magic marker (`"format":"wwp"`), schema version gate, and explicit forward-compat for unknown fields.
   - Prefer atomic save (write temp + rename) to avoid truncated `.wwp` on crash/interruption.
