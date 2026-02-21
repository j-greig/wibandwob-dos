# MISSION 8 — Paint Canvas MCP Tools: Let Wib&Wob Draw

> Origin: User observation (2026-02-21) — Wib&Wob can open a paint canvas but have no tools to actually draw on it

## The Problem

Wib&Wob have `tui_new_paint_canvas` to open a canvas, but zero MCP tools to put pixels, draw lines, write text, or read what's on the canvas. They can look at it but can't touch it.

## The Good News

The C++ IPC layer ALREADY has full paint commands implemented in `app/api_ipc.cpp`:

| IPC command     | What it does                         | Parameters                          |
|----------------|--------------------------------------|-------------------------------------|
| `paint_cell`   | Set a single cell (pixel)           | id, x, y, fg, bg                   |
| `paint_text`   | Write text string at position       | id, x, y, text, fg, bg             |
| `paint_line`   | Draw a line between two points      | id, x0, y0, x1, y1, erase?        |
| `paint_rect`   | Draw a rectangle                    | id, x0, y0, x1, y1, erase?        |
| `paint_clear`  | Clear the entire canvas             | id                                  |
| `paint_export` | Export canvas as text                | id                                  |
| `get_canvas_size` | Get canvas dimensions            | (none)                              |

Canvas view also supports: `setFg`, `setBg`, `setTool` (Pencil/Eraser/Line/Rect/Text), `setPixelMode` (Full/HalfY/HalfX/Quarter/Text), `putLine`, `putRect`.

The Python API server and both MCP surfaces (Node + Python) have NONE of these wired up.

## Scope

Wire existing C++ paint IPC commands to MCP tools. No new C++ code needed — just the API/MCP last mile.

## Task Queue

```json
[
  {
    "id": "M8-T01",
    "status": "todo",
    "title": "Add paint IPC commands to Python controller",
    "steps": [
      "Add paint_cell, paint_text, paint_line, paint_rect, paint_clear, paint_export to controller.py",
      "Route them through exec_command with correct arg mapping",
      "Add get_canvas_size if not already present"
    ]
  },
  {
    "id": "M8-T02",
    "status": "todo",
    "title": "Add Python MCP tools for paint",
    "steps": [
      "tui_paint_cell — set a single cell at (x,y) with fg/bg colour",
      "tui_paint_text — write text string at (x,y) with fg/bg",
      "tui_paint_line — draw line from (x0,y0) to (x1,y1)",
      "tui_paint_rect — draw rectangle from (x0,y0) to (x1,y1)",
      "tui_paint_clear — clear the canvas",
      "tui_paint_read — export canvas as text (so they can see what they drew)",
      "All tools take optional window_id param, default to topmost paint window",
      "Add to mcp_tools.py"
    ]
  },
  {
    "id": "M8-T03",
    "status": "todo",
    "title": "Add Node MCP tools for paint",
    "steps": [
      "Mirror all Python paint tools in mcp_tools.js",
      "Same parameter schemas",
      "Auto-derive into MCP whitelist (already handled by M5 pattern)"
    ]
  },
  {
    "id": "M8-T04",
    "status": "todo",
    "title": "Add paint tools to Wib&Wob prompt",
    "steps": [
      "Add paint tool descriptions to extradiegetic knowledge section",
      "Include colour reference (0-15 CGA palette)",
      "Include canvas coordinate system explanation",
      "Add creative guidance: 'you can draw, not just open canvases'"
    ]
  },
  {
    "id": "M8-T05",
    "status": "todo",
    "title": "Test end-to-end paint flow",
    "steps": [
      "Open paint canvas via API",
      "Draw a simple shape via paint_line/paint_rect",
      "Write text via paint_text",
      "Read back via paint_export — verify content",
      "Ask Wib&Wob to draw something and verify they use the tools"
    ]
  },
  {
    "id": "M8-T06",
    "status": "todo",
    "title": "Parity test",
    "steps": [
      "Add paint tools to test_node_mcp_parity.py",
      "Verify Node and Python surfaces both expose all paint tools"
    ]
  }
]
```

## Colour Reference (CGA 16-colour palette)

For prompt documentation:

```
 0 = black       8 = dark grey
 1 = dark blue   9 = blue
 2 = dark green  10 = green
 3 = dark cyan   11 = cyan
 4 = dark red    12 = red
 5 = dark magenta 13 = magenta
 6 = brown       14 = yellow
 7 = light grey  15 = white
```

## Notes

- Canvas coordinate system: (0,0) is top-left, x increases right, y increases down
- Canvas size depends on window size and pixel mode (Full = 1:1, HalfY = 2x vertical resolution)
- `paint_export` returns ASCII text representation — useful for Wib&Wob to "see" what they drew
- The `id` parameter maps to window ID from `tui_get_state` — allows targeting specific canvases if multiple are open
- Pixel modes and tool selection (Pencil/Line/Rect/Text) are set per-canvas but not yet exposed via IPC — could add `paint_set_tool` and `paint_set_mode` as stretch goals

## Synesthetic Desktop Link (MISSION 6)

Once Wib&Wob can draw, the MISSION 6 synesthetic event bus becomes much more powerful:
- Paint canvas publishes dominant palette → theme shifts
- Wib&Wob become visual artists, not just conversationalists
