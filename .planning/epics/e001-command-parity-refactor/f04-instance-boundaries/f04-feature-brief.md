# F04: Instance Boundaries

## Parent

- Epic: `e001-command-parity-refactor`
- Epic brief: `.planning/epics/e001-command-parity-refactor/e001-epic-brief.md`

## Objective

Verify local runtime instance isolation so mutations in one instance do not affect another.

## Stories

- [x] `.planning/epics/e001-command-parity-refactor/f04-instance-boundaries/s09-instance-isolation-test/s09-story-brief.md` — add local instance-isolation contract test

## Acceptance Criteria

- [x] **AC-1:** Instance A mutations do not change instance B state
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_instance_isolation.py -q`
- [x] **AC-2:** Isolation contract test is part of test suite
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_instance_isolation.py -q`

## Status

Status: `done`
GitHub issue: #13
PR: —
