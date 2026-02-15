# S10: Gallery Window Companion View

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f03-rich-rendering`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/f03-feature-brief.md`

## Objective

Add a companion gallery window for image browsing with bidirectional sync to browser content anchors.

## Tasks

- [x] Implement gallery TView and toggle behavior
- [x] Implement browser-scroll to gallery-highlight sync
- [x] Implement gallery selection jump to browser image anchors
- [x] Add tests for sync and focus behavior

## Acceptance Criteria

- [x] **AC-1:** Gallery reflects current browser image context as user scrolls
  - Test: `uv run --with pytest pytest tests/contract/test_browser_gallery_sync.py -q`
- [x] **AC-2:** Selecting a gallery item jumps browser to corresponding anchor
  - Test: `uv run --with pytest pytest tests/contract/test_browser_gallery_sync.py -q`

## Rollback

- Revert gallery companion view and keep single-window browser rendering.

## Status

Status: `done`
GitHub issue: #21
PR: —

