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
