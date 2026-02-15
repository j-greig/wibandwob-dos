# F01: Dark Pastel Theme

## Parent
- Epic: `e003-dark-pastel-theme`
- Epic brief: `.planning/epics/e003-dark-pastel-theme/e003-epic-brief.md`

## Objective
Implement a dark pastel theme based on the backrooms TV palette reference and provide a user-facing switch path.

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
- [ ] `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/s01-theme-switch-and-palette/s01-story-brief.md` — add theme mapping and selection path (#38)

## Acceptance Criteria
- [ ] **AC-1:** Theme table supports `monochrome` and `dark_pastel`
  - Test: launch app with each theme and verify startup/no palette corruption
- [ ] **AC-2:** Core UI surfaces are legible under `dark_pastel`
  - Test: capture menu/dialog/status/browser screenshots in dark pastel mode
- [ ] **AC-3:** User can select theme through documented control path
  - Test: switch theme at runtime/startup and verify visible change

## Status

Status: `not-started`
GitHub issue: #38
PR: —
