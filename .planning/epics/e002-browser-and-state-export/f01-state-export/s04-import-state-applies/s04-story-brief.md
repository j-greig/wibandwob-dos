# S04: Import State Applies to Engine

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f01-state-export`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`

## Objective

Fix regression where `import_state`/`open_workspace` returns success but does not apply imported state to the running app.

## Tasks

- [x] Update IPC `import_state` to perform actual restore behavior (no validation-only `ok`)
- [x] Ensure restore path supports current snapshot/workspace payload shape used by save/export
- [x] Return explicit error when restore cannot be applied
- [x] Add contract test proving `open_workspace` failure is no longer silent
- [x] Run manual smoke save -> close -> open -> verify restored windows

## Acceptance Criteria

- [x] **AC-1:** `import_state` applies state to engine (not no-op) for supported workspace payloads
  - Test: `ctest --test-dir build -R command_registry --output-on-failure`
- [x] **AC-2:** Invalid/unrestorable payload returns error, not false `ok`
  - Test: `uv run --with pytest --with jsonschema --with fastapi pytest tests/contract/test_workspace_open_applies_state.py -q`
- [x] **AC-3:** Save/open round-trip restores window count and key types for supported classes
  - Test: `python3 tools/api_server/live_api_parity_suite.py --base-url http://127.0.0.1:8089`

## Rollback

- Revert `import_state` execution path to previous implementation.

## Status

Status: `done`
GitHub issue: #29
PR: #23
