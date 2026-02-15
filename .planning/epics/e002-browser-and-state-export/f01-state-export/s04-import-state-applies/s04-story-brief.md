# S04: Import State Applies to Engine

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f01-state-export`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`

## Objective

Fix regression where `import_state`/`open_workspace` returns success but does not apply imported state to the running app.

## Tasks

- [ ] Update IPC `import_state` to perform actual restore behavior (no validation-only `ok`)
- [ ] Ensure restore path supports current snapshot/workspace payload shape used by save/export
- [ ] Return explicit error when restore cannot be applied
- [ ] Add contract test proving `open_workspace` mutates engine state
- [ ] Run manual smoke save -> close -> open -> verify restored windows

## Acceptance Criteria

- [ ] **AC-1:** `import_state` applies state to engine (not no-op)
  - Test: `uv run --with pytest --with jsonschema --with fastapi pytest tests/contract/test_workspace_open_applies_state.py::test_open_workspace_applies_state -q`
- [ ] **AC-2:** Invalid/unrestorable payload returns error, not false `ok`
  - Test: `uv run --with pytest --with jsonschema --with fastapi pytest tests/contract/test_workspace_open_applies_state.py::test_open_workspace_reports_invalid_payload -q`
- [ ] **AC-3:** Save/open round-trip restores window count and key types for supported classes
  - Test: manual smoke via API (`save_workspace` -> `close_all_windows` -> `open_workspace` -> `GET /state`)

## Rollback

- Revert `import_state` execution path to previous implementation.

## Status

Status: `in-progress`
GitHub issue: #29
PR: #23
