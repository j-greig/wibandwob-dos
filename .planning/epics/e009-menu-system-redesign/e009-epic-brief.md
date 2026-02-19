---
id: E009
title: Menu System Redesign
status: in-progress
issue: 67
pr: —
depends_on: [E001, E008]
---

# E009 — Menu System Redesign

## Summary

The WibWob-DOS menu system has accumulated significant rot: dead ends, missing window type registrations, command ID collisions, and no compile-time link between menu items and the window type registry. This was surfaced by a Codex audit after the E008 multiplayer work revealed that unregistered window types cause FAIL responses and terminal corruption when synced.

Full audit: `CODEX-ANALYSIS-MENU-AUDIT.md` in repo root.

## Problem

From the Codex menu audit (2026-02-18):

1. **Dead ends** — "New Mechs Grid" has no active handler; ASCII Cam disabled; Zoom/Paint/Animation Studio are placeholder message boxes.
2. **Command ID collisions** — `cmTextEditor = 130` clashes with `cmKeyboardShortcuts = 130`; `cmWibWobChat = 131` clashes with `cmDebugInfo = 131`.
3. **Type fallback masking bugs** — TAsciiImageWindow, ASCII Grid, WibWobTest A/B/C all fall through to `test_pattern` fallback, making them indistinguishable in `get_state` and dangerous for multiplayer sync.
4. **Missing `registerWindow()` call** — `text_editor` windows skip registration, so `create_window type=text_editor` returns no `id`, breaking the ID drift fix from E008.
5. **No registry ↔ menu linkage** — No compile-time or runtime check that menu-spawned windows have unique, matchable, registry-backed type strings.
6. **Missing registry metadata** — No `syncable`, `singleton`, `side_effects`, or `requires` flags; bridge must hardcode internal types.
7. **Gradient subtype loss** — H/V/R/D gradient variants not carried in sync deltas; remote always gets horizontal.

## Goals

- [x] Fix command ID collisions (immediate, low-risk) — done in `1cadee6`
- [x] Remove or stub dead-end menu items — done in `1cadee6`
- [x] Add `registerWindow()` to `text_editor` and any other missing spawn sites — done in `1cadee6`
- [ ] Add `syncable`, `singleton`, `side_effects` flags to `WindowTypeSpec`
- [ ] Ensure every menu-spawned window has a unique, matchable registry entry
- [ ] Add compile-time or runtime assertion: every `cmXxx` window command maps to a registered type
- [ ] Bridge reads `syncable` flag instead of hardcoding `_INTERNAL_TYPES`

## Non-goals

- Full menu UI/UX redesign (layout, groupings)
- New window types
- Workspace save/restore fix (separate concern)

## Acceptance Criteria

- [x] No command ID collisions in `cmXxx` constants
- [x] Dead-end menu items removed or clearly marked as coming-soon stubs
- [x] New tests for menu cleanup (6 static-analysis tests)
- [ ] All window-spawning menu items have a registry spec with a unique matcher
- [ ] `create_window type=text_editor` returns `{"success":true,"id":"wN"}`
- [ ] Bridge `_INTERNAL_TYPES` replaced by reading `syncable=false` from registry
- [ ] Compile-time or runtime assertion: every `cmXxx` window command maps to a registered type

## References

- Codex audit: `CODEX-ANALYSIS-MENU-AUDIT.md`
- Related: E001 (command registry), E008 (multiplayer — surfaced these bugs)
