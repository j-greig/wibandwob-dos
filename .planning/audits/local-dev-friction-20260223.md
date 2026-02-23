---
date: 2026-02-23
type: friction-log
context: E012 gallery arrange spike — first local (non-Docker) build + test session
---

# Local Dev Friction Log

Things that slowed down or broke the "build → run → test → screenshot" loop during
the E012 spike. Each entry has a **fix** (script, doc change, or skill update).

---

## 1. No single "start everything" script

**What happened**: `start_api_server.sh` only starts the API. The TUI app
(`test_pattern`) has to be started separately — and it needs a PTY so plain `&`
backgrounding doesn't work. Spent multiple turns figuring out that tmux is the
right tool, that the socket path is `WIBWOB_INSTANCE=N` → `/tmp/wibwob_N.sock`,
and that `nohup` silently dies inside pi bash tool calls.

**Fix needed**: `scripts/dev-start.sh` — starts TUI in `tmux new-session -d -s wibwob`
then API in `tmux new-session -d -s wibwob-api`, waits for socket + health, prints
attach instructions. One command gets you a working stack.

```bash
# proposed usage
./scripts/dev-start.sh          # start both
./scripts/dev-stop.sh           # kill both cleanly
tmux attach -t wibwob           # watch TUI
tmux attach -t wibwob-api       # watch API log
```

---

## 2. Submodules not initialised — silent build failure

**What happened**: `cmake` failed with `add_subdirectory given source "vendor/tvterm/deps/vterm"
which is not an existing directory`. Root cause: `vendor/tvterm` was checked out
but its nested deps (`deps/vterm/libvterm`, `deps/tvision`) weren't initialised.
Similarly `vendor/MicropolisCore` was an empty dir.

`git submodule update --init` on tvterm failed with `fatal: Fetched in submodule path
'vendor/tvterm', but it did not contain <sha>` — the pinned SHA wasn't on any remote
branch. Fix was to `cd vendor/tvterm && git fetch origin && git checkout origin/master`
then `git submodule update --init` from inside.

**Fix needed**:
- Add a `scripts/init-submodules.sh` that does all of this robustly
- Or add a `cmake/check-submodules.cmake` that prints a clear human error
- Add to README / CLAUDE.md: "Run `scripts/init-submodules.sh` before first build"
- Consider pinning tvterm to a branch ref not a raw SHA to avoid the fetch failure

---

## 3. `CLAUDE.md` / `AGENTS.md` missing: "always branch before coding"

**What happened**: I wrote and committed E012 implementation directly to `main`
without testing. The rule "branch-per-issue" exists in `AGENTS.md` but isn't
enforced or surfaced at session start.

**Fix needed**:
- Add to `CLAUDE.md` (top-level stop-gate): **"Never commit feature work directly
  to main. Create issue + branch first. Commit only after screenshot evidence."**
- Consider a pre-commit hook that rejects commits to main when staged files include
  `app/` or `tools/api_server/` (non-docs changes).

---

## 4. `props={}` bug — `path` from C++ JSON silently dropped

**What happened**: `GET /state` returned `props={}` for all `frame_player` windows
even though C++ emits `"path": "..."` in the JSON. The `_sync_state` method in
`controller.py` hardcoded `props={}` and never parsed any fields from the C++ window
JSON. This meant `gallery/arrange` couldn't match open windows to filenames by path.

Fixed in this session by carrying `path` through in `_sync_state`.

**Fix needed**:
- Add a unit test: open a primer → GET /state → assert `props.path` is non-empty
- Note in `controller.py` comment: "C++ may emit additional window-level keys
  (e.g. `path`); parse them here rather than discarding."

---

## 5. No local dev startup documented in README / wibwobdos skill

**What happened**: `wibwobdos` skill covers Docker ops. There's no documented
non-Docker local startup path for macOS. Had to reverse-engineer the socket path
(`/tmp/wibwob_N.sock`), the instance env var (`WIBWOB_INSTANCE`), the tmux approach,
and the correct `WIBWOBDOS_URL` equivalent.

**Fix needed**: Add "Local macOS dev" section to `wibwobdos` skill or README:

```bash
# 1. Build (first time or after C++ changes)
cmake . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --target test_pattern -j$(sysctl -n hw.logicalcpu)

# 2. Start TUI
tmux new-session -d -s wibwob -x 220 -y 50 \
  "WIBWOB_INSTANCE=1 ./build/app/test_pattern 2>/tmp/wibwob_debug.log"

# 3. Wait for socket
until [ -S /tmp/wibwob_1.sock ]; do sleep 0.5; done

# 4. Start API
tmux new-session -d -s wibwob-api \
  "WIBWOB_INSTANCE=1 ./tools/api_server/venv/bin/python -m tools.api_server.main --port=8089 2>&1 | tee /tmp/wibwob_api.log"

# 5. Health check
sleep 2 && curl -sf http://127.0.0.1:8089/health

# 6. Attach to see TUI
tmux attach -t wibwob   # Ctrl+B D to detach
```

---

## 6. MCP errors at /mcp — not yet investigated

**What happened**: User reported errors at `http://127.0.0.1:8089/mcp`. Not
investigated in this session.

**Fix needed**: Reproduce error, log it here, fix or file issue.

---

## Proposed: `scripts/dev-start.sh`

```bash
#!/usr/bin/env bash
# dev-start.sh — start WibWobDOS TUI + API locally (macOS, non-Docker)
set -e
INSTANCE=${WIBWOB_INSTANCE:-1}
PORT=${WIBWOB_API_PORT:-8089}
BINARY="./build/app/test_pattern"

[ -x "$BINARY" ] || { echo "❌ Binary not found. Run: cmake --build build --target test_pattern"; exit 1; }

# Kill stale tmux sessions
tmux kill-session -t wibwob 2>/dev/null || true
tmux kill-session -t wibwob-api 2>/dev/null || true

echo "🖥  Starting TUI (tmux session: wibwob)..."
tmux new-session -d -s wibwob -x 220 -y 50 \
  "WIBWOB_INSTANCE=$INSTANCE $BINARY 2>/tmp/wibwob_debug.log"

echo "⏳ Waiting for IPC socket..."
for i in $(seq 1 20); do
  [ -S "/tmp/wibwob_${INSTANCE}.sock" ] && break
  sleep 0.5
done
[ -S "/tmp/wibwob_${INSTANCE}.sock" ] || { echo "❌ Socket never appeared. Check /tmp/wibwob_debug.log"; exit 1; }

echo "🌐 Starting API (tmux session: wibwob-api)..."
tmux new-session -d -s wibwob-api \
  "WIBWOB_INSTANCE=$INSTANCE ./tools/api_server/venv/bin/python -m tools.api_server.main --port=$PORT 2>&1 | tee /tmp/wibwob_api.log"

echo "⏳ Waiting for API health..."
for i in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT/health" > /dev/null || { echo "❌ API not healthy. Check /tmp/wibwob_api.log"; exit 1; }

echo ""
echo "✅ WibWobDOS running"
echo "   TUI:  tmux attach -t wibwob"
echo "   API:  http://127.0.0.1:$PORT  (logs: tmux attach -t wibwob-api)"
echo "   Stop: tmux kill-session -t wibwob && tmux kill-session -t wibwob-api"
```

---

---

## 7. Masonry algorithm was a single-column stack, not a gallery wall

**What happened**: `POST /gallery/arrange algorithm=masonry` placed all 3 primers
at `x=0` stacked vertically — visually identical to a plain list. Root cause: the
algorithm only opened a new column when the current column was *full* (height
overflow). With 3 small primers on a 60-row canvas they all fit in column 0, so no
second column was ever created. This is not masonry.

**What masonry actually is**: N columns pre-determined from canvas width, each with
a fixed X. Items bin-packed into the *shortest* column (standard Pinterest/CSS
masonry). Column count should be driven by canvas width and typical item width, not
by vertical overflow.

**Fix needed** (done in this session): rewrite `_masonry_layout` to:
1. Pre-compute `n_cols = max(2, canvas_w // col_width)` where `col_width ≈ avg item width`
2. Fix column X positions evenly across canvas
3. For each item (tallest first), place in argmin(col heights)
4. Items rendered at natural width within their column slot

**Fix applied**: rewrote `_masonry_layout` to pre-compute `n_cols` from
`canvas_w // (max_item_width + padding)`, fix column X positions evenly, then
bin-pack each item into the shortest column. Verified with screenshot — 4 primers
now appear as 2-column gallery wall, items at natural widths, 0 overlaps.

Also discovered and fixed a second bug: `props={}` hardcoded in `controller.py
_sync_state` was silently dropping the `path` field emitted by C++ for all
`frame_player` and `text_view` windows. Path now propagated from JSON → Window.props.

**Lesson**: when implementing layout algorithms, test with a screenshot *before*
declaring done. A single-column result is visually obvious as wrong. Also: always
verify that C++ JSON fields actually reach Python state before writing matching code.

**Drop shadow insight** (from TEST-02 human confirmation): Turbo Vision windows
have a 2-char drop shadow on the right/bottom edge. `padding=2` in the gallery
layout is therefore the exact minimum to prevent visual overlap — the shadow fills
the gap cleanly. This is a design constraint, not an arbitrary value. Hardcode as
`GALLERY_PADDING = 2` and never go lower.

---

---

## 14. Three different "terminal size" values — know which one you need

**What happened**: Confusion between three different size sources during the session:

| Source | Value | What it is |
|--------|-------|------------|
| `stty size` in pi pane | 41×77 | The terminal pane running the pi CLI |
| `tmux display-message #{pane_width}x#{pane_height}` | 157×61 | The TUI tmux session |
| `GET /state` → `canvas.width/height` | 157×60 | TUI desktop area (excl. menu+status bars) |
| `osascript iTerm2 bounds` | 1595×1273 px | Physical pixel size of the iTerm2 window |

**Rule**: Always use `/state` canvas dimensions for layout. The TUI canvas is 1 row
shorter than the tmux pane (menu bar row consumed). Never use `stty size` from the
pi pane — it's a different terminal.

**Cell size** (from osascript): 1595px / 157cols ≈ 10px wide, 1273px / 60rows ≈ 21px tall.
Updated `workspace_snapshot.py` CELL_W/CELL_H to match — SVGs now render at true scale.

---

## 13. Turbo Vision window shadow must be accounted for in layout margins

**What happened**: The 4-corner test revealed windows placed at `canvas_w - w - 2`
were having their right shadow clipped (shadow = 2 chars wide). Bottom windows at
`canvas_h - h - 1` were clipped on the bottom shadow (shadow = 1 row tall). The
gallery looked slightly wrong — borders flush but shadow cut off.

**Root cause**: Layout algorithm used content/canvas bounds with no shadow allowance.

**Fix**: Defined `SHADOW_W = 2, SHADOW_H = 1` constants (Turbo Vision fixed values).
Added `margin` param (default=1) to `GalleryArrangeRequest`. Masonry now computes:
- `usable_x = margin, usable_y = margin`
- `usable_w = canvas_w - SHADOW_W - margin * 2`
- `usable_h = canvas_h - SHADOW_H - margin * 2`

**Design note**: margin=1 aligns left window edges with the 'F' of the 'File' menu
item — a happy accident that makes the gallery feel intentionally designed.

**Verification formula** (check after any placement):
```
shadow_right  = x + w + SHADOW_W  →  should be ≤ canvas_w - margin
shadow_bottom = y + h + SHADOW_H  →  should be ≤ canvas_h - margin
```

---

## 12. Always work from actual iTerm2 viewport size — never force tmux canvas bigger

**What happened**: `dev-start.sh` was starting tmux with `-x 320 -y 78`, making
the TUI render a canvas bigger than the user's actual iTerm2 window. Gallery
layout computed correctly for 320×77 but user could only see ~157×61 — windows
appeared cut off or completely off-screen to the right.

**Rule**: Never hardcode a tmux canvas size larger than the user's terminal.
The TUI should fill whatever the user can actually see. `dev-start.sh` now
starts tmux without `-x`/`-y` so it inherits the real terminal dimensions
on first attach. Gallery arrange always reads canvas size from `/state` so
layout is always computed for the actual viewport.

**Workflow after `dev-start.sh`**:
```
tmux attach -t wibwob   # session resizes to your actual terminal
Ctrl-B D                # detach — canvas size now locked to your viewport
./scripts/snap.sh       # verify canvas width/height matches what you see
```

---

## 11. tmux crash shrinks all TUI windows — fix: resize + SIGWINCH

**What happened**: tmux session crashed mid-session. When it came back, the
terminal reported a smaller size. Turbo Vision received SIGWINCH and
squashed all windows to fit the smaller canvas (e.g. 59×18 → 29×14).
Canvas shrank from 320×77 to 157×60.

**Fix** (two commands, ~1 second):
```bash
tmux resize-window -t wibwob -x 320 -y 78
kill -WINCH $(pgrep -f test_pattern | head -1)
```
Turbo Vision re-queries the terminal size, restores all windows to their
full logical dimensions. Windows are NOT destroyed — just clipped while
the canvas was small. After SIGWINCH they snap back.

**Add to `dev-start.sh`**: check canvas size after startup and send SIGWINCH
if it doesn't match the expected 320×78.

**Also noted**: `/windows/{id}/resize` endpoint does not exist in the API —
resize only works via IPC `resize_window` command through the controller's
`move_resize()`. Add a REST endpoint for this (backlog item).

---

## 10. Three compounding placement bugs meant windows were never where we thought

**What happened**: After implementing masonry and seeing the screenshot
(`weird-placement.png`), all windows were crammed into the bottom-right corner.
Spent significant time debugging what turned out to be three separate bugs that
all had to exist simultaneously to produce the symptom:

1. **`open_primer` C++ ignores x,y,w,h kv args** — always passes `nullptr`
   bounds to `api_open_animation_path`. Windows open at Turbo Vision's default
   position (roughly centred). No amount of Python-side logic can fix this
   without a C++ change OR a follow-up `move_resize`.

2. **Python `gallery/arrange` skips `move_resize` for newly-opened windows** —
   the `continue` statement after finding the new window ID assumes the window
   opened at the right place (it didn't, due to Bug 1).

3. **Window size passed = content size, not outer-frame size** — `_measure_primer`
   returns raw content dimensions; `resize_window` treats them as outer bounds,
   so a 33-wide file ends up with 31 visible chars (frame eats 1 cell each side).

**Time lost**: ~1.5 hours of algorithm iteration, screenshot checking, and
confusion about coordinate systems — all caused by never verifying a single
known placement first.

**Lesson**: **Always run TEST-01 (single window, known position) before building
any multi-window algorithm.** The snap.sh + SVG workflow (`./scripts/snap.sh`)
was not in place; adding it is itself a friction fix. The arrangement-tests.md
log is now the required gate before any gallery work.

**Artefact**: `.planning/audits/placement-bug-analysis.md` — full root cause
write-up with fix plan.

---

## 9. User reference images clarified two distinct layout algorithms

**What happened**: I called both "masonry" but they're different things:

- **CSS masonry** (css-irl, brickjs refs): N fixed columns, items drop into
  shortest column. Variable heights. This is `algorithm=masonry` — now working.
  Looks sparse with 5 test primers; becomes visually rich with 20+ pieces.

- **Justified row / salon hanging** (gallery wall refs — Desenio, Shopify):
  Items packed into ROWS that fill the exact canvas width. Window widths adjusted
  (stretched/shrunk) to justify each row. Equal gutters everywhere. All items in a
  row share the same height. This is a different algorithm — `algorithm=justified`
  or `algorithm=gallery_wall`. Not yet implemented.

**Fix needed**: implement `_justified_row_layout` and expose as
`algorithm=gallery_wall`. Key steps:
1. Group items into rows (greedy: add until row would exceed canvas_w)
2. Scale window widths proportionally to justify the row to canvas_w
3. Row height = max(natural heights in row)
4. Place with equal horizontal + vertical gutters
ASCII content clips/pads at window edge — acceptable, curators can tune.

---

## 8. `preview=true` / poetry layout verified but not visually confirmed

**What happened**: `poetry` layout and `preview=true` were tested via JSON response
only — positions looked correct but no screenshot was taken to confirm visual output.

**Fix needed**: for any layout test, always: POST arrange → POST screenshot → read
screenshot → confirm with eyes. Text output alone is insufficient for visual features.

---

## Summary — prioritised fixes

| Pri | Fix | Effort |
|-----|-----|--------|
| 🔴 | `scripts/dev-start.sh` + `dev-stop.sh` | 30 min |
| 🔴 | CLAUDE.md: branch-before-code rule + screenshot-before-commit rule | 5 min |
| 🟠 | `scripts/init-submodules.sh` with clear error messages | 20 min |
| 🟠 | wibwobdos skill: local macOS dev section | 15 min |
| 🟡 | Unit test: open primer → assert props.path non-empty | 20 min |
| 🟡 | Investigate MCP /mcp errors | TBD |
| 🟢 | Pre-commit hook: reject direct commits to main for app/ changes | 30 min |
| 🟠 | API server: always use `--reload` for agentic dev workflow | 5 min |
| 🟠 | Extract gallery layout engine from main.py → gallery.py | 1 hr |

---

## 16. Gallery layout engine crammed into main.py — no module separation

**What happened**: All gallery/layout code lives inline in `main.py` starting at line 75.
By line ~800, 8 layout algorithms, measurement helpers, and layout constants have all
accumulated before the first API route. The file is 1723 lines total.

**Problem for agents**: any agent asked to "work on the gallery layout" has to navigate
a 1700-line file mixing FastAPI routing, IPC plumbing, browser logic, and layout maths.
Finding `_layout_packery` requires knowing it's around line 330, not in a module named
after what it does.

**Fix**: extract to `tools/api_server/gallery.py`. Move:
- `SHADOW_W`, `SHADOW_H`, `CANVAS_BOTTOM_EXTRA`, `GALLERY_PADDING` constants
- `_measure_primer`, `_get_primer_metadata` helpers
- All `_layout_*` functions (8 algorithms)
- `_algo_map` dispatch dict (or a `run_layout(algo, primers, ...)` wrapper)

`main.py` keeps the `/gallery/arrange` route handler and imports from `.gallery`.
Follows the existing pattern: `browser.py`, `controller.py`, `models.py`.

**Effort**: ~1 hour. Pure refactor, no behaviour change.

---

## 15. API server not running with --reload — agents must restart manually after edits

**What happened**: API server launched without `--reload`, so any Python file edit by an
agent requires a manual server restart to take effect. In agentic sessions this is
significant friction — agents edit `gallery.py`, `controller.py`, etc. and then
silently hit the old code.

**Fix**: Always start uvicorn with `--reload`:

```bash
WIBWOB_INSTANCE=1 ./tools/api_server/venv/bin/uvicorn \
  tools.api_server.main:app \
  --host 127.0.0.1 --port 8089 --reload
```

Update `dev-start.sh` and CLAUDE.md startup recipe to use `--reload`. Note: `--reload`
watches for file changes under the working directory — confirm `tools/api_server/` is
covered (it will be if launched from repo root).

**Note**: CLAUDE.md already warns "if you edit Python files while the API server is
running, you must restart uvicorn" — that warning becomes unnecessary once `--reload`
is the default.

---

<planofaction>

## Plan of Action — Ranked by Impact

Context: gallery display is the active goal (E012). Rankings weight AI-agent unblocking, gallery correctness, and display-tool vision.

### Tier 1 — Do immediately (unblock everything)

**1. Fix CLAUDE.md startup recipe — remove hardcoded -x/-y**
The existing "Running the Live TUI" section in CLAUDE.md hardcodes `-x 120 -y 40`. Item 12 proves this is wrong and causes off-screen gallery placement. Fix before anything else or every agent session starts broken.
Effort: 5 min. File: `CLAUDE.md` (Running the Live TUI section).

**2. `scripts/dev-start.sh` + `dev-stop.sh`**
Single-command start eliminates ~30 min of per-session friction for any AI agent. No hardcoded canvas size — inherits real terminal on first attach. Biggest multiplier for all future gallery/E012 work.
Effort: 30 min. Already drafted in this doc — just needs emoji stripped and committed.

**3. CLAUDE.md: branch-before-code + screenshot-before-commit as session-start stop-gates**
Not a doc mention — these need to be in the opening paragraph of CLAUDE.md as hard rules, not buried in workflow sections. The pre-commit hook (Tier 2) enforces it mechanically.
Effort: 5 min.

### Tier 2 — High leverage, do this sprint

**4. Fix C++ `open_primer` to respect x,y,w,h args**
Root cause of item 10's three compounding bugs. Every gallery placement currently requires a follow-up `move_resize` round-trip. Fix this once in C++ and all Python gallery code simplifies. Without it, gallery_wall and any future layout algorithm carry hidden complexity.
Effort: 1-2 hours. File: `app/command_registry.cpp` / `app/test_pattern_app.cpp` — `api_open_animation_path` call site.

**5. `algorithm=gallery_wall` (justified-row layout)**
Masonry is done. Gallery_wall is the correct algorithm for a curated display — rows fill canvas width, widths scaled proportionally, equal gutters. This is the visual target for the display tool vision. Item 9 has the algorithm fully specified, just needs implementing.
Effort: 2-3 hours. File: `tools/api_server/gallery.py` or equivalent.

**6. `scripts/init-submodules.sh`**
Silent build failures on fresh clone burn any new agent or CI run. Script should handle the tvterm SHA fetch workaround robustly. Add one-liner to README and CLAUDE.md first-build section.
Effort: 20 min.

### Tier 3 — Quality / regression prevention

**7. Unit test: open primer → GET /state → assert props.path non-empty**
The props={} bug (item 4) was silent and caused hours of confusion. A test catches any regression immediately.
Effort: 20 min. File: `tests/` — new test alongside room tests or contract tests.

**8. `snap.sh` workflow + TEST-01 gate documented in CLAUDE.md**
The lesson from item 10: always verify a single known placement before any multi-window algorithm. Document snap.sh usage and the TEST-01 requirement as a mandatory step in gallery development workflow.
Effort: 15 min.

**9. wibwobdos skill: local macOS dev section**
The full startup snippet from item 5 should live in the skill so any agent invoking wibwobdos gets it. Complements dev-start.sh — skill explains why, script does it.
Effort: 15 min.

**10. Pre-commit hook: reject app/ commits directly to main**
Mechanical enforcement of the branch-before-code rule. Catches the item 3 failure mode automatically.
Effort: 30 min.

### Tier 4 — Backlog / investigate

**11. `/windows/{id}/resize` REST endpoint**
Currently resize only works via IPC through the controller. A REST endpoint makes gallery testing from curl simpler and removes the controller dependency.
Effort: 1 hour. Filed as backlog in item 11.

**12. Investigate and fix MCP /mcp errors**
Item 6 — unresolved. Low priority until gallery core is solid, but MCP errors will matter when the embedded Wib&Wob agent drives gallery layout autonomously.
Effort: TBD.

### Gallery display vision — specific notes

- `GALLERY_PADDING = 2` and `SHADOW_W = 2, SHADOW_H = 1` are Turbo Vision hard constraints, not config. They should be constants in the layout code and documented in any gallery API reference.
- Cell size (10px wide × 21px tall) from iTerm2 calibration — lock into `workspace_snapshot.py` and keep updated. This is the foundation for any SVG/image export pipeline.
- Masonry (N columns, bin-pack shortest) suits large collections (20+ pieces). Gallery_wall (justified rows) suits curated displays (5-15 pieces). Both should exist; endpoint should accept `algorithm=` param.
- The display tool vision (any screen showing complex arrangements) needs `open_primer` x,y fix (#4 above) as a prerequisite. Without it, arrangement is a two-phase operation that's fragile under reorder.

---

### Actionable stubs — for agent pickup

Each stub is independent unless marked `[blocks N]`. Check off as done. Do not action without reading the full item above first.

```
[ ] STUB-1  Fix CLAUDE.md: remove -x 120 -y 40 from "Running the Live TUI" tmux command
            File: CLAUDE.md line ~60 (tmux new-session line)
            Change: drop -x and -y flags entirely
            Gate: none — do first
            [blocks STUB-2, STUB-8]

[ ] STUB-2  Write scripts/dev-start.sh + scripts/dev-stop.sh
            Source: draft already in this doc (strip emoji from echo lines)
            Gate: STUB-1 done (no hardcoded canvas)
            Test: run script, curl /health returns {"ok":true}

[ ] STUB-3  Add branch-before-code + screenshot-before-commit rules to top of CLAUDE.md
            File: CLAUDE.md — add as "Session start rules" block near top, not buried
            Gate: none
            Test: n/a (doc change)

[ ] STUB-4  Fix C++ open_primer to pass x,y,w,h to api_open_animation_path
            Files: app/command_registry.cpp, app/test_pattern_app.cpp
            Search for: api_open_animation_path call inside open_primer dispatch
            Change: parse kv args "x","y","w","h", pass as bounds not nullptr
            Gate: none (but gallery_wall depends on this)
            Test: POST /gallery/arrange → GET /state → assert window.x matches requested
            [blocks STUB-5]

[ ] STUB-5  Implement algorithm=gallery_wall (justified-row layout)
            File: tools/api_server/gallery.py (or wherever _masonry_layout lives)
            Spec: item 9 in this doc — greedy row packing, proportional width scaling,
                  row height = max(natural heights), equal gutters
            Gate: STUB-4 done (accurate placement)
            Test: POST /gallery/arrange algorithm=gallery_wall → screenshot → assert
                  rows fill canvas width, no overlaps, gutters equal

[ ] STUB-6  Write scripts/init-submodules.sh
            Logic: git submodule update --init; if tvterm fails, cd vendor/tvterm &&
                   git fetch origin && git checkout origin/master && cd .. &&
                   git submodule update --init vendor/tvterm
            Add one-liner to README and CLAUDE.md first-build section
            Test: delete vendor/tvterm contents, run script, cmake succeeds

[ ] STUB-7  Add unit test: open primer → GET /state → assert props.path non-empty
            File: tests/ — alongside room tests or new tests/gallery/
            Test command: uv run --with pytest pytest tests/gallery/ -q

[ ] STUB-8  Document snap.sh + TEST-01 gate in CLAUDE.md gallery dev section
            Gate: STUB-1 done
            Content: before any multi-window layout work, run TEST-01 (single window,
                     known position, verify via snap.sh screenshot)

[ ] STUB-9  Update wibwobdos skill with local macOS dev section
            File: .claude/skills/wibwobdos/ (or wherever skill lives)
            Content: full startup snippet from item 5 of this doc

[ ] STUB-10 Pre-commit hook: reject direct commits to app/ on main branch
            File: .git/hooks/pre-commit (or .claude/hooks/)
            Logic: if on main && staged files match app/ or tools/api_server/ → exit 1

[ ] STUB-11 Add REST endpoint /windows/{id}/resize
            File: tools/api_server/main.py
            Delegates to: controller move_resize()
            Test: POST /windows/1/resize {w:40,h:20} → GET /state → assert dimensions

[x] STUB-14 Extract gallery layout engine from main.py → tools/api_server/gallery.py
            Problem: ~700 lines of constants, helpers, and 8 layout algorithms live in
            main.py (lines 75-~800 of 1723). No separation from routing/API layer.
            Pattern: browser.py, controller.py, models.py already exist — follow same.
            Move: SHADOW_W/H/CANVAS_BOTTOM_EXTRA constants, _measure_primer,
                  _get_primer_metadata, all _layout_* functions, _algo_map dispatch
            main.py import: from .gallery import run_layout, SHADOW_W, SHADOW_H, ...
            Keep: the /gallery/arrange route handler + request/response models in main.py
            Gate: none (pure refactor, no behaviour change)
            Test: existing gallery arrange calls return identical output before/after

[ ] STUB-13 Add --reload to API server launch in dev-start.sh and CLAUDE.md
            File: scripts/dev-start.sh (uvicorn line), CLAUDE.md (startup recipe)
            Change: append --reload to uvicorn invocation
            Also: remove the "must restart uvicorn" warning from CLAUDE.md gotchas
            Test: edit a .py file → curl endpoint → verify change took effect without restart

[ ] STUB-12 Reproduce and fix MCP /mcp errors
            Start: curl http://127.0.0.1:8089/mcp → capture error
            Log finding in this doc under item 6
```

</planofaction>

---

## Session 2 — 2026-02-23 afternoon (E012 layout engine sprint)

### What was built
- 5 layout algorithms: `masonry`, `fit_rows`, `masonry_horizontal`, `packery`, `cells_by_row`
- `poetry` mode (packery + breathing room) — implemented, not yet visually tested
- `options` dict on `GalleryArrangeRequest` for per-algo params (e.g. `clamp`, `n_cols`, `n_rows`)
- `out_of_bounds` field on response — shadow-aware bounds check, catches off-canvas placements
- `wcwidth` for display-accurate primer measurement (replaces `len()`)
- `masonry` + `masonry_horizontal` both support `clamp` option (dense vs natural)
- All modes human-verified via screenshot on 157×60 canvas
- Expanded to 362×96 (27" Cinema Display, small font) — packery with 40 items looks great

### Friction resolved
- Stale `/tmp/wibwob_12.sock` caused API to talk to wrong TUI instance → nuked sock, API now auto-finds correct instance
- `WIBWOB_INSTANCE=1` must be set when running `start_api_server.sh` — not set in script
- uvicorn `--reload` via venv CLI eliminates restart friction: `WIBWOB_INSTANCE=1 ./tools/api_server/venv/bin/uvicorn tools.api_server.main:app --host 127.0.0.1 --port 8089 --reload`

### Friction remaining
- `start_api_server.sh` does not set `WIBWOB_INSTANCE` — should default to 1 or read from env
- `masonry` `clamp=true` with median column count still clips wide items visually — acceptable, documented
- `packery` drops items when free rects fragment — 18/40 on a mixed set. Needs free-rect merging or multi-sort retry

### Canvas size note
After iTerm2 resize, always: Ctrl+B D → tmux attach -t wibwob → detach again → canvas locks to new size.
Current session canvas: **362×96**. Use `/state` to query before every gallery run.

---

## Session 3 — 2026-02-23 afternoon (stamp mode + cluster sprint)

### What was built
- `cluster` algorithm: rectpack MaxRects true 2D bin-pack → bounding-box centred on canvas  
  - `anchor` option (9 positions: center/tl/tr/bl/br/top/bottom/left/right + compass aliases)  
  - `margin` slider: 0=flush, 8=default, 20=airy — single knob for breathing room  
  - `inner_algo` option: maxrects_bssf / maxrects_bl / skyline_bl / guillotine  
  - Placed 20/20 items vs packery's 15/20 — MaxRects > guillotine by 30%+
- `stamp` algorithm: primers as repeating stamps on a pattern  
  - Patterns: `text` (3×5 pixel font), `grid`, `wave`, `diagonal`, `cross`, `border`, `spiral`  
  - Multi-line text via `|` separator (e.g. `"WIB|WOB|DOS"`)  
  - Cycling primers: pass multiple filenames, they rotate across stamp positions  
  - `anchor` same as cluster — 9 canvas positions  
- `rectpack` installed into venv + added to `requirements.txt`  
- `scripts/stamp.sh` — one-liner wrapper: label / primer / pattern / opts → arrange + snap  
- 29 total stamp experiments across 2 sessions, all snapped, 0 overlaps, 0 OOB throughout

### Friction encountered

**F1 — `win_map` keyed by basename broke duplicate filenames**  
Stamp mode opens the same primer 20–100 times. Old apply logic used `dict[basename → win_id]`
so the 2nd–Nth window of the same file was never matched, leaving placements unpositioned.  
Fix: detect `has_dupes = len(all_fnames) != len(set(all_fnames))` → open-fresh mode, track
`used_ids: set[str]` to prevent reusing the same window ID across placements.  
**Lesson**: any algo that repeats a primer (stamp, pattern fill, mosaic) needs open-fresh mode.

**F2 — rectpack y-axis is bottom-up; TV is top-down**  
rectpack places (0,0) at bottom-left. TV canvas has (0,0) at top-left.
Without flipping, all windows appeared at wrong vertical positions.  
Fix: `tv_y = uh - ry - rh` (flip within usable height). Add to any future rectpack usage.

**F3 — snap.sh timing miss on heavy loads**  
Run 12 (29 windows opened rapidly) snapped an empty/transitional screen.  
Fix: added 0.5s sleep before snap in Python driver. For >25 windows, use 0.8s.

**F4 — `opts` not in scope inside layout functions for `turns` param**  
Spiral pattern's `turns` was hardcoded `if False else 3`. `opts` dict only exists in the
route handler closure — layout functions take explicit kwargs.  
Fix: thread `turns=float(opts.get("turns", 3.0))` through dispatch lambda.  
**Pattern**: always pass every option as an explicit kwarg, never read `opts` inside `_layout_*`.

**F5 — `scripts/stamp.sh` shell quoting fragile with nested JSON**  
The helper uses `python3 -c` to merge opts JSON but complex nested values with apostrophes
break the shell interpolation. Fine for simple cases; for complex opts use the Python driver.  
Fix: document in stamp.sh header — for complex opts, prefer the Python driver pattern.

### Helper scripts added
- `scripts/stamp.sh` — one-liner stamp experiments (simple opts, no nested quotes)

### Remaining friction
- No `scripts/gallery.sh` equivalent for `cluster` mode — easy follow-on
- `stamp` spiral places fewer stamps than expected when `turns` is high because
  deduplication removes overlapping grid positions — could use float positions instead of int
- `_layout_stamp` wave uses `cols` as width, which is unintuitive (it means "number of stamps
  across the wave", not "number of grid columns") — rename param to `count` for wave/spiral
- Gallery layout engine still in `main.py` (STUB-14 from session 2) — now ~800 lines of layout
  code before the first route. Extracting to `gallery.py` is increasingly urgent.

### Canvas note
Session 3 canvas: **362×96** throughout. Confirmed stable after Cinema Display font-size lock.

---

## Session 4 friction — chrome flags, shadowless, 4-up comparison

**F6 — WIBWOB_INSTANCE mismatch: silent IPC failure**
TUI started without `WIBWOB_INSTANCE=1` → socket `/tmp/test_pattern_app.sock`.
API started with `WIBWOB_INSTANCE=1` → expects `/tmp/wibwob_1.sock`.
Health check passes (API is up), but every IPC call returns `Connection refused`.
No obvious error in API logs until you check `tail /tmp/wibwob_debug.log`.
Fix: quick-start section added to CLAUDE.md with exact copy-paste commands.
Diagnostic: `tail -3 /tmp/wibwob_debug.log` — if `socket=/tmp/test_pattern_app.sock`, restart TUI with `WIBWOB_INSTANCE=1`.

**F7 — `menu/command open_primer` needs fully resolved path**
Passing `path=iso-cube-cornered.txt` (bare filename) fails with "file not found".
`gallery/arrange` resolves paths internally before sending to IPC — `menu/command` does not.
Fix: use `realpath` or `find` to get the absolute path before passing to `menu/command`.
Confirmed: `/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld/primers/<name>.txt`.

**F8 — frameless incorrectly auto-implied shadowless (design error)**
C++ originally had `if (shadowless || frameless) state &= ~sfShadow`.
This made frameless+shadow and frameless-only look identical — caught immediately
in the 4-up visual comparison.
Fix: `if (shadowless)` only — the two flags are now fully independent orthogonal axes.
Truth table documented in CLAUDE.md and as a C++ class comment.

**F9 — `show_title` is a no-op on frameless windows (expected, but surprising)**
`TGhostFrame` has no title bar, so `aTitle` is set but never rendered.
The 4-up comparison made this obvious: only the two framed windows showed their labels.
Fix: documented in schema description and CLAUDE.md chrome table.

### Helper patterns added this session
- `force_open=true` on `gallery/arrange` → always opens fresh window (needed for multi-call same-primer 4-up)
- 4-up comparison pattern: `close_all` + 4× `open_primer` with absolute path + different chrome flags
- `WIBWOB_INSTANCE=1` must be on **both** TUI start command and API start command

### Canvas note
Session 4 canvas: **362×84** (Cinema Display, font size slightly larger than session 3).
