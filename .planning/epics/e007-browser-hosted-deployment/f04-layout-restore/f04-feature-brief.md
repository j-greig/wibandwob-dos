# F04: Layout Restore

## Parent

- Epic: `e007-browser-hosted-deployment`
- Epic brief: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`

## Objective

WibWob-DOS reads a layout file on startup and restores a curated window arrangement. This is the "room experience" — visitor lands in a pre-arranged desktop, not an empty one. Uses existing `loadWorkspaceFromFile()` wired via `WIBWOB_LAYOUT_PATH` env var.

## Scope

**In:**
- Wire `WIBWOB_LAYOUT_PATH` env var to call `loadWorkspaceFromFile()` at startup
- Workspace JSON format documented (already exists, needs docs)
- Save-workspace command exports layout that restore can round-trip
- Orchestrator sets WIBWOB_LAYOUT_PATH from room config (F01 field)

**Out:**
- Read-only mode for visitors (they can rearrange for now)
- Layout diffing or merge

## Stories

- [ ] `s07-env-layout-restore` — read WIBWOB_LAYOUT_PATH at startup, restore layout
- [ ] `s08-workspace-roundtrip` — verify save then restore produces same window arrangement

## Acceptance Criteria

- [ ] **AC-1:** Setting WIBWOB_LAYOUT_PATH to a valid workspace JSON restores that layout on startup
  - Test: save a layout, set env var, restart, verify windows match
- [ ] **AC-2:** Missing or invalid layout path logs warning and starts with default desktop
  - Test: set env var to nonexistent path, app starts normally with warning in stderr
- [ ] **AC-3:** Workspace save/restore round-trips — save, restore, save again produces identical JSON
  - Test: diff the two saved files

## Status

Status: not-started
GitHub issue: —
PR: —
