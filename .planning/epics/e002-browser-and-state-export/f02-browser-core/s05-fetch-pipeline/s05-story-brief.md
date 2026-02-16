# S05: Fetch Pipeline (Readability + Markdownify)

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f02-browser-core`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f02-browser-core/f02-feature-brief.md`

## Objective

Implement Python sidecar fetch and extraction pipeline that returns RenderBundle JSON for browser rendering.

## Tasks

- [x] Add URL fetch path with bounded timeout and error handling
- [x] Add readability extraction and markdown conversion path
- [x] Emit RenderBundle fields: `title`, `markdown`, `links`, `meta`
- [x] Add tests for bundle shape and field presence

## Acceptance Criteria

- [x] **AC-1:** Fetch pipeline returns bundle with required keys for valid URLs
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_browser_fetch_render_bundle.py -q`
- [x] **AC-2:** Pipeline returns non-fatal error payload on fetch/extract failure
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_browser_fetch_render_bundle.py -q`

## Rollback

- Revert Python fetch pipeline wiring and return to previous raw text behavior.

## Status

Status: `done`
GitHub issue: #22
PR: —

