# S01: Theme Switch and Palette Mapping

## Parent
- Epic: `e003-dark-pastel-theme`
- Feature: `f01-dark-pastel-theme`
- Feature brief: `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/f01-feature-brief.md`

## Objective
Add `dark_pastel` palette mapping and wire a user-facing theme switch path (`light|dark`) while preserving monochrome default.

## Tasks
- [x] Add `dark_pastel` palette mapping in Turbo Vision app palette logic
- [x] Keep monochrome as default fallback path
- [x] Add theme selection control path via command registry/API/MCP
- [x] Add contract coverage for theme state + parity surfaces

## Acceptance Criteria
- [x] **AC-1:** `dark_pastel` render mapping is defined with approved single-blue palette
  - Test: `tools/api_server/venv/bin/python -m pytest -q tests/contract/test_theme_parity.py`
- [x] **AC-2:** Theme switching works through command surfaces without state regressions
  - Test: `tools/api_server/venv/bin/python -m pytest -q tests/contract/test_theme_state_model_contract.py tests/contract/test_state_roundtrip_determinism.py`
- [x] **AC-3:** Monochrome remains unchanged by default
  - Test: defaults asserted in `tests/contract/test_theme_persistence.py::test_default_theme_values`

## Rollback
- Revert theme mapping and switch-path wiring; keep monochrome-only mode.

## Status

Status: `done`
GitHub issue: #38
PR: #42
