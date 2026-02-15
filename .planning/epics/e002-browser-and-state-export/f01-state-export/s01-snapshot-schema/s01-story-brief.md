# S01: Snapshot Schema + Export/Import Command Path

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f01-state-export`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`

## Objective

Deliver the first E002 state-export vertical slice: versioned snapshot schema and command-path support for `export_state` and `import_state`.

## Tasks

- [x] Add `contracts/state/v1/snapshot.schema.json`
- [x] Add IPC command branches for `export_state` and `import_state`
- [x] Add API endpoints `/state/export` and `/state/import`
- [x] Add S01 contract tests

## Acceptance Criteria

- [x] **AC-1:** Snapshot schema exists and validates a canonical example
  - Test: `uv run --with pytest pytest tests/contract/test_state_snapshot_schema.py -q`
- [x] **AC-2:** Export/import command path exists across IPC + API wiring
  - Test: `uv run --with pytest pytest tests/contract/test_state_export_import_commands.py -q`

## Rollback

- Revert snapshot schema file and export/import command path changes.

## Status

Status: `done`
GitHub issue: #17
PR: —
