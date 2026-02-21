# SPK — Group Games Under View > Games Submenu

## Status

Status: not-started
GitHub issue: #77
PR: —

## Summary

Games (Micropolis ASCII MVP, Quadra, Snake) currently sit as flat items in the View menu alongside generative art engines and other views. Group them under a `Games` submenu for cleaner organisation.

## Current State

In `app/test_pattern_app.cpp` lines ~2004–2020, the View menu is a flat list:

```
View >
  ASCII Grid Demo
  Animated Blocks
  Animated Gradient
  ...8 generative art items...
  Micropolis ASCII MVP      ← game
  Quadra (Falling Blocks)   ← game
  Snake                     ← game
  ---
  Game of Life
  Paint Canvas
  Scramble Cat
  Scramble Expand
```

## Target State

```
View >
  ASCII Grid Demo
  Animated Blocks
  Animated Gradient
  ...generative art items...
  ---
  Games >
    Micropolis ASCII MVP
    Quadra (Falling Blocks)
    Snake
  ---
  Game of Life
  Paint Canvas
  Scramble Cat
  Scramble Expand
```

## Implementation

Single-file change in `app/test_pattern_app.cpp`:

Replace the three flat `TMenuItem` entries with a `TSubMenu`:

```cpp
// Before (flat):
*new TMenuItem("~M~icropolis ASCII MVP", cmMicropolisAscii, kbNoKey) +
*new TMenuItem("~Q~uadra (Falling Blocks)", cmQuadra, kbNoKey) +
*new TMenuItem("~S~nake", cmSnake, kbNoKey) +

// After (submenu):
newLine() +
(TMenuItem&)(
    *new TSubMenu("~G~ames", kbNoKey) +
        *new TMenuItem("~M~icropolis City Builder", cmMicropolisAscii, kbNoKey) +
        *new TMenuItem("~Q~uadra (Falling Blocks)", cmQuadra, kbNoKey) +
        *new TMenuItem("~S~nake", cmSnake, kbNoKey)
) +
newLine() +
```

## Acceptance Criteria

- AC-1: View menu shows "Games >" submenu containing all three games.
  Test: Build and run, open View menu, verify submenu renders and all three items launch correctly.

- AC-2: No regression — each game command still dispatches correctly.
  Test: `command_registry_test` passes. Manual launch of each game from submenu.

- AC-3: Keyboard accelerator `Alt-V, G` opens Games submenu.
  Test: Manual verification.

## Scope

- One file: `app/test_pattern_app.cpp`
- No command registry changes (command names unchanged)
- No API/IPC impact
