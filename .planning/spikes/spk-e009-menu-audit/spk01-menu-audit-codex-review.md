# SPK01 — Menu System Codex Review + Spike Plan

Status: not-started

## Purpose

Before implementing the menu redesign (E009), run a focused Codex session to:
1. Validate and extend the initial audit (`CODEX-ANALYSIS-MENU-AUDIT.md`)
2. Produce an ordered implementation sequence
3. Identify any blockers or unexpected complexity

## Codex prompt adjustments needed

The Codex job should be given:
- `CODEX-RETRO-20260218.md` as context (coding conventions + prior Codex guidance)
- `CODEX-ANALYSIS-MENU-AUDIT.md` as prior audit
- `app/command_registry.h`, `app/command_registry.cpp`, `app/window_type_registry.cpp`, `app/test_pattern_app.cpp`
- Explicit instructions to produce: ordered fix list, PR sequence, test plan

Key prompt additions:
- "Read CODEX-RETRO-20260218.md first for project conventions"
- "Read CODEX-ANALYSIS-MENU-AUDIT.md for the prior audit"
- "Produce an ordered implementation plan: which fixes first, which last, and why"
- "Flag any fixes that require a C++ rebuild to verify"

## Rules changes suggested

- Move all Codex analysis logs to `docs/codex-reviews/` subdirectory (currently cluttering repo root)
- Update CLAUDE.md Verification section to note `docs/codex-reviews/` as canonical log location
- Add note to Codex prompt template: "Save log to docs/codex-reviews/codex-<topic>-YYYYMMDD.log"

## Output

- Ordered implementation plan for E009 features
- Test plan for each fix
- PR sequence recommendation

---

## ASCII Wireframe — Before / After (File + Edit menus)

One row per menu state. `[x]` = dead end / to remove. `[!]` = bug. `[+]` = new/renamed.
Left column = current state. Right column = post-E009 target.

### File menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ File ──────────────────────────────┐   ┌─ File ──────────────────────────────┐
│ New Test Pattern          Ctrl+N    │   │ New Test Pattern          Ctrl+N    │
│ New H-Gradient                      │   │ New Gradient ►                      │
│ New V-Gradient                      │   │   ├ Horizontal                      │
│ New Radial Gradient                 │   │   ├ Vertical                        │
│ New Diagonal Gradient               │   │   ├ Radial                          │
│ New Mechs Grid  [x dead end]  Ctrl+M│   │   └ Diagonal                        │
│ New Animation (Donut)       Ctrl+D  │   │ New Animation (Donut)       Ctrl+D  │
│ ────────────────────────────────── │   │ ────────────────────────────────── │
│ Open Text/Animation...      Ctrl+O  │   │ Open Text/Animation...      Ctrl+O  │
│ Open Image...    [! type=fallback]  │   │ Open Image...               [+reg]  │
│ Open Monodraw...                    │   │ Open Monodraw...                    │
│ ────────────────────────────────── │   │ ────────────────────────────────── │
│ Save Workspace                      │   │ Save Workspace                      │
│ Open Workspace...                   │   │ Open Workspace...                   │
│ ────────────────────────────────── │   │ ────────────────────────────────── │
│ Exit                        Alt-X   │   │ Exit                        Alt-X   │
└─────────────────────────────────────┘   └─────────────────────────────────────┘

Notes:
  - "New Mechs Grid" removed (handler commented out for months, no spec)
  - 4 gradient variants collapsed into submenu (saves 3 rows, adds gradient_kind param)
  - "Open Image..." gets a registry spec so it stops reporting as test_pattern
```

### Edit menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ Edit ──────────────────────────────┐   ┌─ Edit ──────────────────────────────┐
│ Copy Page                 Ctrl+Ins  │   │ Copy Page                 Ctrl+Ins  │
│ ────────────────────────────────── │   │ ────────────────────────────────── │
│ Screenshot                Ctrl+P   │   │ Screenshot                Ctrl+P   │
│ ────────────────────────────────── │   │ ────────────────────────────────── │
│ Pattern Mode ►                      │   │ Pattern Mode ►                      │
│   ├ ● Continuous (Diagonal)         │   │   ├ ● Continuous (Diagonal)         │
│   └   Tiled (Cropped)               │   │   └   Tiled (Cropped)               │
│                                     │   │ ────────────────────────────────── │
│  [no settings here currently]       │   │ Settings...            [+ moved]    │
└─────────────────────────────────────┘   └─────────────────────────────────────┘

Notes:
  - Settings currently lives under Tools — could move here for discoverability
  - Pattern Mode submenu stays as-is (works correctly, no registry issues)
  - Edit is otherwise clean — no dead ends
```

### Concept validation

This ASCII wireframe approach works well for:
- Spotting dead ends visually (the `[x]` rows stand out)
- Communicating "before → after" without writing prose
- Annotating type bugs inline (`[! type=fallback]`, `[+reg]`)
- Could extend to View/Window/Tools in a full E009 spike doc

Suggested: generate full 5-menu wireframe as part of the Codex spike output,
to give the implementer a visual target rather than just a bug list.
