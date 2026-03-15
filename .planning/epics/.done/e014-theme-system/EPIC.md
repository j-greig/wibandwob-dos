---
id: E014
title: Theme System
status: done
issue: ~
pr: ~
depends_on: []
---

# E014 — Theme System

Full theme system with live switching across all surfaces.

## Status: LANDED

## Definitions

- **theme token**: a semantic colour role (e.g. `body`, `header`, `selected`) resolved at runtime
- **variant**: a named set of token values (dark, dark-nord, dark-pastel, phosphor, light)
- **fleet test**: opening one of every window kind and toggling through all variants
- **surface**: any visible UI element — menu bar, dropdown, popup, window, status line

## Done

- [x] Theme types, resolver, appearance service
- [x] All inline colour literals replaced with `theme()` calls in window factories
- [x] `onRestyle` hook on all window types
- [x] `safeSetStyle` helper (preserves blessed scrollbar/item sub-styles)
- [x] Live toggle via Alt+T / View menu / command palette / API
- [x] Five variants: dark, dark-nord, dark-pastel, phosphor, light
- [x] Cycle order: dark → nord → pastel → phosphor → light → dark
- [x] Error handling in control API commands/run endpoint
- [x] Menu bar/dropdown/context menus themed (no more hardcoded colours)
- [x] Menu bar vs desktop contrast in all variants
- [x] Theme file split: `src/core/theme/` with types, resolver, variants/
- [x] Phosphor theme in `microapps-private/wibwob-themes/variants/`
- [x] Fleet audit: 12 window kinds x 5 themes, screenshots in scratch/
- [x] Theme picker: `Choose Theme...` via View menu / palette / API
- [x] `app.set_theme` API command: set theme by name without interactive picker
- [x] Workspace theme persistence: v2 envelope `{version:2, theme, windows}`, backward compat
- [x] Themed overlay prompts (value prompt, path prompt)
- [x] App-owned window shadows, themed via `windowShadow` token
- [x] Desktop fill char system, themed via `desktopFillChar` token
- [x] Unfocused title bar contrast fixed in dark variant
- [x] Status bar shows active theme name
- [x] Fleet test script: `scripts/fleet-test.sh`

## Theme Parity — Surface Audit

All surfaces verified across 5 themes via fleet audit (35 windows x 5 themes).

- [x] Shell chrome (menu bar, dropdowns, context menus, status line)
- [x] Window chrome (close button, title bar focused/unfocused)
- [x] All 15 window kinds verified: primer, browser, gallery, editor, figlet, art, pattern, companion, workspace, palette, inspector, backrooms, backrooms-log, chrome-browser, wibwob-agent

## Remaining Follow-ons

- [x] Theme in `/state` endpoint — expose active theme name in desktop state JSON
- [ ] User-defined themes (load variant from JSON/YAML file)
- [ ] `appearance-service.ts` integration (system/light/dark auto-detection)
- [ ] More variants (Dracula, Solarized, Gruvbox, Tokyo Night)
