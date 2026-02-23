# E013 — Workspace Save/Restore Parity

Status: in-progress
GitHub issue: #83
PR: —

## Problem

Workspace save/restore has lost parity with the live TUI. Windows are serialised with wrong types, missing props, and missing titles. Restoring a saved workspace produces blank or wrong windows.

Evidence from `workspaces/last_workspace_260223_0849.json`:
- ASCII Gallery saved as `type: "test_pattern"` (wrong slug)
- All 14 frame_player windows have `props: {}` — no `path` or `fps` persisted
- All frame_player windows have `title: ""` — filenames lost
- Gallery-specific state (selected tab, focused file) not captured

## Root Causes

1. **Window type registry gaps** — `ascii_gallery` not registered as a serialisable type; serialiser falls back to `test_pattern`.
2. **Missing `getProps()` overrides** — `TFrameFilePlayerView`, `TTextFileView`, `TAsciiGalleryWindow`, and likely others don't return their file path, fps, or other state from `getProps()`.
3. **Missing `setProps()` restore path** — even if props were saved, the restore path doesn't know how to reconstruct windows with those props.
4. **No round-trip test** — no automated test that save→restore→save produces equivalent JSON.

## Scope

### Feature F01 — Window Type Registry Completeness
- [ ] AC-01: Every window type that can be created (menu or API) has a registered type slug in `window_type_registry`
  - Test: registry slug count ≥ number of unique `api_spawn_*` functions
- [ ] AC-02: `ascii_gallery` type registered and serialises correctly
  - Test: save workspace with gallery open → JSON has `type: "ascii_gallery"`

### Feature F02 — Props Serialisation
- [ ] AC-03: `TFrameFilePlayerView::getProps()` returns `{path, fps}`
  - Test: save workspace with frame_player → JSON props contain `path` and `fps`
- [ ] AC-04: `TTextFileView::getProps()` returns `{path}`
  - Test: save workspace with text_view → JSON props contain `path`
- [ ] AC-05: `TGalleryWindow::getProps()` returns `{tab, search, focused}`
  - Test: save workspace with gallery → JSON props contain gallery state
- [ ] AC-06: Audit all window types for missing `getProps()` — fix each
  - Test: contract test comparing live window props vs serialised props

### Feature F03 — Props Restore
- [ ] AC-07: `frame_player` restore creates window with correct file and fps
  - Test: restore workspace JSON with frame_player path → window shows correct animation
- [ ] AC-08: `text_view` restore opens correct file
  - Test: restore workspace JSON with text_view path → window shows correct content
- [ ] AC-09: `ascii_gallery` restore opens with correct tab/search/focus
  - Test: restore gallery workspace → correct tab selected

### Feature F04 — Round-Trip Test
- [ ] AC-10: Automated test: create windows → save → restore → save → compare JSON
  - Test: `ctest` round-trip test produces equivalent workspace JSON (modulo IDs/timestamps)

### Feature F05 — Window Title Persistence
- [ ] AC-11: Window titles serialised from `TWindow::getTitle()` not empty string
  - Test: frame_player with primer file → saved title matches filename
- [ ] AC-12: Restored windows have correct titles
  - Test: restore → all window titles match saved JSON

## Cross-References

- Window spawn audit: `.planning/audits/window-spawn-audit-20260223.md`
- Window type registry: `app/window_type_registry.cpp`
- Workspace save: `app/test_pattern_app.cpp` (search `saveWorkspace`)
- Workspace restore: `app/test_pattern_app.cpp` (search `openWorkspace`)
- Related: E011 (desktop shell), spk-auth-unification (window spawn DRY refactor)

### Feature F06 — Command Surface Parity Audit & Enforcement
The core problem: we add things (window types, menu commands, app launcher entries) piecemeal and they don't propagate to all the surfaces they need to exist on. A new window type needs to be in: window type registry, menu/app launcher, C++ command registry, API server routes, MCP tools (now auto-derived from registry, but still needs the command registered), agent prompt files, and workspace save/restore. We routinely miss 2-3 of these.

- [ ] AC-13: Full audit matrix — every menu command, every window type, every app launcher entry cross-referenced against: C++ command registry, API `/commands` endpoint, MCP tool availability (via `tui_list_commands`), workspace save/restore support, agent prompt documentation
  - Test: script that fetches `/commands`, scrapes menu items from source, scrapes app launcher entries, scrapes window type registry, and reports gaps as failures
- [ ] AC-14: Agent prompt files include `tui_list_commands` and `tui_menu_command` as the primary discovery/execution tools, with no stale hardcoded tool lists
  - Test: grep prompt files for hardcoded `tui_open_*` / `tui_create_*` references that bypass the generic pair
- [ ] AC-15: Checklist-as-code — a runnable script (or `ctest` target) that validates surface parity after any change. Intended to be run by developers (human or AI) after adding a new window type, menu command, or app launcher entry. Checks:
  1. Window type has a registered slug in `window_type_registry`
  2. Window type has `getProps()`/`setProps()` for workspace round-trip
  3. Menu/app launcher command exists in C++ command registry (`get_command_capabilities()`)
  4. Command is reachable via API (`/commands` lists it)
  5. Command is reachable via MCP (`tui_list_commands` returns it)
  6. Agent prompt files don't hardcode tool names that should go through `tui_menu_command`
  - Test: the script itself exits 0 on a clean repo, exits non-zero on a repo with a known-missing registration (synthetic test)
- [ ] AC-16: CONTRIBUTING.md or CLAUDE.md section documenting the "add a new window/command" checklist for both human and AI developers
  - Test: section exists and references the parity check script

## Effort Estimate

Large. Two distinct work streams:
1. **Serialisation parity** (F01–F05): touches every view class, type registry, save/restore paths. Medium effort. Slice F01+F02 first, then F03, then F04+F05.
2. **Surface parity audit & enforcement** (F06): builds the audit tooling and checklist-as-code that prevents future drift. Medium effort but high leverage — pays back every time we add a feature. Slice AC-13 (audit) first to size the gap, then AC-15 (script), then AC-14+AC-16 (docs).
