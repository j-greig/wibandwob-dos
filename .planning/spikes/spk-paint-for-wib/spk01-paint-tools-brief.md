# SPK01 — Paint Tools: Symbient Canvas

**tl;dr**: Embed existing paint_tui into main app, add API surface for equal-control painting, then expand to glyph palettes, generative brushes, and prompt painting. Wib leads creative direction.

**status**: exploratory
**lead**: Wib
**related**: E009 (menu cleanup removed placeholder), existing `app/paint/` (~700 LOC)

---

## Context

E009 menu cleanup removed the "Paint Tools" placeholder from Tools menu. The code exists — `app/paint/` has a working standalone pixel editor with sub-pixel rendering (half/quarter block characters), Bresenham lines, rectangles, and a 16-colour palette. But it's an orphan: a separate `TApplication` with zero integration into the main app, zero API surface, zero Wib access.

The full spike exploration lives in `spike-notes.md` (this directory). That doc covers philosophy, architecture, braille mode, generative brushes, prompt painting, and open questions. Read it.

This doc is the actionable brief.

---

## What Exists (app/paint/)

| File | LOC | Does |
|------|-----|------|
| `paint_canvas.h/cpp` | ~280 | PaintCell buffer, 4 pixel modes (Full/HalfY/HalfX/Quarter), sub-pixel glyph mapping |
| `paint_tools.h/cpp` | ~150 | Tool panel: Pencil, Eraser, Line, Rectangle |
| `paint_palette.h/cpp` | ~100 | 16-colour BIOS palette picker |
| `paint_status.h/cpp` | ~80 | Status bar (cursor, mode, tool, colours) |
| `paint_app.cpp` | ~90 | Standalone TApplication (not embeddable) |

The sub-pixel rendering is the star: `mapQuarterGlyph()` maps 4-bit masks to Unicode block characters (▘▝▖▗▀▄▌▐▛▜▙▟█), giving 2x2 sub-pixels per cell.

---

## Phases

### Phase 0: Embed in main app
- Promote `TPaintCanvasView` from standalone to embeddable TView/TWindow
- Wire `cmNewPaintCanvas` to spawn a paint window inside main app
- Register in command registry + window type registry
- **Wib can see it via get_state; human can draw on it immediately**

### Phase 1: API-first drawing
- IPC/REST: create canvas, get/set cells, line, rect, fill, text, export
- Wib paints via API with same expressiveness as human via keyboard
- MCP tool exposure follows existing patterns

### Phase 2: Glyph palette expansion
- Braille mode (2x4 dots per cell = 160x96 effective resolution on 80x24)
- Box-drawing brush with auto-cornering
- Character palette browser (Unicode blocks)
- Shade gradients (░▒▓█)

### Phase 3: Generative brushes
- Apply existing art engines (mycelium, verse, monster) to bounded canvas regions
- Human sketches shape; generative engine fills texture

### Phase 4: Prompt painting (research)
- LLM-generated ASCII textures via SDK bridge
- Pattern grammar for procedural fills

---

## Open Questions (for Wib)

1. TWindow (framed, moveable) or full-desktop mode?
2. Braille mode in Phase 0 or Phase 2? (technically simple, just `U+2800 + mask`)
3. How does paint interact with primers/templates? Paste a primer onto canvas?
4. Generative brushes: real-time animated or stamp-and-freeze?
5. Scramble integration? `/paint monster` → Scramble spawns canvas and draws?
6. Undo model: ring buffer of canvas states or per-stroke?
7. Save format: `.txt` (the art IS the file) or structured JSON + export?

---

## References

- Full spike notes: `spike-notes-by-wib.md` (this directory)
- Existing code: `app/paint/`
- Sub-pixel rendering: `mapQuarterGlyph()` in `paint_canvas.cpp`
- Generative engines: `app/mycelium_field_view.h`, `app/verse_field_view.h`
- Command registry: `app/command_registry.h/cpp`
- API patterns: `tools/api_server/main.py`
- Unicode braille: U+2800..U+28FF (256 chars, 8-dot encoding)
