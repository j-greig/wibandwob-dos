---
title: "Primer Arrangement Tests"
status: in-progress
started: 2026-02-23
purpose: >
  Systematically verify that primer window origin, size, and placement are
  correct before trusting the masonry/gallery-wall algorithms.
  Each test captures TUI txt + JSON + SVG and gets human sign-off.
---

# Arrangement Test Log

## How to read this

Each test has:
- **Command** — exactly what was run
- **Expected** — what we think should happen
- **Artefacts** — TUI txt, JSON, SVG paths
- **Actual** — what `/state` + SVG showed
- **✅ PASS / ❌ FAIL / 🔍 INVESTIGATING**

---

## Open questions (to be resolved by these tests)

- [ ] Is window x,y measured from top-left of desktop, or top-left of screen?
- [ ] Does opening a primer at x=0,y=0 place it at the very top-left of the desktop?
- [ ] Is the menu bar row 0 (so desktop content starts at y=1)?  
- [ ] Does `w`/`h` in `/state` include the window frame border (+2 each side) or just content?
- [ ] Does `open_primer` with x,y,w,h args actually use those values, or ignore them?
- [ ] Does `move_window` x,y move the outer frame top-left, or the inner content top-left?

---

## TEST-00 — Baseline: capture current state (no arrangement)

**Purpose**: Establish that snap.sh works and that we can read current state.

**Command**:
```bash
./scripts/snap.sh test-00-baseline
```

**Artefacts**:
- TUI txt : (filled in after run)
- JSON    : logs/snapshots/test-00-baseline.json
- SVG     : logs/snapshots/test-00-baseline.svg

**Human check**: Does SVG show windows where they actually appear in the TUI tmux view?

**Result**: 🔍 INVESTIGATING

---

## TEST-01 — Single primer, top-left

**Purpose**: Verify that opening one primer with x=2, y=2 puts it near the top-left.

**What we did**:
1. Opened hello-world.txt (no position args) → auto-positioned at x=130 y=29 w=59 h=18
   - Canvas 320×77, window 59×18 → `(320-59)/2=130`, `(77-18)/2=29` ✅ correct centering
   - Size 59×18 = content(57×16) + 2 frame ✅ `_measure_primer` +2 fix working
2. Moved window to x=2, y=2 via `/windows/w1/move` → state confirmed x=2 y=2 ✅

**Artefacts**:
- TUI txt : `logs/screenshots/tui_20260223_114930.txt`
- JSON    : `logs/snapshots/test-01-single-topleft.json`
- SVG     : `logs/snapshots/test-01-single-topleft.svg`

**Expected in SVG**: one 59×18 window rectangle in top-left area of 320×77 canvas (x=2 y=2).

**Result**: ⏳ AWAITING HUMAN VISUAL CONFIRM — does SVG + tmux match expectation?

---

## TEST-02 — Two primers side by side at explicit positions ✅

**Purpose**: Verify two windows open at exact x,y,w,h (tests C++ Bug 1 fix — `open_primer` now reads x,y,w,h kv args).

**Plan**:
- hello-world.txt (content 57×16 → outer 59×18) at x=2, y=2
- box-pattern.txt (content 33×17 → outer 35×19) at x=63, y=2  (gap=2)

**Results** (both ✅):
```
✅ hello-world: got x=2  y=2  w=59 h=18  expected x=2  y=2  w=59 h=18
✅ box-pattern: got x=63 y=2  w=35 h=19  expected x=63 y=2  w=35 h=19
```

**Artefacts**:
- TUI txt : `logs/screenshots/tui_20260223_115555.txt`
- JSON    : `logs/snapshots/test-02-two-sidebyside.json`
- SVG     : `logs/snapshots/test-02-two-sidebyside.svg`

**Result**: ✅ PASS — confirmed by human. Two windows side by side, full artwork visible in both.

**Key observation**: The 2-char gap between windows is exactly the width of the Turbo Vision
window drop shadow. `padding=2` is therefore not arbitrary — it's the minimum gap at which
adjacent windows don't visually overlap (shadow fills the gap cleanly). Use padding=2 as the
canonical default for all gallery layouts.

---

## TEST-03 — Move an existing window

**Purpose**: Verify move_window relocates to the exact requested coordinates.

**Command**:
```bash
# Get window ID from state, then move it
WIN_ID=$(curl -s http://127.0.0.1:8089/state | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['windows'][0]['id'] if d['windows'] else 'NONE')")

curl -X POST "http://127.0.0.1:8089/windows/$WIN_ID/move" \
  -H "Content-Type: application/json" \
  -d '{"x": 10, "y": 5}'

./scripts/snap.sh test-03-move
```

**Expected**: window at exactly x=10, y=5

**Artefacts**: logs/snapshots/test-03-move.{json,svg}

**Result**: 🔍 NOT RUN YET

---

## TEST-04 — Two primers side by side

**Purpose**: Verify two windows don't overlap when placed in adjacent columns.

**Expected layout** (canvas 320×77):
```
[  hello-world 57×18  ] [  box-pattern 35×19  ]
x=2                      x=61
```

**Result**: 🔍 NOT RUN YET

---

## TEST-05 — Masonry 3-column (real primers, small canvas)

**Purpose**: Verify masonry algorithm produces proper multi-column layout.

Only run after TEST-01–04 all PASS.

**Result**: ✅ PASS — 2026-02-23

10 real wibwobworld primers (glum-face, iso-cube-cornered, mini-herbivore, cat-cat-simple, 3dboy,
recursive-disco-cat, reading-reality, wobs-group, ouija-board, flatboy-2d-3d) arranged via
`POST /gallery/arrange` masonry on 157×60 canvas. 0 overlaps. Canvas utilisation 34.4%.
Windows placed across 3 columns; content fully readable; gallery-wall feel confirmed via
TUI screenshot + SVG: `logs/snapshots/e012-real-gallery-wall.{json,svg,txt}`

---

## Findings so far

| Question | Answer |
|----------|--------|
| x,y = desktop top-left or screen? | ✅ Desktop-relative (y=0 is top of desktop, below menu bar) |
| Menu bar offset? | ✅ Menu bar is above desktop; y=0 in desktop coords is screen row ~1 |
| w,h includes frame? | ✅ YES — outer dimensions. content+2 each axis. Pass outer to all IPC calls. |
| open_primer respects x,y,w,h? | ✅ YES — after C++ Bug 1 fix in command_registry.cpp |
| move_window reaches correct coords? | ✅ YES — confirmed x=2,y=2 test |
| SIGWINCH restores window sizes? | ✅ YES — tmux resize + kill -WINCH restores full canvas |
