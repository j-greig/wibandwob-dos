# SPK — Group Games Under View > Games Submenu

## Status

Status: done
GitHub issue: #77
PR: —

## Summary

Games were flat items mixed in with generative art in the View menu. Now grouped under a `Games` submenu.

## Result

```
View >
  ...generative art items...
  ---
  Games >
    Micropolis City Builder
    Quadra (Falling Blocks)
    Snake
    WibWob Rogue
    Deep Signal
  ---
  Paint Canvas
  Scramble Cat
  Scramble Expand
```

## Implementation

Single-file change in `app/test_pattern_app.cpp`:

```cpp
newLine() +
(TMenuItem&)(
    *new TSubMenu("~G~ames", kbNoKey) +
        *new TMenuItem("~M~icropolis City Builder", cmMicropolisAscii, kbNoKey) +
        *new TMenuItem("~Q~uadra (Falling Blocks)", cmQuadra, kbNoKey) +
        *new TMenuItem("~S~nake", cmSnake, kbNoKey) +
        *new TMenuItem("Wib~W~ob Rogue", cmRogue, kbNoKey) +
        *new TMenuItem("~D~eep Signal", cmDeepSignal, kbNoKey)
) +
newLine() +
```

## Acceptance Criteria

- [x] AC-1: View menu shows "Games >" submenu containing all five games.
  Test: Build and run, open View menu, verify submenu renders and all items launch correctly.

- [x] AC-2: No regression — each game command still dispatches correctly.
  Test: `command_registry_test` passes. Manual launch of each game from submenu.

- [x] AC-3: Keyboard accelerator `Alt-V, G` opens Games submenu.
  Test: Manual verification.
