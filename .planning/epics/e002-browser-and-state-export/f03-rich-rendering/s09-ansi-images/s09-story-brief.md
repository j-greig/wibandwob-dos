# S09: ANSI Image Rendering

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f03-rich-rendering`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/f03-feature-brief.md`

## Objective

Convert selected web images to ANSI blocks (chafa path), support browser image modes, and add lazy rendering.

## Tasks

- [x] Implement image mode behavior (`none`, `key-inline`, `all-inline`, `gallery`)
- [x] Implement chafa conversion adapter and ANSI block insertion
- [x] Implement lazy render strategy near viewport
- [x] Add ANSI block cache keyed by source + width + mode

## Acceptance Criteria

- [x] **AC-1:** Inline image modes render expected ANSI blocks for eligible assets
  - Test: `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`
- [x] **AC-2:** Cached images are reused on repeat scroll/render path
  - Test: `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`

## Rollback

- Revert inline ANSI image rendering and keep browser output text-only.

## Status

Status: `done`
GitHub issue: #21
PR: —

