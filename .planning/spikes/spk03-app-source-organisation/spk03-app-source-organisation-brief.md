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

## Codex Review

- What the plan gets right:
- The problem statement is real: `app/` root is overloaded, discovery cost is high, and CMake ownership is unclear.
- Doing this as a no-logic move/refactor pass is the right safety boundary.
- Splitting before more feature files land can reduce churn if scope is tightly controlled.

- Where the proposed grouping misses current reality:
- The tree is already partially organized (`paint/`, `llm/`, `micropolis/`, `windows/`, `ui/`, `core/`), so proposing a mostly new taxonomy without centering these existing domains risks a second re-org later.
- `app/views/` as proposed is not coherent. `text_editor_view`, `browser_view`, and `token_tracker_view` are feature windows, not reusable widgets.
- `app/generators/` mixes visual effect engines with full windows (`*_view`) and includes `game_of_life_view`, which is interactive/simulation, not just a passive generator.
- `app/system/` is too broad. Entrypoints (`wwdos_app.cpp`) and infra (`command_registry`, `api_ipc`, `window_type_registry`) should not be forced into one bucket if dependency direction matters.
- Proposed file examples do not match names exactly (`wibwob` vs `wibwob_view`, `token_tracker` vs `token_tracker_view`), which is a warning that classification was not validated against the real list.

- CMake static-lib approach (for this repo state):
- Full per-folder static libs are probably premature for a single monolithic TUI binary with heavy cross-includes and frequent feature iteration.
- You pay extra CMake and link maintenance immediately, while build-speed gains may be marginal unless boundaries are genuinely clean.
- Better first step: keep one `wwdos` target, but split source lists with `target_sources()` by domain CMake files (`app/chat/CMakeLists.txt`, etc.) without creating many libs yet.
- Promote only stable seams to libs now: `micropolis_bridge` already exists; `llm` and maybe `paint` are plausible next candidates.

- "Do it before E011" call:
- Doing a full taxonomy + static-lib conversion before E011 is higher risk than the brief suggests.
- Recommended sequencing: before E011, do a minimal structure pass (move files, include path updates, no new libs). After E011 settles, evaluate whether additional lib boundaries are justified by pain points.
- If E011 is active now, avoid broad moves; rebase pain and merge noise will erase most benefit.

- Turbo Vision / `Uses_*` + static lib gotchas:
- `Uses_*` macros must remain in the translation unit that needs the symbol declarations; moving code across headers/libs can surface missing `Uses_...` includes only at link time.
- Static library link order still matters on some toolchains. If `wwdos_apps` depends on `wwdos_system`, link order and explicit dependencies must be modeled correctly.
- Object files in static libs are only pulled when needed; registration side effects in global constructors can be dropped unexpectedly if nothing references those objects directly.
- Keep an eye on ODR/multiple-definition regressions if shared utility `.cpp` files are accidentally compiled into multiple libs.

- Open questions (recommendations):
- `apps` vs `windows`: choose `apps`. It communicates product intent better; every file being a Turbo Vision window is implementation detail.
- `micropolis_*`: yes, keep it as its own domain (`app/micropolis/` already exists). Expand that instead of inventing `app/city/`.
- `mech*`: keep in `apps/` unless you extract a reusable rendering/widget layer; current names (`mech_window`, `mech_config`, `mech_grid`) look feature-local.
- `*_test.cpp`: keep alongside the feature for now and register in root CMake; only add `app/tests/` if shared test infra grows.
- `*_main.cpp`/standalone executables: keep entrypoints near root (or `app/bin/`) and keep feature implementation files in domain folders.
