# S03: Event-Triggered State Logging

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f01-state-export`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f01-state-export/f01-feature-brief.md`

## Objective

Append state mutation events to NDJSON log with actor attribution for auditability.

## Tasks

- [x] Add append-only NDJSON event logger in controller
- [x] Log window lifecycle/layout/command execution events
- [x] Include actor attribution for command events
- [x] Add event logging contract test

## Acceptance Criteria

- [x] **AC-1:** State mutation events append to NDJSON log
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_state_event_logging.py -q`
- [x] **AC-2:** Command events include actor attribution
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_state_event_logging.py -q`

## Rollback

- Revert controller NDJSON event logging and S03 contract test.

## Status

Status: `done`
GitHub issue: #19
PR: —
