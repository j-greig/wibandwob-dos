---
id: SPK03
title: App Source Organisation — Subdirectory Structure for Growing app/
status: not-started
issue: ~
pr: ~
type: spike
depends_on: []
---

# SPK03 — App Source Organisation

> **tl;dr** `app/` has 123 files flat and is growing fast. Propose a grouping scheme, validate cmake cost, and decide before E011 (Desktop Shell) lands more apps.

---

## Problem

`app/` is a flat directory of 65 `.cpp` + 58 `.h` files covering wildly different concerns: system infrastructure, generative art engines, games, TUI widgets, chat interfaces, external bridges. No naming pattern reliably groups them. Finding related files requires reading filenames carefully; CMake has one giant source list; READMEs coexist with headers.

E012 extracted `json_utils`, `ui_helpers`, `frame_animation_window`, `paint_wwp_codec` into `app/core/` but stalled — only `json_utils.h` remains there. E011 will add icon layers, folder views, trash, launcher items. Without structure, `app/` will hit 150+ files.

---

## Proposed Grouping

| Subdirectory | What goes there | Current files |
|---|---|---|
| `app/system/` | Core infrastructure: IPC, command registry, window type registry, app entry, theme, clipboard | `api_ipc`, `command_registry`, `window_type_registry`, `wwdos_app`, `theme_manager`, `clipboard_read`, `frame_capture` |
| `app/chat/` | Wib&Wob + Scramble chat, LLM engine, auth | `wibwob`, `wibwob_engine`, `wibwob_background`, `wibwob_scroll_test`, `scramble`, `scramble_engine`, `token_tracker` |
| `app/generators/` | Generative art engines (no user input, continuous output) | `generative_*`, `game_of_life`, `animated_*`, `glitch_engine`, `gradient`, `deep_signal` |
| `app/apps/` | Self-contained interactive apps / games | `backrooms_tv`, `micropolis_ascii`, `quadra`, `snake`, `rogue`, `browser`, `mech*`, `room_chat` |
| `app/views/` | Reusable display widgets (no game logic, no generative engines) | `ascii_gallery`, `ascii_grid`, `ascii_image`, `ansi`, `figlet_text`, `figlet_utils`, `text_doc`, `text_editor`, `text_wrap`, `transparent_text`, `frame_file_player` |
| `app/desktop/` | E011 deliverables: icon layer, folder views, trash, launcher | (future) |
| `app/core/` | Shared utilities (already exists) | `json_utils`, `ui_helpers` (recover E012 extractions) |

Mains (`*_main.cpp`, standalone executables) and test files stay at top level or per-group — decide in analyst findings.

---

## CMake Implications

Each subdirectory gets its own `CMakeLists.txt` exposing a static lib (e.g. `wwdos_generators`, `wwdos_apps`). The root `app/CMakeLists.txt` links them. This:

- Enables incremental builds per group (faster iteration on e.g. just `apps/`)
- Enforces dependency direction (generators must not depend on apps)
- Makes it easy to see what `backrooms_tv` depends on without reading 2600-line `wwdos_app.cpp`

Risk: tvision's `Uses_*` macros need to be scoped correctly per translation unit — no change expected, but needs a build verification pass.

---

## READMEs

Current convention: `SCREAMING_SNAKE.md` colocated with source (`FRAME_PLAYER.md`, `BACKROOMS_TV.md`). With subdirs these move to their group folder. `app/README.md` becomes a catalogue index with one-line descriptions.

---

## Relation to E011

E011 (Desktop Shell) will add `app_launcher_view`, desktop icon layer, folder views — at least 6–8 new files. If we restructure first, they land in `app/apps/` and `app/desktop/` cleanly. If after, we move E011 files immediately post-merge — doable but noisy.

**Recommendation:** do SPK03 on a dedicated branch before E011 starts. Pure file moves + cmake refactor, zero logic change, easy to review.

---

## Acceptance Criteria

- AC-1: All 123 files assigned to a subdirectory (analyst findings doc)
- AC-2: `cmake --build ./build --target wwdos` passes with new structure
- AC-3: All existing ctests pass unchanged
- AC-4: `app/README.md` updated as a catalogue index with one-line description per group
- AC-5: No logic changes — pure file moves and cmake plumbing only

---

## Open Questions

1. `app/apps/` vs `app/windows/` — everything is a TWindow, but "apps" better conveys intent
2. Does `micropolis_*` (7 files + engine bridge) warrant `app/city/` given the subsystem size?
3. `mech*` (5 files) — `app/apps/` or `app/views/`?
4. `*_test.cpp` files — in-group alongside their subject, or top-level `app/tests/`?
5. Standalone executables (`*_main.cpp`, `simple_tui`, `ansi_viewer`) — keep in `app/` root as entry points?

---

## Non-Goals

- No logic refactoring, no new features, no API changes
- Not a full modularisation to separate installable packages
- Not switching build system
