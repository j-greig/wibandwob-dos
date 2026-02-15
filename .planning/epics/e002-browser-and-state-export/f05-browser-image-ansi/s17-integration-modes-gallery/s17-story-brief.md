# S17: Browser Integration for Image Modes and Gallery

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f05-browser-image-ansi`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/f05-feature-brief.md`

## Objective

Integrate S16 backend output into Browser/TUI/API/MCP flows for image modes, gallery behavior, and workspace persistence.

## Tasks

- [ ] Wire S16 asset output into browser render flow for `none|key-inline|all-inline|gallery`
- [ ] Implement API/MCP mode toggles and ensure command parity with TUI actions
- [ ] Integrate gallery synchronization and focused-image behavior
- [ ] Persist and restore image mode state through save/open workspace
- [ ] Add integration and manual smoke tests from S15 plan

## Acceptance Criteria

- [ ] **AC-1:** Mode toggling updates visible output and state consistently across TUI/API/MCP surfaces
  - Test: `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`
- [ ] **AC-2:** Gallery navigation syncs with browser anchors and image focus actions
  - Test: `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`
- [ ] **AC-3:** Workspace save/open restores previous image mode and gallery-relevant state
  - Test: `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`
- [ ] **AC-4:** Manual mode-cycle smoke passes without crash (`i` across all modes + workspace reopen)
  - Test: manual smoke per S15 implementation plan

## Rollback

- Revert S17 integration path and keep S16 backend outputs disabled from user-visible flows.

## Status

Status: `not-started`
GitHub issue: #31
PR: —
