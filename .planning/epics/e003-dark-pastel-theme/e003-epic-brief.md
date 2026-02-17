---
id: E003
title: Dark Pastel Theme
status: done
issue: 38
pr: 42
depends_on: []
---

# E003: Dark Pastel Theme

## Objective

Add a dark pastel theme option for WibWob DOS, preserving monochrome as default while introducing a user-selectable `light|dark` behavior across registry, API, and MCP surfaces.

## Source of Truth

- Planning canon: `.planning/README.md`
- Epic brief: this file

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.

## Epic Structure (GitHub-first)

- Epic issue: `#38` (`epic`/`feature` chain)
- Feature briefs: child capability docs under this folder
- Story briefs: merge-sized vertical slices

## Features

- [x] **F01: Theme Switch + Palette Mapping**
  - Brief: `.planning/epics/e003-dark-pastel-theme/f01-dark-pastel-theme/f01-feature-brief.md`

## Theme Direction

Reference palette source:
- `/Users/james/Repos/wibandwob-backrooms-tv/thinking/wibwobtv-color-system.html`

Constraints:
- Single blue accent variant (exclude second blue from first pass)
- Preserve readability for menu/dialog/status/browser surfaces
- Keep monochrome as stable fallback

## Definition of Done (Epic)

- [x] Theme table supports `monochrome` + `dark_pastel`
- [x] User can choose `light|dark` mode path
- [-] `auto` follows OS-style day/night behavior (deferred follow-on issue as per https://github.com/j-greig/wibandwob-dos/issues/43)
- [x] Contract/API parity tests captured for core state surfaces
- [x] No regressions to existing monochrome default behavior

## Status

Status: `done`
GitHub issue: #38
PR: #42
