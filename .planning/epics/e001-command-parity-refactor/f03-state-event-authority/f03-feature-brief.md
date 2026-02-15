# F03: State/Event Authority

## Parent

- Epic: `e001-command-parity-refactor`
- Epic brief: `.planning/epics/e001-command-parity-refactor/e001-epic-brief.md`

## Objective

Ensure canonical command execution carries actor attribution and emits actor-attributed events.

## Stories

- [x] `.planning/epics/e001-command-parity-refactor/f03-state-event-authority/s08-actor-attribution/s08-story-brief.md` — actor attribution on canonical command execution path

## Acceptance Criteria

- [x] **AC-1:** `command.executed` event includes actor attribution
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_actor_attribution.py -q`
- [x] **AC-2:** API command path accepts actor and defaults safely
  - Test: `uv run --with fastapi python tools/api_server/test_registry_dispatch.py`

## Status

Status: `done`
GitHub issue: #11
PR: —
