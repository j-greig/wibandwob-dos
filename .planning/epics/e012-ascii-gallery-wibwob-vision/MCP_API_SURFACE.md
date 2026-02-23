# Gallery API Surface — WibWob TUI
**Last updated**: 2026-02-23 (E012 sprint 2)
**Status**: Core layout engine DONE. 5 algorithms live. Poetry mode implemented, not yet visually tested.

---

## TL;DR — What's Built

```
POST /gallery/arrange        ← main entry point — layout + open + place in one call
GET  /primers/list           ← all primers with wcwidth-accurate dimensions
GET  /primers/{name}/metadata ← single primer dimensions
POST /windows/close_all      ← clear canvas
GET  /state                  ← canvas size + all open windows
```

---

## POST /gallery/arrange

The core gallery command. Measures primers, runs layout algorithm, opens windows, applies positions.

### Request

```json
{
  "filenames": ["foo.txt", "bar.txt"],
  "algorithm": "packery",
  "padding": 2,
  "margin": 1,
  "preview": false,
  "frameless": false,
  "canvas_width": 0,
  "canvas_height": 0,
  "options": {}
}
```

| Field | Default | Notes |
|---|---|---|
| `filenames` | required | Basenames only, e.g. `"foo.txt"`. Resolved across `modules-private/` and `modules/` automatically. |
| `algorithm` | `"masonry"` | See algorithms below. |
| `padding` | `2` | Gap between windows (chars). 2 = exactly fills TV drop shadow — never go lower. |
| `margin` | `1` | Gap between window shadow edge and canvas edge. 1 aligns left edge with the File menu 'F'. |
| `preview` | `false` | If true, return plan without applying it. |
| `frameless` | `false` | Open primers without TV title/border chrome (`TGhostFrame`). |
| `canvas_width/height` | `0` | 0 = auto-query from `/state`. Always use 0 unless overriding for testing. |
| `options` | `{}` | Per-algorithm params — see below. |

### Response

```json
{
  "ok": true,
  "algorithm": "packery",
  "arrangement": [
    { "filename": "foo.txt", "x": 1, "y": 1, "width": 45, "height": 13, "window_id": "w12" }
  ],
  "canvas_width": 362,
  "canvas_height": 96,
  "canvas_utilization": 0.704,
  "overlaps": 0,
  "out_of_bounds": 0,
  "applied": true,
  "preview": false
}
```

`out_of_bounds` counts windows whose shadow would clip the canvas edge. Should always be 0. Check this after any layout change.

---

## Algorithms

### `masonry` — vertical columns, shortest-first

Pinterest-style. N fixed columns, items drop into shortest column. Items sorted by area DESC.

```json
{ "algorithm": "masonry" }
{ "algorithm": "masonry", "options": { "clamp": true } }
{ "algorithm": "masonry", "options": { "n_cols": 4 } }
```

| Option | Default | Effect |
|---|---|---|
| `clamp` | `false` | `false` = columns sized to widest item, full natural widths. `true` = columns sized to median width, items cropped at slot edge (more columns, denser). |
| `n_cols` | auto | Override column count. Auto = `usable_w // (max_or_median_w + padding)`. |

**Best for**: Any mix, 10+ items, predictable reading order.

---

### `fit_rows` — left-to-right, wrap on overflow

Items placed L→R, wrap to next row when full. Row height = tallest item in that row. Sorted tallest-first within rows.

```json
{ "algorithm": "fit_rows" }
```

**Best for**: Wide items, horizontal feel, items of similar height.

---

### `masonry_horizontal` — horizontal waterfall

Masonry rotated 90°. N fixed rows, items drop into shortest row (by accumulated width). Symmetric with `masonry` — same `clamp` / `n_rows` options.

```json
{ "algorithm": "masonry_horizontal" }
{ "algorithm": "masonry_horizontal", "options": { "clamp": true } }
{ "algorithm": "masonry_horizontal", "options": { "n_rows": 3 } }
```

**Default (clamp=false)**: rows sized to tallest item, even visual gaps, nothing clips.
**clamp=true**: more rows, taller items cropped at slot height.

**Best for**: Tall items, landscape canvases, horizontal flow.

---

### `packery` ⭐ — 2D guillotine bin-pack

True 2D free-rect bin-packing (Packery.js / Jake Gordon binary-tree approach). Items placed at ANY (x,y) position — not snapped to column rails. Large items to the top-left, small items fill the gaps.

```json
{ "algorithm": "packery" }
```

Items that find no fitting free rect are silently dropped (check `placed` vs input count). More items = better gap-filling.

**Best for**: Mixed sizes, organic/dense look, large canvases, main gallery mode.

**Key insight**: sort order matters. Largest-area-first gives best packing. Future improvement: try multiple sort orders and pick best.

---

### `cells_by_row` — uniform grid

All cells the same size (`max_w × max_h`). Items centred within their cell. Predictable, formal.

```json
{ "algorithm": "cells_by_row" }
```

**Best for**: Items of similar scale. Wastes space with mixed sizes (one outlier inflates all cells).

---

### `poetry` — packery + breathing room

Packery base with double padding and wide/tall item interleaving for open-gallery feel.

```json
{ "algorithm": "poetry" }
```

**Status**: Implemented, not yet visually verified on large canvas.

---

## GET /primers/list

Returns all primers with `wcwidth`-accurate display dimensions (outer, including TV frame border).

```json
{
  "primers": [
    {
      "name": "flatboy-2d-3d",
      "path": "modules-private/wibwobworld/primers/flatboy-2d-3d.txt",
      "size_kb": 0.7,
      "width": 45,
      "height": 13,
      "aspect_ratio": 3.462
    }
  ],
  "count": 172
}
```

**Note**: `width` and `height` are **outer** dimensions (content + 2 for TV frame border). Pass directly to `open_primer` / `resize_window`.

Width uses `wcwidth.wcswidth()` not `len()` — handles wide Unicode chars (emoji, some box-drawing) that occupy 2 terminal columns correctly.

---

## GET /primers/{filename}/metadata

Single primer. Same fields as list. Cached after first read.

```
GET /primers/flatboy-2d-3d.txt/metadata
```

---

## Key Constants (hardcoded, never change)

```python
SHADOW_W = 2           # TV drop shadow width (right edge)
SHADOW_H = 1           # TV drop shadow height (bottom edge)
CANVAS_BOTTOM_EXTRA = 1  # status bar occupies last canvas row
DEFAULT_MARGIN = 1     # gap between shadow edge and canvas edge
```

Shadow formula — verify after any placement:
```
shadow_right  = x + w + SHADOW_W        → must be ≤ canvas_w - margin
shadow_bottom = y + h + SHADOW_H + 1    → must be ≤ canvas_h - margin
```

---

## Canvas Dimensions

Always query from `/state`. Never hardcode. Current session: **362×96** (27" Cinema Display, small font, full screen).

```bash
curl -s http://127.0.0.1:8089/state | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d['canvas']['width'], d['canvas']['height'])"
```

---

## Typical Workflow

```bash
# 1. Check canvas
curl -s http://127.0.0.1:8089/state | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['canvas'])"

# 2. List available primers with dimensions
curl -s http://127.0.0.1:8089/primers/list | python3 -c \
  "import json,sys; [print(p['name'], p['width'], p['height']) for p in json.load(sys.stdin)['primers']]"

# 3. Close everything
curl -s -X POST http://127.0.0.1:8089/windows/close_all

# 4. Arrange (packery recommended for mixed sets)
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["foo.txt","bar.txt"],"algorithm":"packery","padding":2,"margin":1}'

# 5. Snap and verify
./scripts/snap.sh my-layout
```

---

## What's NOT Yet Built (Future)

| Feature | Notes |
|---|---|
| Packery: drop fewer items | Improve free-rect merging / retry with different sort orders |
| `poetry` visual verification | Run on 362×96 canvas |
| Theme/type-based curation | Auto-select primers by tag (monsters, geometry, folk-punk, etc.) |
| `/windows/{id}/resize` REST endpoint | Currently only via IPC controller `move_resize()` |
| Layout save/restore | Use existing workspace save — see E013 |
| Scramble/responsive re-arrange on resize | Watch `/state` canvas dims, auto re-run |
| Chaos mode | Packery + deliberate random offsets + overlap allowed |
