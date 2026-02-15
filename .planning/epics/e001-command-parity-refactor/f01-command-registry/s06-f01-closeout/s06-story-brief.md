# S06: F01 Closeout Quality Gates

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Add a guard test against reintroducing hardcoded migrated command lists and close F01 planning state to done.

## Tasks

- [x] Add guard test for migrated API path hardcoded command regression
- [x] Update F01 planning mirrors to done

## Acceptance Criteria

- [x] **AC-1:** Guard test fails if migrated command list is hardcoded again
  - Test: `uv run --with pytest pytest tests/contract/test_no_hardcoded_migrated_command_lists.py::test_no_hardcoded_command_list_in_migrated_api_paths -q`
- [x] **AC-2:** F01 planning status reflects completion
  - Test: `rg -n \"Status: `done`|\\[x\\].*s01|\\[x\\].*s02|\\[x\\].*s03|\\[x\\].*s04|\\[x\\].*s05|\\[x\\].*s06\" .planning/epics/e001-command-parity-refactor/f01-command-registry -S`

## Rollback

- Revert guard test and status transitions.

## Status

Status: `done`
GitHub issue: #8
PR: —
