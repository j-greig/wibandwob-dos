---
id: E005
title: Theme Runtime Wiring
status: not-started
issue: 43
pr: ~
depends_on: [E003]
---

# E005: Theme Runtime Wiring

> tl;dr — E003 shipped ThemeManager lookup table + API/IPC routing but C++ handlers are stubs (`(void)app; return "ok"`). Wire theme state into C++ app class, make set_theme_mode/variant store state + apply colours + repaint. `get_state` must reflect actual values. Optional: auto mode (dusk/dawn).

## Objective

Complete the theme system by wiring `ThemeManager` colour lookups into the C++ TUI runtime. E003 delivered the palette data layer, API endpoints, and IPC routing — but the IPC handlers return `"ok"` without storing state or repainting. This epic closes the gap so theme changes are visible and persistent.

## Source of Truth

- Planning canon: `.planning/README.md`
- Epic brief: this file
- Predecessor: [E003 epic brief](.planning/epics/e003-dark-pastel-theme/e003-epic-brief.md)

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.

## GitHub Links

| Item | Link |
|------|------|
| Predecessor issue (closed) | [#38](https://github.com/j-greig/wibandwob-dos/issues/38) — FR: add dark pastel color scheme |
| Predecessor PR (merged) | [PR #42](https://github.com/j-greig/wibandwob-dos/pull/42) — feat(theme): add light/dark theme system |
| Existing follow-on (open) | [#43](https://github.com/j-greig/wibandwob-dos/issues/43) — FR follow-on: theme auto mode and live repaint |
| Merge commit | `8c9a70a` |

## Problem Statement

PR #42 was marked done with ACs ticked, but the C++ IPC handlers are no-ops. The API returns `{"ok":true}` for theme commands but no state is stored, no colours are applied, and `get_state` returns hardcoded defaults. Theme switching does not work.

## Gap Analysis (E003 delivered vs E005 needed)

| Layer | E003 status | E005 work needed |
|-------|------------|------------------|
| `ThemeManager` colour lookup | Done — `app/theme_manager.h` / `.cpp` | None |
| API endpoints (`/theme/*`) | Done — `tools/api_server/main.py:305-323` | None |
| MCP tools | Done — `tools/api_server/mcp_tools.py:214-220` | None |
| Python controller | Done — `tools/api_server/controller.py:486-492` | None |
| Python state model | Done — `tools/api_server/models.py:43-44` (defaults `"light"/"monochrome"`) | None |
| Pydantic schemas | Done — `tools/api_server/schemas.py:161-162` | None |
| Contract schema | Done — `contracts/state/v1/snapshot.schema.json` has `theme_mode`/`theme_variant` | None |
| Command registry entries | Done — `app/command_registry.cpp:27-29` | None |
| Command registry dispatch | Done — `app/command_registry.cpp:104-117` calls `api_set_theme_*` | None |
| **IPC handlers (C++ impl)** | **Stubs** — `app/test_pattern_app.cpp:2748-2765` | **Wire to app state** |
| **App state storage** | **Missing** — `TTestPatternApp` (line 534) has no theme members | **Add `ThemeMode`/`ThemeVariant` members** |
| **`get_state` JSON output** | **Missing** — `api_get_state` (line 2008) emits only `windows` array | **Add `theme_mode`/`theme_variant` fields** |
| **Surface application** | **Missing** — no draw calls reference `ThemeManager` | **Apply to desktop bg, frames, menus, status** |
| **Repaint on change** | **Missing** | **Trigger `redraw()` after state mutation** |
| **Snapshot round-trip** | Schema fields exist but C++ never populates them | **Emit/consume in export/import** |
| Auto mode (dusk/dawn) | Deferred per E003 | Stretch goal |

## Key Files (for implementing agent)

### C++ (where the work is)

| File | What's there | What to change |
|------|-------------|----------------|
| `app/test_pattern_app.cpp:534` | `TTestPatternApp` class definition | Add `ThemeMode currentThemeMode` + `ThemeVariant currentThemeVariant` members |
| `app/test_pattern_app.cpp:2748-2765` | Stub IPC handlers: `api_set_theme_mode`, `api_set_theme_variant`, `api_reset_theme` | Store values on `app`, call `ThemeManager::getColor()`, trigger repaint |
| `app/test_pattern_app.cpp:2008-2051` | `api_get_state` — builds JSON with `windows` only | Add `"theme_mode":"<val>","theme_variant":"<val>"` to output |
| `app/theme_manager.h` | `ThemeMode`, `ThemeVariant` enums; `ThemeManager` static class | No changes needed |
| `app/theme_manager.cpp` | `getColor()`, parse/toString helpers | No changes needed |
| `app/command_registry.cpp:14-16` | `extern` declarations for stub handlers | No changes needed |
| `app/command_registry.cpp:104-117` | Dispatch routing to handlers | No changes needed |

### Python (no changes expected)

| File | Relevance |
|------|-----------|
| `tools/api_server/controller.py:135-136` | Parses `theme_mode`/`theme_variant` from C++ `get_state` JSON — will work once C++ emits them |
| `tools/api_server/controller.py:932-933` | Emits theme fields in snapshot export — reads from `_state` which is populated from C++ |
| `tools/api_server/controller.py:961-962` | Imports theme fields from snapshot payload |
| `tools/api_server/models.py:43-44` | Defaults (`"light"/"monochrome"`) — correct fallback |
| `tools/api_server/main.py:305-323` | `/theme/*` REST endpoints — working, no changes needed |
| `tools/api_server/mcp_tools.py:214-220` | MCP tool registration — working, no changes needed |

### Turbo Vision surface integration notes

Turbo Vision uses `mapColor()` and palette overrides for theming. Key surfaces to integrate:

- **Desktop background**: `TDeskTop` or `TBackground` — override `mapColor` or set palette entries
- **Window frames**: `TFrame` — override `mapColor` in `TWindow` subclass or modify palette
- **Menu bar**: `TCustomMenuBar` (line 218) already has `mapColor` override — extend it
- **Status line**: `TCustomStatusLine` — may need `mapColor` override
- **Dialog boxes**: palette inheritance from `TApplication::getPalette()` (line 541)

The `TTestPatternApp::getPalette()` (line 541) is the master palette — modifying it and calling `redraw()` on the desktop should cascade to all surfaces.

## Features

- [ ] **F01: Theme state storage and IPC wiring** ([#43](https://github.com/j-greig/wibandwob-dos/issues/43))
  - Store `ThemeMode`/`ThemeVariant` on app, make IPC handlers mutate them, emit in `get_state`
- [ ] **F02: Surface colour application and repaint** (issue TBD)
  - Apply `ThemeManager::getColor()` to TUI surfaces, trigger repaint on change

## Acceptance Criteria (Epic-level)

```
AC-1: set_theme_mode stores mode in app; get_state reflects it.
Test: curl -X POST /theme/mode {"mode":"dark"}, then curl /state, assert theme_mode == "dark".

AC-2: set_theme_variant stores variant; get_state reflects it.
Test: curl -X POST /theme/variant {"variant":"dark_pastel"}, then curl /state, assert theme_variant == "dark_pastel".

AC-3: Theme change visibly repaints desktop background, window frames, and status line.
Test: set dark_pastel via API, capture screenshot or visual inspection, verify non-monochrome colours.

AC-4: reset_theme restores monochrome/light defaults.
Test: set dark + dark_pastel, POST /theme/reset, GET /state, assert theme_mode == "light" && theme_variant == "monochrome".

AC-5: Theme state survives snapshot round-trip.
Test: set dark_pastel, POST /state/export, POST /state/import with exported data, GET /state, assert theme fields preserved.

AC-6 (stretch): auto mode resolves to light/dark based on local time.
Test: mock time near dusk, set mode auto, assert resolved mode == dark.
```

## Definition of Done (Epic)

- [ ] IPC handlers store theme state in app (not stubs)
- [ ] `api_get_state` returns actual `theme_mode`/`theme_variant` in JSON
- [ ] `ThemeManager::getColor()` colours applied to core TUI surfaces
- [ ] Repaint triggers on mode/variant change (no restart required)
- [ ] Snapshot round-trip preserves theme state
- [ ] No regressions to monochrome default (app starts as `light`/`monochrome`)
- [ ] Python tests pass (`uv run tools/api_server/test_ipc.py`)
- [-] Auto mode (stretch — promote to F03 if pursued)

## Rollback

Revert IPC handler bodies in `app/test_pattern_app.cpp:2748-2765` to stubs. Remove any new app members. ThemeManager, API endpoints, Python controller, MCP tools, and routing from E003 remain untouched.

## Build & Verify

```bash
# Build
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release && cmake --build ./build

# Run TUI (terminal 1)
./build/app/test_pattern

# Start API (terminal 2)
./start_api_server.sh

# Test theme state wiring (AC-1, AC-2)
curl -s -X POST http://127.0.0.1:8089/theme/mode -H 'Content-Type: application/json' -d '{"mode":"dark"}'
curl -s -X POST http://127.0.0.1:8089/theme/variant -H 'Content-Type: application/json' -d '{"variant":"dark_pastel"}'
curl -s http://127.0.0.1:8089/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('theme_mode'), d.get('theme_variant'))"
# Expected: dark dark_pastel

# Test reset (AC-4)
curl -s -X POST http://127.0.0.1:8089/theme/reset
curl -s http://127.0.0.1:8089/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('theme_mode'), d.get('theme_variant'))"
# Expected: light monochrome

# IPC smoke test
uv run tools/api_server/test_ipc.py
```

## Status

Status: not-started
GitHub issue: [#43](https://github.com/j-greig/wibandwob-dos/issues/43) (to be updated with expanded scope)
PR: TBD
