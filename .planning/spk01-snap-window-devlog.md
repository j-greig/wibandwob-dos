# SPK01 — snap_window: Zone-Based Window Placement

Status: in-progress
Type: spike (no GitHub issue required)
Branch: —

## Problem

The current window management API only has:
- `tile` (all windows, equal split)
- `cascade` (all windows, stacked offset)
- `move_window` (absolute x,y)
- `resize_window` (absolute w,h)

There is no way to say "put this window in the top-right quarter" without manually computing coordinates from the desktop size. This is especially painful for LLM/MCP callers who want semantic layout.

## Goal

Add a `snap_window` command that accepts a named zone (tl, tr, bl, br, left, right, top, bottom, full, center) and an optional margin, and places the window there in one call.

## Approach

### Phase 1 — Python proof-of-concept (no rebuild)
- [x] Explore IPC protocol and available commands
- [x] Confirm we can control windows from terminal via /tmp/wwdos.sock
- [x] Write tools/api_server/snap_window.py with zone math
- [ ] Test all zones live against running WibWob-DOS instance
- [ ] Verify margin parameter works

### Phase 2 — C++ native command (requires rebuild)
- [ ] Add `snap_window` to command_registry.cpp
- [ ] Wire into api_ipc.cpp dispatch
- [ ] Register in capabilities list
- [ ] Single IPC round trip (reads desktop extent internally)

## Zone Vocabulary

| Zone   | Fraction            | Description          |
|--------|---------------------|----------------------|
| tl     | 0,0 → 0.5,0.5      | top-left quarter     |
| tr     | 0.5,0 → 1,0.5      | top-right quarter    |
| bl     | 0,0.5 → 0.5,1      | bottom-left quarter  |
| br     | 0.5,0.5 → 1,1      | bottom-right quarter |
| left   | 0,0 → 0.5,1        | left half            |
| right  | 0.5,0 → 1,1        | right half           |
| top    | 0,0 → 1,0.5        | top half             |
| bottom | 0,0.5 → 1,1        | bottom half          |
| full   | 0,0 → 1,1          | maximise             |
| center | 0.25,0.25 → 0.75,0.75 | centered half     |

## Desktop Geometry Notes

From get_state with tiled windows:
- Full width: 284 columns
- Full height: 70 rows
- Window coords are desktop-relative (tile fills 0,0 to 284,70)
- Menu bar / status bar seem to be outside this coordinate space

## Session Log

### 2026-02-27 15:35

Discovered we can reach the TUI from inside a terminal running within it.
The IPC socket at /tmp/wwdos.sock accepts simple text protocol: `cmd:<name> key=value`.
Python helper at tools/api_server/ipc_client.py wraps the socket calls.

Proved concept by spawning a cube and torus from inside the terminal, then tiling.

Wrote snap_window.py — Python module that:
1. Calls get_state to learn desktop dimensions
2. Maps zone name to fractional rect
3. Calls resize_window + move_window (two IPC calls)

### 2026-02-27 15:45 — Phase 1 working

Fixed param name mismatch: IPC dispatch expects "width"/"height" but command
registry uses "w"/"h". The snap_window.py goes through raw IPC so needs the
former.

Tested live against running instance:
- snap_window('w13', 'tr') — cube snapped to top-right quarter. OK.
- snap_window('w7', 'bl')  — torus snapped to bottom-left quarter. OK.
- margin=1 works: adds 1-cell gap on all edges.

Desktop confirmed at 284x70. Quarters are 142x35 (or 141x35 depending on
rounding). All zones computed correctly from fractional definitions.

Two IPC round trips per snap (get_state + resize + move = 3 calls actually).
Phase 2 C++ version would do it in one.

NOTE: discovered the IPC param inconsistency between api_ipc.cpp (width/height)
and command_registry.cpp (w/h) for resize_window. Should be harmonised eventually.

### 2026-02-27 15:50 — Arbitrary fractional placement

User asked for a window at 1/6 canvas in BL. The fixed zone vocab couldn't
express this directly. Had to compute manually: 1/3 wide x 1/2 tall = 1/6 area,
placed at (0, 35) size 94x35.

This reveals the need for a grid-based snap syntax beyond fixed zones. Proposal:

  snap_window id=w15 zone=bl cols=3 rows=2

Meaning: divide desktop into a 3x2 grid, place window in the bottom-left cell.
This covers all fixed zones too (cols=2 rows=2 gives quarters, cols=2 rows=1
gives halves). Much more expressive.

Could also support multi-cell spans:
  snap_window id=w15 col=0 row=1 colspan=2 rowspan=1 cols=3 rows=2
  (bottom-left two-thirds of a 3x2 grid)

### 2026-02-27 15:55 — C++ native + grid mode

Added snap_window to command_registry.cpp with full grid support:
- Named zones (tl, tr, bl, br, left, right, top, bottom, full, center)
- Grid mode: cols=N rows=M with zone corner or explicit col/row
- colspan/rowspan for multi-cell spans
- margin parameter
- Reads desktop extent directly from TProgram::deskTop->getExtent()
- Returns JSON with final bounds

Also updated Python snap_window.py with matching grid mode and CLI args.

Still needs:
- [ ] Register snap_window in capabilities list (command_registry.cpp)
- [ ] Rebuild and test C++ version
- [ ] Wire MCP tool (tui_snap_window)
- [ ] Harmonise resize_window param names (w/h vs width/height)
