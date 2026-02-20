# SPK04 — WibWobSimsity Barebones Playable

## Status
Status: done
GitHub issue: #73
PR: #74 (merged to main 2026-02-20)

## Goal
Cursor + tool placement on the live Micropolis map inside WibWob-DOS. Proves the game loop is usable. No art polish, no dialogs, no MCP parity.

## Decisions (locked)

| # | Decision |
|---|---|
| D1 | Arrows move **world-coord cursor**; camera auto-pans when cursor hits viewport edge. Shift+Arrows for explicit camera pan if needed later. |
| D2 | Cursor highlight = **overlay pass** after bulk map draw (invert/box the cursor cell). Full cell-by-cell rewrite only if overlay artifacts. |
| D3 | Bridge wraps **`doTool(EditingTool, x, y)`** (returns `ToolResult`) not `toolDown` (void). |
| D4 | Cursor stored as **world tile coords** (`curX_`, `curY_`). Screen pos = world − cam. |
| D5 | Workspace round-trip follows **existing `window_type_registry` pattern**: `type: "micropolis_ascii"` + standard frame fields, spawned via registry lookup. |

## What exists
- `MicropolisBridge`: init, tick, `cell_at`, `tile_at`, `glyph_for_tile`, `render_ascii_excerpt`, `hash_map_bytes`
- `TMicropolisAsciiView`: TView, timer ticks, camera pan (arrows/pgup/pgdn/home), `draw()`, `handleEvent()`
- Engine: `doTool(EditingTool, x, y) → ToolResult`, full `EditingTool` + `ToolResult` enums in `tool.h`

## What to build

### Stage A — Cursor + Tool Mode
**Files:** `micropolis_ascii_view.h/.cpp`

Add to view:
```cpp
int curX_ {60}, curY_ {50};   // world coords, start mid-map
EditingTool activeTool_ {TOOL_QUERY};
```

Key bindings in `handleEvent()`:
- `Arrow keys` → move cursor ±1; auto-pan camera if cursor within 2 tiles of viewport edge
- `1` TOOL_QUERY · `2` TOOL_BULLDOZER · `3` TOOL_ROAD · `4` TOOL_WIRE · `5` TOOL_RESIDENTIAL · `6` TOOL_COMMERCIAL · `7` TOOL_INDUSTRIAL
- `Enter` / `Space` → apply active tool (Stage B bridge call)
- `Esc` / `q` → TOOL_QUERY

Cursor clamping: `curX_` in `[0, WORLD_W-1]`, `curY_` in `[0, WORLD_H-1]`.

AC: move cursor, switch all 7 tools, no crash at map edges.
Test: manual smoke — traverse all edges, switch tools.

---

### Stage B — Engine Tool Bridge
**Files:** `micropolis_bridge.h/.cpp`

Add:
```cpp
struct ToolApplyResult {
    int code;          // mirrors ToolResult: -2 no money, -1 need bulldoze, 0 failed, 1 ok
    std::string message;
};

ToolApplyResult apply_tool(int tool_id, int x, int y);
```

Impl: bounds-check coords, cast `tool_id` to `EditingTool`, call `doTool(tool, x, y)`, map result to message string, return.

Wire into view: `Enter`/`Space` calls `bridge_.apply_tool(activeTool_, curX_, curY_)`, result shown in HUD (Stage C).

AC: applying road/zone mutates map hash.
Test: C++ — fixed seed, apply road at known coord, assert hash changes.

---

### Stage C — HUD + Cursor Highlight
**Files:** `micropolis_ascii_view.cpp`, `draw()`

**Top strip (1 row):** `$FUNDS  Jan 1900  Pop:0  Score:500  R:+0 C:+0 I:+0`

**Bottom hint row (1 row):** `[TOOL_NAME] 1:Qry 2:Blz 3:Rd 4:Wr 5:R 6:C 7:I  Enter:place Esc:cancel`

**Cursor overlay:** after `render_ascii_excerpt`, overwrite cell at `(curX_-camX_, curY_-camY_)` using `TDrawBuffer` with inverted attribute. No raw ANSI.

**Last tool result:** show for ~2 seconds in bottom row: `OK`, `No funds`, `Bulldoze first`, `Failed`.

AC: tool name and keymap visible at all times; cursor visible over map.
Test: manual — tool change reflects immediately; result message appears on place.

---

### Stage D — Zone Readability
**Files:** `micropolis_ascii_view.cpp`, `glyph_for_tile()` in bridge

Tier mapping from tile value:
- Empty zone centre (FREEZ=244, COMBASE=423, INDBASE=612): `r·` `c·` `i·` (dim)
- Developed tiers: `r1`→`r2`→`r3` / `c1`→`c2`→`c3` / `i1`→`i2`→`i3` (brighter per tier)
- Civic: `H` hospital · `P` police · `F` fire · `*` power plant
- Roads: `─` `│` `┼` (or `-` `|` `+` if box-draw unavailable)

AC: zone class and rough tier obvious at a glance.
Test: screenshot fresh map + developed city; R/C/I always labelled.

---

### Stage E — Workspace Round-Trip
**Files:** `window_type_registry.cpp`, `micropolis_ascii_view.cpp`

Register `"micropolis_ascii"` in `window_type_registry`. Persist:
```json
{ "type": "micropolis_ascii", "x": N, "y": N, "w": N, "h": N, "seed": N, "speed": N }
```
On load: spawn via registry lookup, call `initialize_new_city(seed, speed)`, restore camera/cursor position if present.

AC: workspace save → reload → Micropolis window present and ticking.
Test: save with open window, reload, assert window type in registry and sim ticking.

---

## Guardrails (non-negotiable)
- No raw ANSI bytes in any `TDrawBuffer` write — treat visible `\x1b[` as a hard failure
- `micropolis_determinism` and `micropolis_no_ansi` tests must stay green after every stage
- Keep feature behind `open_micropolis_ascii` command — no default auto-open

## Rollback
If tool apply destabilises the event loop, revert bridge call in `handleEvent` and leave view read-only. Bridge + cursor code stays.

## Definition of Done
- Open window → select tool → place road/zone → observe sim respond
- Workspace round-trip keeps window
- No startup crash regressions
- Both existing tests green
