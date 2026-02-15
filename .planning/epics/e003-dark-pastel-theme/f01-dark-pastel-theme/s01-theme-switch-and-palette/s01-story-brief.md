# S01: Theme Switch and Palette Mapping

## Parent
- Epic: `e003-dark-pastel-theme`
- Feature: `f01-dark-pastel-theme`
- Feature brief: `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/f01-feature-brief.md`

## Objective
Add `dark_pastel` palette mapping and wire a user-facing theme switch path while preserving monochrome default.

## Tasks
- [ ] Add `dark_pastel` palette mapping in Turbo Vision app palette logic
- [ ] Keep monochrome as default fallback path
- [ ] Add theme selection control path (menu command and/or startup option)
- [ ] Add/refresh manual smoke captures for menu/dialog/status/browser windows

## Acceptance Criteria
- [ ] **AC-1:** `dark_pastel` renders with approved single-blue palette
  - Test: visual smoke captures confirm palette values and readability
- [ ] **AC-2:** Theme switching works without restart regressions
  - Test: switch theme control path and verify immediate UI update (or documented restart requirement)
- [ ] **AC-3:** Monochrome remains unchanged by default
  - Test: run app without override and verify previous monochrome appearance

## Rollback
- Revert theme mapping and switch-path wiring; keep monochrome-only mode.

## Status

Status: `not-started`
GitHub issue: #38
PR: —
