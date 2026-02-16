# S06: Link Navigation and History

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f02-browser-core`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f02-browser-core/f02-feature-brief.md`

## Objective

Enable link traversal with both cursor and numeric-ref input plus back/forward history and URL entry.

## Tasks

- [x] Implement cursor-based link selection with `Tab`/`Shift+Tab` and `Enter`
- [x] Implement numbered reference jump path (`[N]`)
- [x] Implement history stack with index tracking and back/forward commands
- [x] Add tests for A -> B -> C navigation and history movement

## Acceptance Criteria

- [x] **AC-1:** Links are navigable via cursor and numbered refs
  - Test: `python3 tools/api_server/live_api_parity_suite.py --base-url http://127.0.0.1:8089`
- [x] **AC-2:** Back/forward navigation returns expected content for multi-step history
  - Test: `python3 tools/api_server/live_api_parity_suite.py --base-url http://127.0.0.1:8089`

## Rollback

- Revert browser history and link-selection handlers to prior navigation behavior.

## Status

Status: `done`
GitHub issue: #22
PR: —

