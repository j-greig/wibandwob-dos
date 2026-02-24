# Dev Handover — WibWobDOS

> **Note:** This handover predates the `test_pattern` → `wwdos` rename. File/binary references below reflect the state at time of writing.

**Date:** 2026-02-23  
**Branch:** `feat/scramble-visual-polish`  
**Status:** Build clean ✅ — uncommitted Codex changes, needs visual test + commit

---

## What Just Happened

VSCode crashed mid-session. This doc is the recovery point.

---

## Current State

### Branch
```
feat/scramble-visual-polish
```
Branched from `main` (which has PR #88 merged — jet black bg + smol resize fix).

### Uncommitted Changes (3 files, build is clean)
```
M  app/scramble_view.cpp
M  app/scramble_view.h
M  app/test_pattern_app.cpp
```

These were applied by a Codex run (`scramble-polish-162832.log`) and **successfully compiled** — binary at `./build/app/test_pattern`. The session ended before the visual test step.

### What Codex Changed
**Goal:** F8 three-state cycle + visual polish + fix tall view.

1. **`cycleScramble()`** — new single function replacing both `toggleScramble()` and `toggleScrambleExpand()`. Cycle: `hidden → smol → tall → hidden` (tall→hidden destroys window, doesn't pass through smol).

2. **`cmScrambleExpand` and `cmScrambleCat`** both route to `cycleScramble()` — unified.

3. **"Scramble Expand" menu item removed** — F8 does all three states now. Shift+F8 status bar item gone too.

4. **Help text updated** — "F8 Scramble (cycle)"

5. **`TScrambleWindow::draw()` override added** — hides frame in smol mode by filling border cells black. Declared as `virtual void draw() override` in header.

6. **Visual:** white cat on black, white bubble text, black backgrounds throughout (started in PR #88, Codex extended).

7. **`cmScrambleExpand = 181` moved to `scramble_view.h`** — duplicate definition removed from `test_pattern_app.cpp`.

---

## What Still Needs Doing (E006)

### Immediate — visual test
1. Start the TUI: `tmux new-session -s wibwob ./build/app/test_pattern`
2. Press F8 three times — verify: hidden → smol → tall → hidden cycle works
3. In smol mode: check no visible frame border, white cat on pure black
4. In tall mode: check message view + input, black bg throughout, no grey
5. If anything looks wrong, see `app/scramble_view.cpp` — `draw()` override and `layoutChildren()` are the key methods

### Then — commit and PR
```bash
git add app/scramble_view.cpp app/scramble_view.h app/test_pattern_app.cpp
git commit -m "feat(e006): F8 three-state cycle + visual polish (hidden→smol→tall→hidden)"
gh pr create --title "feat/e006: scramble three-state F8 cycle + visual polish" --body "..."
```

### Outstanding E006 work (from epic brief)
- Smol view: no visible border in smol mode — check if `flags = 0` + `draw()` override fully hides the TWindow frame chrome
- Tall view: ensure welcome message shows on open, input focus works
- Spike written: `.planning/spikes/spk-desktop-texture-color.md` (desktop colour/texture options — not started, future story)

---

## Environment Quick-Start

```bash
# Terminal 1 — TUI
cd /Users/james/Repos/wibandwob-dos
tmux new-session -s wibwob ./build/app/test_pattern

# Terminal 2 — API (with auto-reload)
cd /Users/james/Repos/wibandwob-dos
WIBWOB_INSTANCE=1 ./tools/api_server/venv/bin/uvicorn tools.api_server.main:app \
  --host 127.0.0.1 --port 8089 --reload

# Build (if you edit C++)
cmake --build build --target test_pattern -j4

# Binary is at:
./build/app/test_pattern   # NOT ./build/test_pattern (friction log #17)
```

Canvas is **362×84** (Cinema Display). API port **8089**.

---

## Key Files

| File | What it does |
|---|---|
| `app/scramble_view.cpp` | Scramble window — layout, draw, state machine |
| `app/scramble_view.h` | `TScrambleWindow`, `ScrambleDisplayState` enum, `cmScrambleExpand = 181` |
| `app/test_pattern_app.cpp` | App entry, `cycleScramble()`, menu, IPC handlers |
| `app/command_registry.cpp` | IPC command dispatch |
| `.planning/epics/e006-scramble-tui-presence/e006-epic-brief.md` | E006 epic — F01–F03 done, F04 dropped, F05 simplified |
| `.planning/epics/EPIC_STATUS.md` | All epic statuses |
| `.planning/spikes/spk-desktop-texture-color.md` | New spike: desktop colour/texture options |

---

## Prompt to Resume (paste this into a new Claude Code / pi session)

```
We are working on WibWobDOS — a C++ Turbo Vision TUI app.
Repo: /Users/james/Repos/wibandwob-dos
Branch: feat/scramble-visual-polish

## What's Done
- Build is clean (cmake --build build --target test_pattern -j4)
- Binary: ./build/app/test_pattern
- Codex applied F8 three-state cycle changes:
  - cycleScramble() replaces toggleScramble() + toggleScrambleExpand()
  - F8 now cycles hidden → smol → tall → hidden
  - Visual: white cat on jet black, no grey, black bg throughout
  - draw() override in TScrambleWindow hides frame chrome in smol mode
- Files changed (uncommitted): app/scramble_view.cpp, app/scramble_view.h, app/test_pattern_app.cpp

## What I Need
1. Start TUI in tmux (session name: wibwob) and take a screenshot to verify visuals
2. Check F8 three-state cycle works correctly
3. Check smol view has no visible border/frame chrome
4. Check tall view: black bg, white text, input focus works
5. Fix anything broken, then commit and open a PR

## Key Context
- API port: 8089, WIBWOB_INSTANCE=1
- Canvas: 362×84
- SHADOW_W=2, SHADOW_H=1 — never change
- Epic: E006 scramble TUI presence (.planning/epics/e006-scramble-tui-presence/e006-epic-brief.md)
- Spike written today: .planning/spikes/spk-desktop-texture-color.md (desktop colour/texture — future)
- HANDOVER.md in repo root has full context

Read CLAUDE.md and HANDOVER.md before making any changes.
```
