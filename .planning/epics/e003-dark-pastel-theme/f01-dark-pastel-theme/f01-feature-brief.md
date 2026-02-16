# F01: Dark Pastel Theme

## Parent
- Epic: `e003-dark-pastel-theme`
- Epic brief: `.planning/epics/e003-dark-pastel-theme/e003-epic-brief.md`

## Objective
Implement a dark pastel theme based on the backrooms TV palette reference and provide a user-facing switch path for `light|dark`.

## Reference Palette
Source:
- `/Users/james/Repos/wibandwob-backrooms-tv/thinking/wibwobtv-color-system.html`

Seed colors (single-blue variant):
- `#000000` (background)
- `#f07f8f` (pink accent)
- `#57c7ff` (blue accent)
- `#b7ff3c` (green accent)
- `#d0d0d0` (text light)
- `#cfcfcf` (text secondary)

Out-of-scope for first pass:
- `#66e0ff` (second blue accent)

## Stories
- [x] `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/s01-theme-switch-and-palette/s01-story-brief.md` — add theme mapping and selection path (#38)

## Acceptance Criteria
- [x] **AC-1:** Theme table supports `monochrome` and `dark_pastel`
  - Test: launch app with each theme and verify startup/no palette corruption
- [x] **AC-2:** Theme state and command surfaces are parity-aligned under `dark_pastel`
  - Test: `tools/api_server/venv/bin/python -m pytest -q tests/contract/test_theme_parity.py tests/contract/test_theme_state_model_contract.py`
- [x] **AC-3:** User can select theme through documented control path
  - Test: `POST /theme/mode`, `POST /theme/variant`, MCP command tools, and registry command dispatch succeed in contract tests

## Status

Status: `done`
GitHub issue: #38
PR: #42
