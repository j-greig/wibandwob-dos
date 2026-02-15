# S09: Local Instance-Isolation Contract Test

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f04-instance-boundaries`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f04-instance-boundaries/f04-feature-brief.md`

## Objective

Add a contract test proving that separate local controller instances keep state and events isolated.

## Tasks

- [x] Add two-instance isolation contract test
- [x] Verify mutations in one instance do not leak to the other
- [x] Verify event emissions remain isolated per instance

## Acceptance Criteria

- [x] **AC-1:** Mutations in instance A do not appear in instance B
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_instance_isolation.py -q`
- [x] **AC-2:** Isolation test passes in contract suite
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_instance_isolation.py -q`

## Rollback

- Revert instance-isolation test and planning updates.

## Status

Status: `done`
GitHub issue: #14
PR: —
