# F05: Browser Image Rendering to ANSI

## Parent

- Epic: `e002-browser-and-state-export`
- Epic brief: `.planning/epics/e002-browser-and-state-export/e002-epic-brief.md`

## Objective

Add deterministic image rendering for browser pages in terminal output, with quarter-pixel-friendly output modes, bounded performance, and explicit UX controls.

## Why

- Browser text is usable today; image support is the next major readability step.
- ANSI-native image rendering keeps the local-first terminal architecture intact.
- Explicit modes (`none`, `key-inline`, `all-inline`, `gallery`) keep control in user hands.

## Stories

- [x] `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/s15-ansi-image-spec/s15-story-brief.md` — define quarter-pixel image rendering spec, contracts, limits, and implementation tests
- [ ] `S16` (to be created): implement backend adapter and cache pipeline for ANSI image blocks
- [ ] `S17` (to be created): implement browser image mode integration and gallery behavior in TUI/API/MCP

## Acceptance Criteria

- [x] **AC-1:** Image rendering modes and behavior are specified (`none`, `key-inline`, `all-inline`, `gallery`)
  - Test: review `s15-story-brief.md` “Render Modes” section and verify all four modes are defined with triggers and expected output behavior
- [x] **AC-2:** Quarter-pixel backend strategy and safety limits are specified (dimensions, byte caps, timeouts)
  - Test: review `s15-story-brief.md` “Backend and Limits” section and verify concrete numeric limits and fallback behavior are present
- [x] **AC-3:** Follow-up implementation stories are defined with AC/Test traceability
  - Test: feature story list includes S16/S17 placeholders and each future story requirement references concrete test procedures in S15

## Status

Status: `in-progress`
GitHub issue: #31
PR: —
