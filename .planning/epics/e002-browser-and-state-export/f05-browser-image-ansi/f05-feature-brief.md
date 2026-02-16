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

- [x] `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/s15-ansi-image-spec/s15-story-brief.md` — define quarter-pixel image rendering spec, contracts, limits, and implementation tests (#32)
- [x] `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/s16-backend-adapter-cache/s16-story-brief.md` — implement backend adapter and cache pipeline for ANSI image blocks (#31)
- [x] `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/s17-integration-modes-gallery/s17-story-brief.md` — implement browser image mode integration and gallery behavior in TUI/API/MCP (#31)

## Acceptance Criteria

- [x] **AC-1:** Image rendering modes and behavior are specified (`none`, `key-inline`, `all-inline`, `gallery`)
  - Test: review `s15-story-brief.md` “Render Modes” section and verify all four modes are defined with triggers and expected output behavior
- [x] **AC-2:** Quarter-pixel backend strategy and safety limits are specified (dimensions, byte caps, timeouts)
  - Test: review `s15-story-brief.md` “Backend and Limits” section and verify concrete numeric limits and fallback behavior are present
- [x] **AC-3:** Follow-up implementation stories are defined with AC/Test traceability
  - Test: feature story list links concrete S16/S17 story briefs and each story references concrete test procedures from S15

## Status

Status: `done`
GitHub issue: #31
PR: —

Non-gating follow-ons tracked as canon `task` issues:
- [x] #35 (browser copy API route) — done/closed
- [x] #33 (screenshot reliability) — done/closed

Closeout snapshot (2026-02-15):
- Completed this pass:
  - screenshot path stabilized to canonical in-process capture artifacts (`.txt`, `.ans`)
  - browser copy API and screenshot reliability follow-ons closed (#35, #33)
  - S17 AC-2 gallery sync/focus assertions reconciled with passing gallery contract test
