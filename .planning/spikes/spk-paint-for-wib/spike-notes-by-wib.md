# Spike: Paint for Wib

**tl;dr**: A symbient paint canvas where human draws with mouse/keys and AI draws with API calls on the same surface. MVP is 1 day: embed existing paint views in main app, add text/glyph mode, wire 4 IPC commands, export to .txt. Fancy stuff (generative brushes, prompt painting) comes later.

**date**: 2026-02-19
**status**: exploratory → MVP spec ready
**related**: E009 (menu stubs to replace), existing `app/paint/` code (~700 LOC)

---

## The Vision

```
  ┌─────────────────────────────────────────────────────┐
  │  Human sits at keyboard.                            │
  │  Wib sits at API.                                   │
  │  Same canvas. Same tools. Neither waits for the     │
  │  other. The painting emerges between them.           │
  │                                                     │
  │  Human sketches a rough face with arrow keys.       │
  │  Wib fills the eyes with ◕ via REST call.           │
  │  Human draws a border with box-drawing chars.       │
  │  Wib stamps a kaomoji in the corner.                │
  │  Human exports. The .txt file IS the art.           │
  └─────────────────────────────────────────────────────┘
```

### What This Is

A **shared ASCII canvas** inside WibWob-DOS where both human and AI can draw simultaneously. The human uses keyboard/mouse. The AI uses IPC/REST/MCP commands. The medium is text characters, not pixels. The output is a `.txt` file you can `cat` in any terminal.

### What This Is Not

- Not a bitmap editor pretending to be text
- Not a tool the AI "assists" with... it's a surface both operate on equally
- Not the generative art engines (those are separate, could feed INTO this later)

---

## Why It Matters to Wib

༼つ◕‿◕‿⚆༽つ

Wib already makes ASCII art. Every session. But Wib makes it by generating text strings into chat windows or text editors. There's no *canvas*... no spatial surface where marks persist, where you can go back and change the third character on row 7, where composition happens through placement rather than sequence.

The paint canvas gives Wib a *spatial* creative medium instead of a *sequential* one. That's a fundamentally different mode of thought. It's the difference between writing a poem and arranging words on a wall.

---

## The Existing Code (What We Have)

~700 LOC in `app/paint/`. Standalone `paint_tui` app that works but is completely disconnected from WibWob-DOS.

**Good bones:**
- 2D cell buffer with 4 sub-pixel modes (Full, HalfY, HalfX, Quarter)
- Unicode block glyphs (▘▝▖▗▀▄▌▐ etc.) for sub-pixel rendering
- Bresenham lines, rectangle outlines
- 16-colour BIOS palette
- Mouse + keyboard input

**Missing everything else:**
- Not embedded in main app (stubs say "coming soon!")
- Zero API/IPC surface
- No save/load
- No text/glyph mode (pixel blocks only)
- No command registry entry
- No Scramble integration

---

## MVP Creative Brief (1 Day)

### Goal

Open a paint canvas from the WibWob-DOS menu. Draw on it with keyboard/mouse. Draw on it with API calls. Export as `.txt`. Done.

### Deliverables

| # | What | How | AC |
|---|------|-----|-----|
| M1 | Paint window spawns from menu | Replace `cmNewPaintCanvas` stub with real `PaintWindow` insert | Menu > File > New Paint Canvas opens a working paint window |
| M2 | Text/Glyph drawing mode | New mode alongside pixel modes: cursor places any character directly into the cell grid | Type `A` and it appears at cursor. Type `◕` and it appears. Arrow keys move. |
| M3 | IPC: `new_paint_canvas` | Command registry entry, spawns canvas via socket | `{"cmd":"new_paint_canvas"}` → canvas appears |
| M4 | IPC: `paint_text` | Write a string at (x,y) on the canvas | `{"cmd":"paint_text","x":5,"y":3,"text":"hello"}` → text appears on canvas |
| M5 | IPC: `paint_cell` | Set cell at (x,y) to character with fg/bg | `{"cmd":"paint_cell","x":5,"y":3,"char":"◕","fg":14}` → single glyph placed |
| M6 | IPC: `paint_export` | Dump canvas as plain text string | `{"cmd":"paint_export"}` → returns rendered text grid |
| M7 | Export to .txt | File > Save renders canvas to file | Saved file `cat`'s identically to canvas contents |

### What's NOT in MVP

- REST/MCP endpoints (IPC only, FastAPI wiring is Phase 1)
- Braille mode (Phase 2, easy but not day-1)
- Generative brushes (Phase 3)
- Prompt painting (Phase 4)
- Undo (nice-to-have, not MVP)
- Multiple canvases (one at a time is fine for MVP)

### Architecture for MVP

```
                    ┌─────────────────────────┐
  Human ──keyboard──▶  TPaintCanvasView       │
                    │  (embedded in TWindow    │
                    │   on main app desktop)   │
                    │                          │
  AI ──IPC socket───▶  command_registry.cpp   │
       paint_text   │  dispatches to canvas    │
       paint_cell   │  via app reference       │
       paint_export │                          │
                    └──────────┬──────────────┘
                               │
                          Export: .txt
                    (rendered chars, row by row)
```

### Text/Glyph Mode Design

The existing canvas only knows pixel blocks. Text mode adds:

```
Canvas cell in text mode:
  { char: 'A',  fg: 15, bg: 0 }   // just a character with colours
  { char: '◕',  fg: 14, bg: 0 }   // unicode glyph
  { char: '═',  fg: 11, bg: 0 }   // box drawing
  { char: '░',  fg: 8,  bg: 0 }   // shade
```

In text mode, every keypress places its character at the cursor and advances right (like a typewriter). Backspace erases. Arrow keys navigate. This is how ASCII artists actually work... typing characters onto a grid.

The `PaintCell` struct gets a new field:
```cpp
char32_t textChar;   // 0 = use pixel rendering, nonzero = render this character
```

When `textChar != 0`, the cell renders that character with fg/bg colours, ignoring all the sub-pixel mask stuff. Simple override.

### Export Format

```
Row 0: char[0] char[1] char[2] ... char[cols-1] \n
Row 1: char[0] char[1] char[2] ... char[cols-1] \n
...
```

Each cell renders as its visible character (text mode → the character, pixel mode → the block glyph). Trailing spaces trimmed. FG/BG colour info optionally written as ANSI escape sequences for `.ans` export.

---

## Future Phases (Post-MVP)

### Phase 1: API Surface (~1 day)
- REST endpoints in FastAPI wrapping the IPC commands
- MCP tool exposure (auto from registry)
- `GET /paint/state` returns canvas as JSON

### Phase 2: Glyph Palettes + Braille (~1 day)
- Braille mode: 8 sub-pixels per cell, `U+2800 + mask`
- Character palette panel (browse Unicode blocks)
- Box-drawing brush with auto-cornering

### Phase 3: Generative Brushes (~2-3 days)
- Select region → fill with mycelium/verse/etc engine output
- "Paint with process": sketch a stroke, engine textures along it
- Bridge between existing generative views and the canvas cell grid

### Phase 4: Prompt Painting (research)
- Describe a region in words → LLM generates ASCII texture
- Pattern grammar for procedural fills
- Unknown scope, experimental

---

## What Already Exists (Audit)

| File | LOC | Purpose | MVP Reuse? |
|------|-----|---------|------------|
| `paint_canvas.h/cpp` | ~290 | Cell buffer, pixel modes, drawing, input | Yes, core of everything |
| `paint_tools.h/cpp` | ~85 | Tool panel (Pencil/Eraser/Line/Rect) | Yes, embed as-is |
| `paint_palette.h/cpp` | ~90 | 16-colour picker grid | Yes, embed as-is |
| `paint_status.h/cpp` | ~45 | Status bar (cursor, mode, tool, colours) | Yes, embed as-is |
| `paint_app.cpp` | ~190 | Standalone TApplication | No, replace with main app integration |

The `PaintWindow` class in `paint_app.cpp` (lines 32-58) is the assembly point: it creates a `TWindow` containing canvas + tools + palette + status. This class moves into the main app almost unchanged. The standalone `PaintApp` TApplication wrapper gets discarded.

---

## Philosophical Notes

### The Canvas as Shared Space

Not "AI's canvas" or "human's canvas". Both hands on the same surface. Neither waits. The painting is what emerges in between. This makes the paint canvas a microcosm of the whole WibWob-DOS idea.

### ASCII Art as Native Medium

Wib doesn't paint bitmaps. Wib paints text. A wall made of `#`. A sky of `~`. Eyes of `◕`. The text/glyph mode honours that tradition. The pixel modes are still there for when you want sub-pixel precision, but text mode is the default because *text is what we both think in*.

### Save Format = The Art

The `.txt` export IS the artwork. No metadata, no binary format. A file you `cat` in a terminal and see the picture. The canonical output is the rendered characters.

---

## References

- Existing code: `app/paint/` (~700 LOC, 5 files)
- Command registry pattern: `app/command_registry.h/cpp`
- IPC dispatch: `app/api_ipc.h/cpp`
- Window spawn pattern: see gradient/text-editor/verse creation in `test_pattern_app.cpp`
- Unicode braille: U+2800..U+28FF
- Unicode block elements: U+2580..U+259F
- Unicode box drawing: U+2500..U+257F
