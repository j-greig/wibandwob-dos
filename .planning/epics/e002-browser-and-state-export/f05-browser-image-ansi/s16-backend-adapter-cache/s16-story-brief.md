# S16: ANSI Image Backend Adapter and Cache

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f05-browser-image-ansi`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/f05-feature-brief.md`

## Objective

Implement the image-to-ANSI backend adapter and cache pipeline defined by S15, including limits and failure fallback behavior.

## Tasks

- [x] Implement `image_to_ansi` adapter interface and chafa-backed default implementation
- [x] Enforce S15 safety limits (bytes, dimensions, timeout, page render budget)
- [x] Implement render cache with S15 key strategy and invalidation rules
- [x] Emit asset `status` and `render_meta` fields for ready/deferred/failed/skipped outcomes
- [ ] Add backend-focused contract tests

## Acceptance Criteria

- [~] **AC-1:** Backend returns ANSI blocks and metadata for valid images within configured limits
  - Test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_backend.py -q` (currently failing on branch; see Evidence)
- [~] **AC-2:** Timeout/oversize/error inputs degrade to placeholder metadata without page-fatal errors
  - Test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_backend.py -q` (currently failing on branch; see Evidence)
- [~] **AC-3:** Cache returns repeat renders without duplicate conversion work for same key
  - Test: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_backend.py -q` (currently failing on branch; see Evidence)

## Evidence

- Contract run: `./tools/api_server/venv/bin/python -m pytest tests/contract/test_browser_image_backend.py -q`
- Current result on 2026-02-15: `3 failed`
- Failure pattern: test mock `_Resp` object lacks `.headers` expected by updated edge-markdown fetch path in `tools/api_server/browser_pipeline.py`

## Rollback

- Disable adapter path and return to text-only browser asset behavior.

## Status

Status: `in-progress`
GitHub issue: #31
PR: —
