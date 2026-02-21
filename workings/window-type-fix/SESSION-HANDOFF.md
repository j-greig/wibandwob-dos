# Session Handoff — 2026-02-21 17:30 GMT

## What Was Done This Session

### Mission 1 (window type bug) — DONE
- Root cause: Python `WindowType` enum had 8/24 C++ types, silent coercion to `test_pattern`
- Superseded by Mission 2's systemic fix

### Mission 2 (systemic architecture audit) — DONE  
- Expanded Python `WindowType` enum: 8 → 26 values
- Fixed `WindowCreate` schema: removed duplicate, added all spawnable types
- Added C++ `get_window_types` IPC command — Python auto-derives from C++ at runtime
- Fixed `Controller.create_window()` — now sends ALL types to C++ IPC (was only 5)
- Fixed `terminal_read` MCP handler response field
- Added 15 missing MCP tool builders for full command coverage
- Created auto-derived parity tests (8 tests, all green)
- Deduplicated CLAUDE.md / AGENTS.md docs
- 7 clean commits on main

### Additional fixes
- `fix(ui)`: macOS `say` TTS command was interpreting `--` in response text as options

### Missions written but not started
- **Mission 3**: Full stack smoke test (open all window types, test all commands)
- **Mission 4**: API connection status indicator in TUI menu bar
- **Mission 5**: Auto-derive Wib&Wob embedded agent tools from C++ registry

## Next Session Priority Order

1. **Mission 3** — smoke test everything works post-refactor
2. **Mission 5** — Node MCP tool parity (agent inside TUI only has 5/24 window types, 8/25 tools)
3. **Mission 4** — API status indicator in menu bar (nice-to-have)

## How to Continue

```bash
cd /Users/james/Repos/wibandwob-dos
cat workings/window-type-fix/MISSION3.md  # Read first todo task, execute it
```

TUI: `./build/app/test_pattern 2>/tmp/wibwob_debug.log`
API: `./start_api_server.sh`  
Tests: `uv run --with pytest --with-requirements tools/api_server/requirements.txt pytest tests/contract/ -v`

## Key Files Changed

- `app/window_type_registry.{h,cpp}` — added `get_window_types_json()`
- `app/api_ipc.cpp` — wired `get_window_types` IPC command
- `app/test_pattern_app.cpp` — cleaned `windowTypeName()` debug logging
- `app/wibwob_view.cpp` — fixed `say` TTS option parsing
- `tools/api_server/models.py` — expanded `WindowType` enum
- `tools/api_server/schemas.py` — expanded `WindowCreate` Literal
- `tools/api_server/controller.py` — unified create_window dispatch, capabilities from C++
- `tools/api_server/mcp_tools.py` — added 15 MCP tool builders
- `tests/contract/test_window_type_parity.py` — NEW: 5 auto-derived tests
- `tests/contract/test_surface_parity_matrix.py` — REWRITTEN: 3 auto-derived tests
- `CLAUDE.md` — parity enforcement section with checklists
- `AGENTS.md` — deduped ANSI guardrail
