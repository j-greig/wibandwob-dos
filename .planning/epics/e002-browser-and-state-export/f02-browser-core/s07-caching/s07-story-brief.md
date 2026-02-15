# S07: Browser Cache Layer

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f02-browser-core`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f02-browser-core/f02-feature-brief.md`

## Objective

Add URL/options-keyed cache for raw HTML, markdown, and RenderBundle output to reduce repeat fetch cost.

## Tasks

- [x] Implement cache key generation from URL + render options
- [x] Persist raw HTML, markdown, and bundle artifacts under `cache/browser/`
- [x] Return cache hit metadata in response path
- [x] Add tests proving second fetch is served from cache

## Acceptance Criteria

- [x] **AC-1:** Repeated fetch of same key returns cache hit and avoids network path
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_browser_cache.py -q`
- [x] **AC-2:** Cache invalidates when key-affecting options change
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_browser_cache.py -q`

## Rollback

- Revert cache read/write path and route fetches directly to network extraction.

## Status

Status: `done`
GitHub issue: #22
PR: —

