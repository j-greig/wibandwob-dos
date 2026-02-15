# S08: Actor Attribution for Canonical Command Execution

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f03-state-event-authority`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f03-state-event-authority/f03-feature-brief.md`

## Objective

Add actor attribution to canonical command execution and emitted command events for migrated API/MCP paths.

## Tasks

- [x] Extend API menu command schema with optional actor
- [x] Extend controller canonical exec path to carry actor
- [x] Emit actor in `command.executed` event payload
- [x] Add actor attribution test coverage

## Acceptance Criteria

- [x] **AC-1:** `command.executed` event includes actor attribution
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_actor_attribution.py -q`
- [x] **AC-2:** API/MCP canonical exec path carries actor (explicit or default)
  - Test: `uv run --with fastapi python tools/api_server/test_registry_dispatch.py`

## Rollback

- Revert actor field additions and event payload changes.

## Status

Status: `done`
GitHub issue: #12
PR: —
