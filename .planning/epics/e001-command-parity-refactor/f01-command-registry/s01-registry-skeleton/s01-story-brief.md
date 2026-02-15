# S01: Registry Skeleton + First Capability-Driven Path

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Deliver the first vertical slice proving parity direction: add a command/capability registry skeleton in C++, wire one API/MCP path to it, and add baseline parity/schema/snapshot-event tests.

## Tasks

- [x] Add C++ registry skeleton and integration point for existing command handling
- [x] Expose capability data through one non-breaking IPC/API path
- [x] Migrate one hardcoded API/MCP command list path to capability-driven flow
- [x] Add one parity test (menu/capability consistency for migrated path)
- [x] Add one schema validation test
- [x] Add one snapshot/event sanity test
- [x] Update architecture/migration docs for source-of-truth direction

## Acceptance Criteria

- [x] **AC-1:** Migrated path uses canonical registry/capability source
  - Test: `uv run python tools/api_server/test_registry_dispatch.py`
- [x] **AC-2:** Capability payload validates against schema
  - Test: `uv run pytest tests/contract/test_capabilities_schema.py::test_registry_capabilities_payload_validates`
- [x] **AC-3:** Parity check passes for migrated command set
  - Test: `uv run pytest tests/contract/test_parity_drift.py::test_menu_vs_capabilities_parity`
- [x] **AC-4:** Snapshot/event sanity is preserved for migrated path
  - Test: `uv run pytest tests/contract/test_snapshot_event_sanity.py::test_snapshot_round_trip_and_event_emission`

## Rollback

- Revert registry integration commits for migrated path
- Restore previous hardcoded path if critical regression appears

## Status

Status: `done`
GitHub issue: #2
PR: —
