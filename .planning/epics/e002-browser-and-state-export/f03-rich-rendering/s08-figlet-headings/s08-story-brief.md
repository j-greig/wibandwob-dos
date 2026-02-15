# S08: Figlet Heading Renderer

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f03-rich-rendering`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f03-rich-rendering/f03-feature-brief.md`

## Objective

Render markdown headings using tiered figlet fonts and support runtime mode cycling.

## Tasks

- [x] Implement heading-level font mapping (`H1 big`, `H2 standard`, `H3-5 small`)
- [x] Implement heading mode cycle (`plain`, `figlet_h1`, `figlet_h1_h2`, `figlet_all`)
- [x] Add width fallback behavior when figlet output overflows viewport
- [x] Add tests for mapping and mode toggles

## Acceptance Criteria

- [x] **AC-1:** Heading levels render in mapped figlet styles when figlet modes enabled
  - Test: `uv run --with pytest pytest tests/contract/test_browser_figlet_modes.py -q`
- [x] **AC-2:** Mode cycling changes render output deterministically
  - Test: `uv run --with pytest pytest tests/contract/test_browser_figlet_modes.py -q`

## Rollback

- Revert figlet transform pass and fall back to plain heading rendering.

## Status

Status: `done`
GitHub issue: #21
PR: —

