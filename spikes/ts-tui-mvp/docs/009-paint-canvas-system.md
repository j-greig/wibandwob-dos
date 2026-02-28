# 009 — Paint Canvas System

> Developer handover for the WibWob-DOS TypeScript rebuild.
> Covers the agent-driven paint canvas: cell model, tools, file format, IPC API, and TS rebuild notes.

---

## 1. Cell Model

Every canvas position is a `PaintCell` — a composite struct supporting multiple rendering layers. The canvas is a flat `cols × rows` buffer addressed as `buffer[y * cols + x]`.

```
struct PaintCell {
    // Half-Y layer (upper/lower half-block rendering)
    bool    uOn;       // upper half active
    uint8_t uFg;       // upper half foreground colour (0–15)
    bool    lOn;       // lower half active
    uint8_t lFg;       // lower half foreground colour (0–15)

    // Quarter-block / Half-X layer
    uint8_t qMask;     // bitmask: bit0=TL, bit1=TR, bit2=BL, bit3=BR
    uint8_t qFg;       // ink colour for all active quadrants

    // Text layer (wins over all pixel layers when non-zero)
    char    textChar;  // 0 = empty/transparent
    uint8_t textFg;    // text foreground colour
    uint8_t textBg;    // text background colour
};
```

### Layer priority (draw compositing)

1. **Text layer** — if `textChar != 0`, renders that ASCII char with `textFg`/`textBg`. Always wins.
2. **Quarter/HalfX data** — if `qMask != 0` and pixel mode is Quarter or HalfX, uses Unicode quarter-block glyphs.
3. **Half-Y / Full data** — if `uOn || lOn`, uses half-block or full-block Unicode glyphs.
4. **Fallback quarter** — quarter data still visible even when mode is Full/HalfY.
5. **Empty** — space character.

### Implication for TS rebuild

The cell model is the single source of truth. Each cell stores **all layers simultaneously** — the pixel mode only changes which layer `put()` writes to and which renderer path `draw()` prefers. A TypeScript `PaintCell` interface should mirror this multi-layer design exactly.

---

## 2. Coordinate System

- **(0, 0)** is the **top-left** corner of the canvas.
- **x** increases **rightward** (column index).
- **y** increases **downward** (row index).
- Canvas dimensions are `cols` (width) × `rows` (height).
- Coordinates are clamped to `[0, cols-1]` and `[0, rows-1]` by all API functions.

Sub-pixel addressing (keyboard-interactive only, not exposed via IPC):
- `ySub`: 0 = upper half, 1 = lower half (for HalfY/Quarter modes).
- `xSub`: 0 = left half, 1 = right half (for HalfX/Quarter modes).

---

## 3. Colour Palette — CGA 16-Colour (0–15)

All `fg` and `bg` parameters are CGA BIOS colour indices, masked to `& 0x0F`.

| Index | Name           | Index | Name            |
|-------|----------------|-------|-----------------|
| 0     | Black          | 8     | Dark Grey       |
| 1     | Blue           | 9     | Light Blue      |
| 2     | Green          | 10    | Light Green     |
| 3     | Cyan           | 11    | Light Cyan      |
| 4     | Red            | 12    | Light Red       |
| 5     | Magenta        | 13    | Light Magenta   |
| 6     | Brown/DkYellow | 14    | Yellow          |
| 7     | Light Grey     | 15    | White (default) |

Default canvas: `fg = 15` (white ink), `bg = 0` (black background).

The attribute byte sent to TDrawBuffer is `(bg << 4) | (fg & 0x0F)` — standard CGA attribute encoding.

---

## 4. Pixel Modes

The canvas supports five rendering modes that control which layer `put()` writes to:

| Mode      | Resolution multiplier | How it writes                                      |
|-----------|-----------------------|----------------------------------------------------|
| `Full`    | 1×1 per cell          | Sets both `uOn` + `lOn` with current `fg`          |
| `HalfY`   | 1×2 per cell          | Sets `uOn` or `lOn` based on `ySub`                |
| `HalfX`   | 2×1 per cell          | Sets left pair (TL\|BL) or right pair (TR\|BR) of `qMask` |
| `Quarter` | 2×2 per cell          | Sets individual quadrant bit in `qMask`             |
| `Text`    | 1×1 per cell          | Places/removes ASCII characters in text layer       |

Unicode block glyphs used for rendering:

- Full block: `█` (U+2588)
- Upper half: `▀` (U+2580) — upper on, lower off
- Lower half: `▄` (U+2584) — lower on, upper off
- Two-colour half: `▀` with fg = upper colour, bg = lower colour
- Quarter blocks: 16 combinations mapped to `▘▝▖▗▀▄▌▐▚▞▛▜▙▟█` (space for 0x0)
- Left/right half: `▌` (U+258C), `▐` (U+2590)

---

## 5. Paint Tools (Interactive)

Five tools available via keyboard or tool panel:

| Tool    | Key | Behaviour                                                      |
|---------|-----|----------------------------------------------------------------|
| Pencil  | P   | Space toggles cell at cursor. Shift+arrow draws while moving.  |
| Eraser  | E   | Same as pencil but `on = false` (clears pixel data).           |
| Line    | L   | Click start → drag → release end. Bresenham rasterisation.     |
| Rect    | R   | Click corner → drag → release opposite corner. Outline only.   |
| Text    | T   | Printable ASCII typed at cursor. Backspace erases. Enter = newline. |

Mouse: left-click draws, right-click erases. Line/Rect use drag gesture.

---

## 6. IPC Paint Commands (Agent API)

All commands are dispatched via the command registry with key-value parameters. Every drawing command requires an `id` parameter — the window ID of the paint window.

### 6.1 `new_paint_canvas`

Opens a new paint window (no params). Returns `"ok"`.

### 6.2 `open_paint_file`

| Param  | Type   | Required | Description              |
|--------|--------|----------|--------------------------|
| `path` | string | yes      | Path to `.wwp` file      |

Opens a new paint window and loads the file into it.

### 6.3 `paint_cell`

| Param | Type   | Required | Default | Description              |
|-------|--------|----------|---------|--------------------------|
| `id`  | string | yes      | —       | Paint window ID          |
| `x`   | int    | yes      | —       | Column (0-based)         |
| `y`   | int    | yes      | —       | Row (0-based)            |
| `fg`  | int    | no       | 15      | Foreground colour (0–15) |
| `bg`  | int    | no       | 0       | Background colour (0–15) |

Sets a single cell to a solid block. Internally sets `uOn = lOn = true`, `qMask = 0x0F`, clears text layer.

### 6.4 `paint_text`

| Param  | Type   | Required | Default | Description                  |
|--------|--------|----------|---------|------------------------------|
| `id`   | string | yes      | —       | Paint window ID              |
| `x`    | int    | yes      | —       | Starting column              |
| `y`    | int    | yes      | —       | Row                          |
| `text` | string | yes      | —       | ASCII string to place        |
| `fg`   | int    | no       | 15      | Text foreground colour       |
| `bg`   | int    | no       | 0       | Text background colour       |

Writes a horizontal string starting at (x, y). Each character overwrites the text layer and **clears pixel data** (`uOn = lOn = false`, `qMask = 0`) for clean rendering.

### 6.5 `paint_line`

| Param   | Type   | Required | Default | Description                     |
|---------|--------|----------|---------|---------------------------------|
| `id`    | string | yes      | —       | Paint window ID                 |
| `x0`    | int    | yes      | —       | Start column                    |
| `y0`    | int    | yes      | —       | Start row                       |
| `x1`    | int    | yes      | —       | End column                      |
| `y1`    | int    | yes      | —       | End row                         |
| `erase` | string | no       | `"0"`   | `"1"` to erase instead of draw |

Draws a line using Bresenham's algorithm. Uses the canvas's current `fg` colour (set via prior operations or default 15/white). When `erase = "1"`, clears pixels along the line.

### 6.6 `paint_rect`

| Param   | Type   | Required | Default | Description                     |
|---------|--------|----------|---------|---------------------------------|
| `id`    | string | yes      | —       | Paint window ID                 |
| `x0`    | int    | yes      | —       | First corner column             |
| `y0`    | int    | yes      | —       | First corner row                |
| `x1`    | int    | yes      | —       | Opposite corner column          |
| `y1`    | int    | yes      | —       | Opposite corner row             |
| `erase` | string | no       | `"0"`   | `"1"` to erase instead of draw |

Draws an **outline** rectangle (not filled). Coordinates are auto-sorted (min/max).

### 6.7 `paint_clear`

| Param | Type   | Required | Description     |
|-------|--------|----------|-----------------|
| `id`  | string | yes      | Paint window ID |

Clears the entire canvas to empty cells.

### 6.8 `paint_export`

| Param | Type   | Required | Description     |
|-------|--------|----------|-----------------|
| `id`  | string | yes      | Paint window ID |

Returns a **text representation** of the canvas — one line per row, using Unicode block characters for pixel data and literal characters for text data. Empty cells become spaces. Lines terminated with `\n`.

Export character mapping:
- `textChar` present → literal character
- `uOn && lOn` → `█` (full block)
- `uOn` only → `▀` (upper half)
- `lOn` only → `▄` (lower half)
- `qMask` present → best-fit Unicode block (full/left-half/right-half/upper/lower approximation)
- Empty → space

This is a **lossy** representation (no colour info). Use `paint_save` for lossless persistence.

### 6.9 `paint_save`

| Param  | Type   | Required | Description              |
|--------|--------|----------|--------------------------|
| `id`   | string | yes      | Paint window ID          |
| `path` | string | yes      | File path for `.wwp` file |

Saves the canvas in `.wwp` JSON format (see §7). Returns `"ok saved <path>"`.

### 6.10 `paint_load`

| Param  | Type   | Required | Description              |
|--------|--------|----------|--------------------------|
| `id`   | string | yes      | Paint window ID          |
| `path` | string | yes      | Path to `.wwp` file      |

Loads a `.wwp` file into an existing canvas. Canvas is cleared first. Cells from the file that fall outside the current canvas bounds are silently dropped. Returns `"ok loaded <path>"`.

### 6.11 `paint_stamp_figlet`

| Param  | Type   | Required | Default      | Description                |
|--------|--------|----------|--------------|----------------------------|
| `id`   | string | yes      | —            | Paint window ID            |
| `text` | string | yes      | —            | Text to render via FIGlet  |
| `font` | string | no       | `"standard"` | FIGlet font name           |
| `x`    | int    | no       | 0            | Left column for stamp      |
| `y`    | int    | no       | 0            | Top row for stamp          |
| `fg`   | int    | no       | 15           | Foreground colour          |
| `bg`   | int    | no       | 0            | Background colour          |

Renders ASCII art via the `figlet` CLI and stamps each non-space character into the text layer at the given position. Space characters in the FIGlet output are treated as transparent (existing canvas content shows through). Returns `"ok stamped N chars (M lines)"`.

Related commands: `list_figlet_fonts` (returns JSON array of font names), `preview_figlet` (renders text without stamping).

---

## 7. Save/Load Format — `.wwp` Files

### Structure

A `.wwp` file is a JSON document:

```json
{
  "version": 1,
  "cols": 80,
  "rows": 24,
  "cells": [
    { "x": 5, "y": 3, "uOn": true, "uFg": 12, "lOn": true, "lFg": 12 },
    { "x": 10, "y": 0, "qMask": 5, "qFg": 14 },
    { "x": 0, "y": 0, "textChar": 72, "textFg": 15, "textBg": 1 }
  ]
}
```

### Serialisation rules

- **Only non-empty cells are serialised.** A cell is empty when `uOn == false && lOn == false && qMask == 0 && textChar == 0`.
- Each cell object always has `x` and `y`.
- Optional fields are only present when their value is meaningful:
  - `uOn`, `uFg` — when upper half is active
  - `lOn`, `lFg` — when lower half is active
  - `qMask`, `qFg` — when quarter mask is non-zero
  - `textChar`, `textFg`, `textBg` — when text char is non-zero (`textChar` stored as integer/codepoint)
- **Write safety**: uses atomic write (write to `.tmp`, then rename).

### Parser

The codec uses simple string search (`parseIntAfter`, `parseBoolAfter`) rather than a full JSON parser — fragile but fast. The TS rebuild should use `JSON.parse()`.

---

## 8. Export Formats

### Text export (`paint_export`)

Plain text with Unicode block characters. No colour information. Suitable for quick agent inspection or clipboard copy.

### ANSI export (interactive menu only, `doExportAnsi`)

Writes `.ans` file with SGR escape sequences (`\x1b[38;5;Nm` for foreground, `\x1b[48;5;Nm` for background). Each row ends with `\x1b[0m\n` (reset). This is **not exposed via IPC** — only available from the paint window's File menu.

---

## 9. Agent Inspection — Canvas State Reading

There is **no dedicated `paint_read` command** in the current codebase. Agents inspect canvas state via:

1. **`paint_export`** — returns the text representation (lossy, no colours).
2. **`paint_save` + file read** — save to `.wwp`, then read the JSON file for full cell data.
3. **Window listing** — `list_windows` returns window IDs; agents use these to target paint commands.

### Typical agent workflow

```
1. new_paint_canvas                        → opens window, returns "ok"
2. list_windows                            → find the paint window ID (e.g. "win-3")
3. paint_text id=win-3 x=2 y=1 text="HELLO" fg=14 bg=1
4. paint_rect id=win-3 x0=0 y0=0 x1=30 y1=5
5. paint_stamp_figlet id=win-3 text="WOB" font=banner x=5 y=8 fg=12
6. paint_save id=win-3 path=paintings/my-art.wwp
7. paint_export id=win-3                   → returns text snapshot for verification
```

Agents typically:
- Open a canvas, get its ID from `list_windows`
- Build up artwork with `paint_text`, `paint_cell`, `paint_line`, `paint_rect`, `paint_stamp_figlet`
- Use `paint_export` to verify the result
- Use `paint_save` to persist

---

## 10. Window Structure

`TPaintWindow` (extends `TWindow`) contains:

| Child View           | Position    | Purpose                              |
|----------------------|-------------|--------------------------------------|
| `TMenuBar`           | Top row     | File/Edit/Mode menus                 |
| `TPaintToolPanel`    | Left (w=16) | Tool selector (P/E/L/R/T)           |
| `TPaintCanvasView`   | Centre      | The actual drawing surface           |
| `TPaintPaletteView`  | Right (w=20)| 4×4 colour grid, click to set fg/bg  |
| `TPaintStatusView`   | Bottom (h=1)| Shows cursor pos, tool, colours, mode |

The layout rebuilds on `changeBounds()` to reflow all panels. The canvas gets `cols = available_width`, `rows = available_height` after subtracting panels and chrome.

---

## 11. TypeScript Rebuild Recommendations

### 11.1 Cell model

```typescript
interface PaintCell {
  // Half-Y layer
  uOn: boolean; uFg: number;
  lOn: boolean; lFg: number;
  // Quarter layer
  qMask: number; qFg: number;  // bitmask: TL=1, TR=2, BL=4, BR=8
  // Text layer
  textChar: number; textFg: number; textBg: number;  // 0 = empty
}
```

Keep the multi-layer design. A flat `PaintCell[]` array (length `cols * rows`) with `cell(x, y) = buffer[y * cols + x]`.

### 11.2 Canvas as a pure model + renderer split

Separate concerns that are tangled in the C++:

1. **`PaintCanvasModel`** — pure data: cell buffer, `put()`, `putCell()`, `putText()`, `putLine()`, `putRect()`, `clear()`, `exportText()`. No TUI dependency. Fully unit-testable.
2. **`PaintCanvasRenderer`** — maps model cells to terminal output (Unicode glyphs + attributes). Owns the `mapCellToDraw()` compositing logic.
3. **`PaintCanvasView`** — TUI view that wires model + renderer, handles keyboard/mouse input.

### 11.3 .wwp codec

Use `JSON.parse()` / `JSON.stringify()` — the C++ hand-rolled parser is fragile. The sparse format (only non-empty cells) should be preserved for file size.

```typescript
interface WwpFile {
  version: 1;
  cols: number;
  rows: number;
  cells: Array<{
    x: number; y: number;
    uOn?: boolean; uFg?: number;
    lOn?: boolean; lFg?: number;
    qMask?: number; qFg?: number;
    textChar?: number; textFg?: number; textBg?: number;
  }>;
}
```

### 11.4 IPC commands → service layer

Map each `paint_*` command to a method on a `PaintService` class:

```typescript
class PaintService {
  cell(id: string, x: number, y: number, fg?: number, bg?: number): string;
  text(id: string, x: number, y: number, text: string, fg?: number, bg?: number): string;
  line(id: string, x0: number, y0: number, x1: number, y1: number, erase?: boolean): string;
  rect(id: string, x0: number, y0: number, x1: number, y1: number, erase?: boolean): string;
  clear(id: string): string;
  export(id: string): string;
  save(id: string, path: string): Promise<string>;
  load(id: string, path: string): Promise<string>;
  stampFiglet(id: string, text: string, font?: string, x?: number, y?: number, fg?: number, bg?: number): string;
}
```

### 11.5 Add `paint_read` command

The current codebase lacks a dedicated read command. The TS rebuild should add one that returns the full cell state as JSON for a region or the entire canvas:

```typescript
// paint_read id=win-3 [x0=0 y0=0 x1=79 y1=23]
// Returns sparse cell array (same format as .wwp cells)
```

This removes the need for the save-then-read-file workaround.

### 11.6 Colour handling

Keep the 16-colour CGA palette as the canonical model. Map to xterm-256 or 24-bit colour at the renderer level only. The attribute byte `(bg << 4) | fg` is the internal format.

Consider adding a `CGA_PALETTE` lookup table:

```typescript
const CGA_NAMES = [
  'black', 'blue', 'green', 'cyan', 'red', 'magenta', 'brown', 'lightGrey',
  'darkGrey', 'lightBlue', 'lightGreen', 'lightCyan', 'lightRed', 'lightMagenta', 'yellow', 'white'
] as const;
```

### 11.7 FIGlet integration

The C++ version shells out to the `figlet` CLI. For the TS rebuild, use the [`figlet`](https://www.npmjs.com/package/figlet) npm package for in-process rendering — no subprocess needed, better error handling, bundleable fonts.

### 11.8 Bresenham and rect algorithms

These are trivial to port. The line algorithm is standard Bresenham. The rect is an outline-only loop over edges. Both should live on the model, not the view.

### 11.9 Quarter-block glyph table

Port the `mapQuarterGlyph()` lookup as a const array:

```typescript
const QUARTER_GLYPHS: Record<number, string> = {
  0x0: ' ', 0x1: '▘', 0x2: '▝', 0x3: '▀', 0x4: '▖', 0x5: '▌',
  0x6: '▚', 0x7: '▛', 0x8: '▗', 0x9: '▞', 0xA: '▐', 0xB: '▜',
  0xC: '▄', 0xD: '▙', 0xE: '▟', 0xF: '█',
};
```

### 11.10 ANSI export

Expose ANSI export via IPC in the TS rebuild (currently interactive-only in C++). Useful for agents generating shareable artwork.

### 11.11 Testing priorities

1. **Cell model round-trip**: `put()` in each pixel mode → verify cell state → `exportText()`.
2. **Bresenham**: known endpoints → verify touched cells.
3. **WWP codec**: save → load → cell equality.
4. **Coordinate clamping**: out-of-bounds writes don't crash.
5. **Layer compositing**: text over pixel data → text wins.
6. **FIGlet stamp**: transparent spaces, colour application, bounds clipping.

---

## Source File Map

| File                          | Purpose                                    |
|-------------------------------|-------------------------------------------|
| `app/paint/paint_canvas.h`    | `PaintCell` struct, `TPaintCanvasView` class |
| `app/paint/paint_canvas.cpp`  | Canvas logic: draw, put, tools, export     |
| `app/paint/paint_window.h/cpp`| `TPaintWindow` — framed window with panels |
| `app/paint/paint_tools.h`     | `TPaintToolPanel` — side tool selector     |
| `app/paint/paint_palette.h`   | `TPaintPaletteView` — 4×4 colour grid      |
| `app/paint/paint_status.h`    | `TPaintStatusView` — cursor/mode status    |
| `app/paint/paint_wwp_codec.h/cpp` | `.wwp` JSON serialisation/deserialisation |
| `app/paint/paint_app.cpp`     | Standalone paint app (not used in main app)|
| `app/wwdos_app.cpp:5394+`     | IPC wrappers (`api_paint_*`, `api_spawn_paint`) |
| `app/command_registry.cpp`    | Command dispatch and parameter parsing     |
| `app/figlet_utils.h`          | FIGlet CLI wrapper for rendering           |
