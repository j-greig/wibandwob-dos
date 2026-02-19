---
type: handover
for: Studio iMac — E009 pickup
from: feat/e009-menu-system-redesign (branched from e1665b3)
date: 2026-02-19
---

# E009 Handover — Menu System Redesign

Hey — picking this up fresh. Here's everything you need to get going immediately.

## What just happened (E008 session)

We did a full multiplayer hardening sprint. Key things landed that are relevant to E009:

- **CODEX-ANALYSIS-MENU-AUDIT.md** in repo root — a Codex `high`-effort read-only audit of the entire menu/window-type system. This is your primary reference. Read it first.
- **`fix(sync)`** — `wibwob` and `scramble` types now filtered from multiplayer sync via `_INTERNAL_TYPES` in `state_diff.py`. But this is a hardcoded workaround — E009 should replace it with a `syncable` registry flag.
- **`fix(chat)`** — path resolution (`path_search.h`), async LLM poll timer, prompt file created at `modules-private/wibwob-prompts/wibandwob.prompt.md`.

## Branch situation

```
feat/e009-menu-system-redesign  ← you are here
  └── branched from e1665b3 (tip of feat/e008-multiplayer-partykit)
       └── E008 not yet merged to main — that's fine, E009 depends on E008
```

## The 7 bugs to fix (ordered by risk/impact)

From `CODEX-ANALYSIS-MENU-AUDIT.md`:

### 1. Command ID collisions (HIGH — dispatch footgun)
```
cmTextEditor    = 130  clashes with  cmKeyboardShortcuts = 130
cmWibWobChat    = 131  clashes with  cmDebugInfo         = 131
```
File: `app/test_pattern_app.cpp` lines ~171–210
Fix: reassign cmKeyboardShortcuts and cmDebugInfo to unused IDs (200+ range is free).

### 2. `text_editor` skips registerWindow() (HIGH — breaks ID drift fix from E008)
File: `app/test_pattern_app.cpp` around line 913 (text editor insertion)
Fix: call `registerWindow(w)` after inserting the text editor window, same pattern as other windows.

### 3. Add `syncable` flag to WindowTypeSpec (MEDIUM — replaces hardcoded _INTERNAL_TYPES)
File: `app/window_type_registry.h` + `app/window_type_registry.cpp`
Fix: add `bool syncable = true` to `WindowTypeSpec`. Set `syncable = false` for `wibwob`, `scramble`.
Then update `state_diff.py`: instead of `_INTERNAL_TYPES` hardcode, read the flag from IPC state.

### 4. Fallback masking unregistered windows (MEDIUM — wrong type in get_state)
`windowTypeName()` falls back to `"test_pattern"` for anything unmatched.
Affected: TAsciiImageWindow, ASCII Grid, WibWobTest A/B/C windows.
Fix: make fallback return `"unknown"` so the bridge can skip them safely.

### 5. Remove / stub dead-end menu items (LOW — cleanup)
- "New Mechs Grid" — handler commented out, menu item still shows
- ASCII Cam — disabled in both menu and dispatch
- Zoom/Paint/Animation Studio — placeholder message boxes
Fix: remove from menu construction or mark disabled.

### 6. Gradient subtype not in sync delta (LOW — wrong visual on remote)
H/V/R/D variants all report as `type=gradient`, remote always gets horizontal.
Fix: add `gradient_kind` to `get_state` props, carry in bridge delta.

### 7. Compile-time/runtime linkage check (LOW — future-proofing)
Fix: runtime assertion in dev builds that every cmXxx handler maps to a registered type.

## Suggested implementation order

```
1. Cmd ID collisions       (5 min, zero risk, do first)
2. registerWindow fix      (30 min, one function call)
3. syncable flag           (1-2 hrs, touches registry + bridge)
4. Fallback → "unknown"    (30 min, one line change + test)
5. Dead-end removal        (30 min, menu cleanup)
6. Gradient subtype        (1 hr, state + bridge + test)
7. Compile-time check      (1 hr, optional, do last)
```

## Files to read first

```
CODEX-ANALYSIS-MENU-AUDIT.md          ← full audit, primary reference
app/test_pattern_app.cpp               ← menu construction + cmXxx constants + dispatch
app/window_type_registry.h/.cpp        ← WindowTypeSpec, all_window_type_specs()
tools/room/state_diff.py               ← _INTERNAL_TYPES (to replace with registry flag)
.planning/epics/e009-menu-system-redesign/e009-epic-brief.md  ← AC list
```

## Tests to run

```bash
# Python bridge tests (should stay 165 passing)
uv run --with pytest pytest tests/room/ -q

# Build
cmake --build ./build
```

## Handover prompt for Claude Code on iMac

Paste this as your opening message:

> I'm picking up E009 (menu system redesign) on branch `feat/e009-menu-system-redesign`.
> Read `.planning/epics/e009-menu-system-redesign/e009-handover-pickup.md` for full context,
> then read `CODEX-ANALYSIS-MENU-AUDIT.md` for the detailed bug inventory.
> Start with bug #1 (command ID collisions in `app/test_pattern_app.cpp`) — it's the
> safest fix with zero risk. Then #2 (registerWindow in text_editor). Show me a diff
> for both before applying anything.
