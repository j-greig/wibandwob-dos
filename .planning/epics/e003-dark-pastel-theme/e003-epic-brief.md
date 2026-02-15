# E003: Dark Pastel Theme

## Objective

Add a dark pastel theme option for WibWob DOS, preserving monochrome as default while introducing a user-selectable `light|dark|auto` behavior aligned with macOS day/night expectations.

## Source of Truth

- Planning canon: `.planning/README.md`
- Epic brief: this file

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.

## Epic Structure (GitHub-first)

- Epic issue: `#38` (`epic`/`feature` chain)
- Feature briefs: child capability docs under this folder
- Story briefs: merge-sized vertical slices

## Features

- [ ] **F01: Theme Switch + Palette Mapping**
  - Brief: `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/f01-feature-brief.md`

## Theme Direction

Reference palette source:
- `/Users/james/Repos/wibandwob-backrooms-tv/thinking/wibwobtv-color-system.html`

Constraints:
- Single blue accent variant (exclude second blue from first pass)
- Preserve readability for menu/dialog/status/browser surfaces
- Keep monochrome as stable fallback

## Definition of Done (Epic)

- [ ] Theme table supports `monochrome` + `dark_pastel`
- [ ] User can choose `light|dark|auto` mode path
- [ ] `auto` follows OS-style day/night behavior (dusk to dawn equivalent for platform hook)
- [ ] Manual visual smoke set captured for core surfaces
- [ ] No regressions to existing monochrome default behavior

## Status

Status: `not-started`
GitHub issue: #38
PR: —
