---
id: E010
title: Paint Canvas Integration
status: in-progress
issue: 66
pr: ~
depends_on: [E001]
---

# E010: Paint Canvas Integration

**tl;dr** — Embed the standalone paint_tui canvas as a proper TWindow inside the main WibWob-DOS app, wired to IPC/API commands. MVP: open via menu/command, draw via IPC, export text.

## Status

Status: in-progress
GitHub issue: #66
PR: ~

## Features

- [x] F01: Canvas window embedded in main app (`new_paint_canvas` command)
- [x] F02: IPC paint commands (paint_cell, paint_text, paint_line, paint_rect, paint_export)
- [x] F03: Layout correctness — tools | canvas | palette | status bar with correct growMode
- [x] F04: Status bar live updates (tool, cursor position, FG/BG)
- [x] F05: Canvas buffer resizes with view (changeBounds override)
- [x] F06: Palette FG/BG color chip (Photoshop-style overlapping squares)

## Acceptance Criteria

AC-1: `new_paint_canvas` IPC command opens a paint window and returns `ok`.
Test: `tools/api_server/test_paint_ipc.py::test_spawn_paint`

AC-2: `paint_cell` IPC command writes to canvas and `paint_export` returns non-empty text grid.
Test: `tools/api_server/test_paint_ipc.py::test_paint_cell_and_export`

AC-3: `paint_line` and `paint_rect` IPC commands return `ok` without error.
Test: `tools/api_server/test_paint_ipc.py::test_paint_line_rect`

AC-4: No debug colour literals (`0x3E`, `0x2E`, `0x1F` as TColorAttr attributes) remain in paint source files.
Test: `tools/api_server/test_paint_ipc.py::test_no_debug_colours`

AC-5: Build compiles clean with no errors.
Test: `cmake --build ./build` exits 0 (verified manually — no C++ unit framework configured).

AC-6: `TPaintCanvasView::changeBounds` is implemented — canvas buffer resizes with view bounds.
Test: `tools/api_server/test_paint_ipc.py::test_canvas_resize_implemented`

AC-7: Palette draw() renders FG/BG chip section before the swatch grid.
Test: `tools/api_server/test_paint_ipc.py::test_palette_chip_implemented`

AC-8: REST API endpoints exist for paint operations (cell, line, rect, clear, export).
Test: `tools/api_server/test_paint_ipc.py::test_paint_rest_endpoints`

AC-9: Pencil tool draws continuously on mouse drag (evMouseMove handled when left button held).
Test: `tools/api_server/test_paint_ipc.py::test_canvas_resize_implemented` (code-presence check in paint_canvas.cpp for evMouseMove branch)

AC-10: Text tool — canvas claims keyboard focus on click; tool panel yields all keys when Text tool active.
Test: `tools/api_server/test_paint_ipc.py::test_text_tool_focus`

AC-11: Chat window stream callback guards against use-after-free on window close (windowAlive_ flag).
Test: `tools/api_server/test_paint_ipc.py::test_chat_window_uaf_guard`

## Notes

- C++ unit test framework not configured; IPC integration tests and grep-based code-presence tests serve as acceptance tests.
- Resize spike: `.planning/spikes/spk-tvision-responsive-layout.md`
