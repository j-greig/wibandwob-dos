# S02: Workspace Save/Open Persistence Path

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f01-state-export`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`

## Objective

Implement workspace save/open persistence routing through `export_state` and `import_state` command paths.

## Tasks

- [x] Route `save_workspace` through `export_state`
- [x] Route `open_workspace` through `import_state`
- [x] Add S02 workspace persistence path test

## Acceptance Criteria

- [x] **AC-1:** `save_workspace` persists through export command path
  - Test: `uv run --with pytest pytest tests/contract/test_workspace_persistence_path.py -q`
- [x] **AC-2:** `open_workspace` restores through import command path
  - Test: `uv run --with pytest pytest tests/contract/test_workspace_persistence_path.py -q`

## Rollback

- Revert workspace persistence routing and S02 test.

## Status

Status: `done`
GitHub issue: #18
PR: —
