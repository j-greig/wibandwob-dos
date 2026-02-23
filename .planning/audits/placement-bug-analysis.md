---
title: "Window Placement Bug Analysis"
status: confirmed
date: 2026-02-23
---

# Window Placement Bug — Root Cause Analysis

## TL;DR

Three compounding bugs mean windows end up nowhere near where the
masonry algorithm puts them. All three must be fixed together.

---

## Bug 1 — `open_primer` ignores x,y,w,h args (C++)

**File**: `app/command_registry.cpp` line ~248  
**Code**:
```cpp
api_open_animation_path(app, path, nullptr, frameless);
//                               ^^^^^^^ always NULL — x,y,w,h args discarded
```

The kv map contains `x`, `y`, `w`, `h` sent by Python but they are never
read. The window opens at Turbo Vision's default position (roughly centred).

**Fix**: read x,y,w,h from kv and build a `TRect`, pass it to
`api_open_animation_path` instead of `nullptr`.

---

## Bug 2 — Python `gallery/arrange` skips `move_resize` for new windows

**File**: `tools/api_server/main.py` line ~943  
**Code**:
```python
# Window was opened at the requested position — no need to move
continue   # ← wrong assumption; window is NOT at requested position
```

After opening, the code finds the new window ID but then `continue`s
past the `move_resize` call. Since Bug 1 means the window opened in the
wrong place, there is never a correction step.

**Fix**: remove the `continue`. The existing `if win_id: move_resize(...)`
block below handles both existing and newly-opened windows correctly.

---

## Bug 3 — Window size passed is content size, not outer-frame size (Python)

**File**: `tools/api_server/main.py` `_masonry_layout` and `_measure_primer`  
**Problem**: `_measure_primer` returns raw content dimensions (e.g. 33×17 for
box-pattern.txt). These are passed as `w`/`h` to `resize_window`.  
`api_resize_window` in C++ sets outer window bounds to exactly that size,
so the content area = outer - 2 (one-cell frame each side), clipping 2
chars off the right and bottom of every primer.

**Fix**: in `_masonry_layout` (and collision checks), use
`content_w + 2, content_h + 2` as the effective window dimensions.
In `gallery/arrange`, pass `place.width + 2, place.height + 2` to
`move_resize`. The masonry layout itself can stay in content units — just
add the +2 at the IPC call site.

---

## Coordinate system (confirmed from source)

- `api_get_state` emits `w->origin.x / origin.y` — desktop-relative coords
- `api_move_window` takes desktop-relative x, y — moves to exact position
- Desktop starts below the menu bar (y=0 in desktop = y=1 on screen)
- So passing `y=0` is valid and places the window at the top of the desktop

---

## Fix plan (no C++ rebuild for Bugs 2+3; rebuild needed for Bug 1)

### Quick path (Bugs 2+3 only — no rebuild)
- Remove `continue` in `gallery/arrange` apply block
- Pass `w + 2, h + 2` at the `move_resize` call site
- **Windows that are already open will move correctly**
- New windows will open at default position first, then be moved
- Small visual flicker on open, but functionally correct

### Full path (all 3 bugs — requires C++ rebuild)
- Fix Bug 1 in `command_registry.cpp`: read x,y,w,h from kv, build TRect
- The above quick fixes still needed too

### Test sequence after fix
Run tests in `.planning/audits/arrangement-tests.md`:
- TEST-01: single window at x=2,y=2 → snap.sh → human confirms
- TEST-02: explicit size → snap.sh → human confirms
- TEST-03: move existing window → snap.sh → human confirms
- TEST-04: two side-by-side → snap.sh → human confirms
- TEST-05: masonry 3-col → snap.sh → human confirms
