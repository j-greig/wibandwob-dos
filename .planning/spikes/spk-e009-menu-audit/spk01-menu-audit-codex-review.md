# SPK01 — Menu System Codex Review + Spike Plan

Status: in-progress

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

### View menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ View ─────────────────────────────┐   ┌─ View ─────────────────────────────┐
│ ASCII Grid Demo [! type=fallback]  │   │ Generative ►                       │
│ Animated Blocks                    │   │   ├ Verse Field                    │
│ Animated Gradient                  │   │   ├ Orbit Field                    │
│ Animated Score                     │   │   ├ Mycelium Field                 │
│ Score BG Color...                  │   │   ├ Torus Field                    │
│ Verse Field (Generative)           │   │   ├ Cube Spinner                   │
│ Orbit Field (Generative)           │   │   ├ Monster Portal                 │
│ Mycelium Field (Generative)        │   │   ├ Monster Verse                  │
│ Torus Field (Generative)           │   │   └ Monster Cam                    │
│ Cube Spinner (Generative)          │   │ ────────────────────────────────── │
│ Monster Portal (Generative)        │   │ Animated ►                         │
│ Monster Verse (Generative)         │   │   ├ Blocks                         │
│ Monster Cam (Emoji)                │   │   ├ Gradient                       │
│ ────────────────────────────────── │   │   └ Score                          │
│ Zoom In       [x placeholder]      │   │ ASCII Grid Demo           [+reg]  │
│ Zoom Out      [x placeholder]      │   │ ────────────────────────────────── │
│ Actual Size   [x placeholder]      │   │ Score BG Color...                  │
│ Full Screen   [x placeholder]  F11 │   │ ────────────────────────────────── │
│ ────────────────────────────────── │   │ Scramble Cat                  F8   │
│ Scramble Cat                  F8   │   │ Scramble Expand          Shift+F8  │
│ Scramble Expand          Shift+F8  │   └─────────────────────────────────────┘
└─────────────────────────────────────┘

Notes:
  - Zoom/FullScreen placeholders removed (no handler, no spec, F11 key wasted)
  - 8 generative views collapsed into submenu (declutters main menu by 7 rows)
  - 3 animated views collapsed into submenu
  - ASCII Grid Demo gets a registry spec [+reg] so it stops falling back to test_pattern
  - "(Generative)" / "(Emoji)" suffixes dropped — submenu heading makes them obvious
  - Score BG Color stays (operates on existing Score window, not a spawn)
```

### Window menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ Window ───────────────────────────┐   ┌─ Window ───────────────────────────┐
│ Edit Text Editor                   │   │ Text Editor                        │
│ Browser                   Ctrl+B   │   │ Browser                   Ctrl+B   │
│ ────────────────────────────────── │   │ Open Text (Transparent)...         │
│ Open Text (Transparent BG)...      │   │ ────────────────────────────────── │
│ ────────────────────────────────── │   │ Cascade                            │
│ Cascade                            │   │ Tile                               │
│ Tile                               │   │ Send to Back                       │
│ Send to Back                       │   │ ────────────────────────────────── │
│ ────────────────────────────────── │   │ Next                          F6   │
│ Next                          F6   │   │ Previous                 Shift+F6  │
│ Previous                 Shift+F6  │   │ ────────────────────────────────── │
│ ────────────────────────────────── │   │ Close                     Alt+F3   │
│ Close                     Alt+F3   │   │ Close All                          │
│ Close All                          │   │ ────────────────────────────────── │
│ ────────────────────────────────── │   │ Background Color...                │
│ Background Color...                │   └─────────────────────────────────────┘
└─────────────────────────────────────┘

Notes:
  - "Edit Text Editor" renamed to just "Text Editor" (less confusing in Window menu)
  - Text Editor handler must call registerWindow() [bug #2]
  - Otherwise clean — no dead ends, no type bugs
  - "BG" expanded to full word for clarity
```

### Tools menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ Tools ────────────────────────────┐   ┌─ Tools ────────────────────────────┐
│ Wib&Wob Chat              F12      │   │ Wib&Wob Chat              F12      │
│ Test A (stdScrollBar)              │   │ ────────────────────────────────── │
│ Test B (TScroller)                 │   │ Glitch Effects ►                   │
│ Test C (Split Arch)                │   │   ├ Enable Glitch Mode    Ctrl+G   │
│ ────────────────────────────────── │   │   ├ ──────────────────────────── │
│ Glitch Effects ►                   │   │   ├ Scatter Pattern               │
│   ├ Enable Glitch Mode    Ctrl+G   │   │   ├ Color Bleed                   │
│   ├ ──────────────────────────── │   │   ├ Radial Distort                │
│   ├ Scatter Pattern                │   │   ├ Diagonal Scatter              │
│   ├ Color Bleed                    │   │   ├ ──────────────────────────── │
│   ├ Radial Distort                 │   │   ├ Capture Frame            F9   │
│   ├ Diagonal Scatter               │   │   └ Reset Parameters             │
│   ├ ──────────────────────────── │   │ ────────────────────────────────── │
│   ├ Capture Frame            F9    │   │ Quantum Printer          [easter] │
│   ├ Reset Parameters               │   │ ────────────────────────────────── │
│   └ Glitch Settings [x placeholder]│   │ API Key...                         │
│ ────────────────────────────────── │   └─────────────────────────────────────┘
│ ANSI Editor     [x placeholder]    │
│ Paint Tools     [x placeholder]    │
│ Animation Studio [x placeholder]   │
│ ────────────────────────────────── │
│ Quantum Printer          [easter]  │
│ ────────────────────────────────── │
│ API Key...                         │
└─────────────────────────────────────┘

Notes:
  - Test A/B/C removed (dev-only, type=fallback to test_pattern, never ship)
  - ANSI Editor / Paint Tools / Animation Studio removed (placeholder msg boxes)
  - Glitch Settings removed (placeholder msg box inside submenu)
  - Quantum Printer stays (easter egg, harmless, fun)
  - Cmd ID collisions fixed elsewhere: cmTextEditor=130/cmKeyboardShortcuts=130,
    cmWibWobChat=131/cmDebugInfo=131 [bug #1]
  - WibWobChat type already marked internal/non-syncable — no type fix needed
```

### Help menu

```
BEFORE (current)                          AFTER (E009 target)
─────────────────────────────────────     ─────────────────────────────────────
┌─ Help ─────────────────────────────┐   ┌─ Help ─────────────────────────────┐
│ About WIBWOBWORLD                  │   │ About WIBWOBWORLD                  │
│                                    │   │ Keyboard Shortcuts...     [+new]   │
└─────────────────────────────────────┘   └─────────────────────────────────────┘

Notes:
  - Clean. About dialog is fine.
  - cmKeyboardShortcuts (130) exists but has no menu item — add here after ID fix
```

---

## Full bug inventory (cross-referenced from wireframes)

All 7 bugs from handover, plus issues surfaced during wireframe audit:

| # | Bug | Severity | Menu(s) | Fix |
|---|-----|----------|---------|-----|
| 1 | Cmd ID collisions: cmTextEditor=cmKeyboardShortcuts=130, cmWibWobChat=cmDebugInfo=131 | HIGH | Window, Tools | Reassign to 200+ range |
| 2 | text_editor skips registerWindow() | HIGH | Window | Add registerWindow(w) call |
| 3 | Add syncable flag to WindowTypeSpec | MEDIUM | (infra) | bool syncable in spec, replace _INTERNAL_TYPES |
| 4 | Fallback masks unknown types as test_pattern | MEDIUM | File, View, Tools | Return "unknown" not "test_pattern" |
| 5 | Dead-end / placeholder menu items | LOW | File, View, Tools | Remove: Mechs, Zoom×4, ANSI/Paint/AnimStudio, GlitchSettings |
| 6 | Gradient subtype not in sync delta | LOW | File | Add gradient_kind to get_state props |
| 7 | No registry-menu linkage check | LOW | (infra) | Runtime assert in dev builds |
| 8 | Test A/B/C fall through to test_pattern | LOW | Tools | Remove menu items (dev-only) |
| 9 | ASCII Grid Demo falls through to test_pattern | LOW | View | Add registry spec or remove |
| 10 | Open Image falls through to test_pattern | MEDIUM | File | Add ascii_image registry spec |
| 11 | API Key dialog leaks into get_state as test_pattern | LOW | Tools | Dialog should be excluded from window iteration |

### Concept validation

This ASCII wireframe approach works well for:
- Spotting dead ends visually (the `[x]` rows stand out)
- Communicating "before → after" without writing prose
- Annotating type bugs inline (`[! type=fallback]`, `[+reg]`)

Full 5-menu + Help wireframe now complete — implementer has a visual target for every menu.
