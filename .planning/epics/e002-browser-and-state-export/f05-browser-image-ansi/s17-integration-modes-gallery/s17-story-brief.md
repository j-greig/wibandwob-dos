# S17: Browser Integration for Image Modes and Gallery

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f05-browser-image-ansi`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/f05-feature-brief.md`

## Objective

Integrate S16 backend output into Browser/TUI/API/MCP flows for image modes, gallery behavior, and workspace persistence.

## Tasks

- [x] Wire S16 asset output into browser render flow for `none|key-inline|all-inline|gallery`
- [x] Implement API/MCP mode toggles and ensure command parity with TUI actions
- [x] Integrate gallery synchronization and focused-image behavior
- [x] Persist and restore image mode state through save/open workspace
- [x] Add integration and manual smoke tests from S15 plan

## Acceptance Criteria

- [x] **AC-1:** Mode toggling updates visible output and state consistently across TUI/API/MCP surfaces
  - Test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_modes.py -q` (1 passed on 2026-02-15)
- [x] **AC-2:** Gallery navigation syncs with browser anchors and image focus actions
  - Test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_gallery.py -q` (1 passed on 2026-02-15)
- [x] **AC-3:** Workspace save/open restores previous image mode and gallery-relevant state
  - Test: manual API smoke verified save/open roundtrip with mode persistence and gallery render continuity (`logs/browser/s17-smoke-20260215_182844.md`)
- [x] **AC-4:** Manual mode-cycle smoke passes without crash (`i` across all modes + workspace reopen)
  - Test: manual smoke via `/browser/{id}/set_mode` cycle `none -> key-inline -> all-inline -> gallery`, `/browser/{id}/gallery`, `/workspace/save`, `/workspace/open` (2026-02-15)

## Evidence

- Contract test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_modes.py -q` -> `1 passed`
- Contract test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_gallery.py -q` -> `1 passed`
- Manual smoke log: `logs/browser/s17-smoke-20260215_182844.md`

## Rollback

- Revert S17 integration path and keep S16 backend outputs disabled from user-visible flows.

## Status

Status: `done`
GitHub issue: #31
PR: —
