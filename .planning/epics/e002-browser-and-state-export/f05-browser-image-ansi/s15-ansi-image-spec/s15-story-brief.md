# S15: ANSI Image Rendering Spec (Quarter-Pixel Path)

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f05-browser-image-ansi`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f05-browser-image-ansi/f05-feature-brief.md`

## Objective

Specify browser image rendering to ANSI with quarter-pixel-compatible backend behavior, including data contracts, render modes, caching, limits, and testable acceptance criteria for implementation stories.

## Spec Scope

- Backend abstraction for image-to-ANSI conversion (quarter-pixel compatible)
- Browser render modes and user-facing behavior
- Render bundle contract additions for image assets/metadata
- Caching and performance constraints
- Failure handling and safe fallbacks

## Tasks

- [x] Define render modes and behavior matrix
- [x] Define backend adapter contract and conversion inputs/outputs
- [x] Define cache key strategy and invalidation rules
- [x] Define limits/timeouts and fallback behavior
- [x] Define implementation AC/Test checklist for S16/S17

## Render Modes

- `none`: no images rendered in content flow.
- `key-inline`: render hero image plus first `N` meaningful content images.
- `all-inline`: render all eligible images in content flow.
- `gallery`: render image placeholders inline and open/use companion gallery window for full image blocks.

Mode transition:
- Cycle key remains `i` (none -> key-inline -> all-inline -> gallery -> none).
- API/MCP mode toggles must persist in window props and survive workspace save/open.

## Backend and Limits

Adapter contract (`image_to_ansi`):
- Input: source bytes or URL, target width/height (terminal cells), mode, dither strategy, color mode.
- Output: ANSI text block, rendered dimensions, source hash, render duration ms, backend id.

Preferred backend:
- `chafa` path initially (quarter/block glyph compatible output).
- Backend abstraction allows future swappable renderer.

Safety limits:
- Max source bytes per image: `5 MB`.
- Max decoded dimensions before scaling: `4096x4096`.
- Max render width in cells: `120` (unless explicit override).
- Per-image render timeout: `1500 ms`.
- Total image render budget per page load: `4000 ms` (defer remainder/lazy load).

Fallback behavior:
- On fetch/decode/render failure, emit placeholder metadata and continue page render (no hard failure for whole page).

## Contract Additions (Render Bundle)

Each asset entry should include:
- `id`, `source_url`, `alt`, `anchor_index`
- `status`: `ready|deferred|failed|skipped`
- `ansi_block` (optional when ready)
- `render_meta`: `{backend, width_cells, height_cells, duration_ms, cache_hit}`

## Cache Strategy

Cache key components:
- `image_source_hash`
- `mode`
- `width_cells`
- `backend`
- `dither/color options`

Storage:
- Store rendered ANSI blocks and metadata separately from raw page markdown cache.
- Invalidate on mode/width/backend changes.

## Acceptance Criteria

- [x] **AC-1:** Spec defines all image modes and exact expected behavior for each
  - Test: manual review of “Render Modes” section confirms four modes and cycle semantics
- [x] **AC-2:** Spec defines backend adapter input/output contract and numeric safety limits
  - Test: manual review of “Backend and Limits” and “Contract Additions” confirms concrete limits + schema fields
- [x] **AC-3:** Spec defines implementation-ready test plan for S16 (backend) and S17 (integration)
  - Test: execute listed test commands in “Implementation Test Plan” once S16/S17 are implemented

## Implementation Test Plan (for follow-up stories)

S16 backend tests:
- `uv run --with pytest pytest tests/contract/test_browser_image_backend.py -q`
- Validate timeout handling, scaling caps, and fallback status emission.

S17 integration tests:
- `uv run --with pytest pytest tests/contract/test_browser_image_modes.py -q`
- Validate mode switching, cache behavior, gallery linkage, and persistence across workspace save/open.

Manual smoke (S17):
- Open browser window, toggle `i` across all modes, verify visible behavior changes and no crashes.
- Save workspace, restart app/API, reopen workspace, verify previous image mode restored.

## Status

Status: `done`
GitHub issue: #32
PR: —
