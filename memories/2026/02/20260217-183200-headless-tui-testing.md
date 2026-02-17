---
type: discovery
status: complete
tags: [infrastructure, process, scramble, skill-building, tv-focus]
tldr: "Headless TUI testing + TV keyboard focus gotcha: select() on TWindow only changes Z-order, NOT focus. Use setCurrent() directly."
---

# Headless TUI Testing + TV Focus Root Cause

**Captured:** 2026-02-17 18:32 (updated 19:28)
**Source:** E006 Scramble expand feature debugging session

---

How Claude Code interacts with a full ncurses TUI app it can't visually see:

## Critical: Use tmux for proper terminal size

The Bash tool's pseudo-terminal is TINY (a few rows). Turbo Vision reads terminal size via ioctl, so layouts break with negative heights. **Always use tmux:**

```bash
tmux new-session -d -s wibwob -x 120 -y 40 \
  '/path/to/build/app/test_pattern 2>/tmp/wibwob_debug.log'
```

This gives the app a real 120x40 pty. Without it, `getExtent()` returns nonsensical bounds.

Note: screenshots save to **working directory** (`build/logs/screenshots/` not project root).

## The Testing Loop

**1. Launch in tmux with stderr redirect:**
```bash
tmux new-session -d -s wibwob -x 120 -y 40 \
  '/Users/james/Repos/wibandwob-dos/build/app/test_pattern 2>/tmp/wibwob_debug.log'
```

**2. Send commands via API (port 8089):**
```bash
curl -s http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' \
  -d '{"command":"scramble_expand"}'
```

**3. Inject chat messages (new scramble_say command):**
```bash
curl -s http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' \
  -d '{"command":"scramble_say","args":{"text":"hello scramble"}}'
```

**4. "See" the TUI via frame capture:**
```bash
curl -s http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' \
  -d '{"command":"screenshot"}'
# Then read: build/logs/screenshots/tui_YYYYMMDD_HHMMSS.txt
```

**5. Read debug telemetry:**
```bash
cat /tmp/wibwob_debug.log
```

## Visual Diary: E006 Scramble Expand Test Session (2026-02-17)

### Shot 1: Clean desktop
```
  File  Edit  View  Window  Tools  Help                          つ ◕‿◕‿◕༽つ
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 Alt-X Exit  Ctrl-N New Window  F8 Scramble  F10 Menu
```
Empty desktop. Just the background pattern and status bar.

### Shot 2: Smol Scramble (F8)
```
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░┌────────────  ────────────┐░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│┌───────────────Ŀ░░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││ mrrp! (=^..^=) │░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│└────────────────┘░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░░░░░\░░░░░░░░░░░░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░   /\_/\   ░░░░░░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░  ( o.o )  ░░░░░░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░   > ^ <   ░░░░░░░░░░░░░│░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░└──────────────────────────┘░
```
Bottom-right, behind other windows. Speech bubble + cat art. Single-line frame.

### Shot 3: Tall mode with welcome (Shift+F8)
```
┌─────────────  ─────────────┐
│ scramble:                  │  <- message history (gold sender)
│  mrrp! ask me anything     │  <- wrapped text (gray)
│  (=^..^=)                  │
│                            │  <- empty space (dark bg)
│                            │
│────────────────────────────│  <- separator
│>                           │  <- input prompt
│░░░░░░░░░░░░░░░░░░░░░░░░░░░│  <- cat view area
│░░   /\_/\   ░░░░░░░░░░░░░░│
│░░  ( o.o )  ░░░░░░░░░░░░░░│
└────────────────────────────┘
```
Full height. Welcome message in history. Input ready for typing.

### Shot 4: Multi-message chat (via scramble_say API)
```
│ scramble:                  │
│  mrrp! ask me anything     │
│  (=^..^=)                  │
│ you:                       │  <- user message
│  hello what do you know    │  <- word-wrapped properly!
│  about cats                │
│ scramble:                  │  <- KB identity response
│  i'm scramble. recursive   │
│  cat. i live here now.     │
│  (=^..^=)                  │
│ you:                       │
│  do you like fish          │
│ scramble:                  │
│  i'm scramble. recursive   │
│  cat. i live here now.     │
│  (=^..^=)                  │
│────────────────────────────│
│>                           │
│░░     ?     ░░░░░░░░░░░░░░│  <- curious pose!
│░░   /\_/\   ░░░░░░░░░░░░░░│
│░░  ( O.O )  ░░░░░░░░░░░░░░│
```
KB matched "cats" -> identity response. Cat changed to curious pose. Speech bubble shows response.

### Shot 5: Back to smol (Shift+F8 again)
```
┌─────────────  ─────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░│  <- message view hidden
│░┌────────────  ────────────┐│  <- nested smol frame artifact
│░│░░   /\_/\   ░░░░░░░░░░░░││
│░│░░  ( o.o )  ░░░░░░░░░░░░││
└─└──────────────────────────┘
```
Shrunk back to smol. Note: nested frame rendering artifact (tall frame border lingering).

## Bugs Found During Testing

1. **%20 encoding**: Python IPC escapes spaces as `%20`, C++ wasn't decoding. Fixed with `percent_decode()` in `api_ipc.cpp`.
2. **Negative interior height**: Bash pseudo-terminal gave 0-row desktop -> negative layout. Fixed with guard in `layoutChildren()`.
3. **Frame nesting artifact**: When transitioning tall->smol, the old tall frame border persists around the smol window. Cosmetic, needs investigation.
4. **Keyboard input not working in tall mode** — ROOT CAUSE FOUND. See below.

## Bug #4: TWindow::select() Does NOT Set Focus (Root Cause Analysis)

**Symptom:** Cursor blinks in Scramble input field but typing produces nothing. Works after ~5 F8 toggle cycles.

**Root cause chain (traced through tvision source):**

```
select() on TWindow
  → checks ofTopSelect (TWindow has this by default)
  → calls makeFirst() (Z-order only)
    → putInFrontOf(owner->first())
      → owner->resetCurrent()
        → setCurrent( firstMatch(sfVisible, ofSelectable) )
          → firstMatch iterates from `last` (BOTTOM of Z-order)
          → finds FIRST visible+selectable view from bottom
          → if ANY other window exists below ours → THAT gets focus
```

**Why it appeared random:** `firstMatch` iteration order depends on Z-list position.
After enough F8 toggling, the Z-order shuffles so the scramble window happens to be
found first by `firstMatch`. Then it works until next layout change.

**Fix:** Don't use `select()` for programmatic window focus. Call `setCurrent()` directly:

```cpp
// WRONG — ofTopSelect makes this only change Z-order:
scrambleWindow->select();

// RIGHT — explicitly set as desktop's focused window:
scrambleWindow->makeFirst();
deskTop->setCurrent(scrambleWindow, normalSelect);
```

**Ranked causes (for future keyboard-not-working bugs in TV):**

| Rank | Cause | Check |
|------|-------|-------|
| 1 | Window not `current` in desktop | `deskTop->current != yourWindow` |
| 2 | `ofSelectable` not set on window | `(options & ofSelectable) == 0` |
| 3 | `sfDisabled` set on window | `(state & sfDisabled) != 0` |
| 4 | `eventMask` missing `evKeyDown` | `(eventMask & evKeyDown) == 0` |
| 5 | Menu bar active (steals focus) | Press Escape first |
| 6 | Key consumed by status line accelerator | Check status line shortcuts |

**Timer broadcasts vs keyboard dispatch (why cursor blinks but keys don't work):**
- Timer broadcasts (`evBroadcast/cmTimerExpired`) go to ALL views via `forEach` — no focus required
- Keyboard events (`evKeyDown`) go ONLY to `current` via `doHandleEvent(current, ...)` — requires focus

---

## Session Outcome (2026-02-17 19:28)

All three issues in this session resolved and confirmed working by user:

1. **Keyboard focus fixed** — `focusInput()` now calls `makeFirst()` + `grp->setCurrent(this, normalSelect)` instead of `select()`. Input works immediately on first Shift+F8 open, no fiddling required.
2. **Frame buttons added** — Tall mode gets `wfClose | wfMove` chrome. Close button posts `cmScrambleToggle` to avoid dangling pointer. Smol stays chromeless (`flags = 0`).
3. **"Scramble" title** — Tall mode frame shows title; smol is empty.

Committed as: `feat(scramble): expand states, keyboard focus, frame chrome (E006 spk01)`

**Why this matters:** Full headless testing loop for a TUI app. tmux is the key insight for proper terminal dimensions. The TV focus gotcha (`select()` vs `setCurrent()`) is the single most common cause of "cursor blinks but keys don't work" in Turbo Vision.
