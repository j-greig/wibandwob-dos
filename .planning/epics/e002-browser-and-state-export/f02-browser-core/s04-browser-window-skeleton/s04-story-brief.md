# S04: BrowserWindow Skeleton

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f02-browser-core`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f02-browser-core/f02-feature-brief.md`

## Objective

Implement the C++ `BrowserWindow` shell (URL/status/content panes, keybindings, and basic command wiring) as the browser runtime anchor.

## Tasks

- [x] Add `BrowserWindow` TView subclass with URL bar, status line, and scrollable content pane
- [x] Register browser window type and creation path through canonical command dispatch
- [x] Add core keybinding scaffolding (`Enter`, `b`, `f`, `r`, `/`, `g`, `o`, `Tab`, `Shift+Tab`)
- [x] Add minimal state serialization fields for browser window props

## Acceptance Criteria

- [x] **AC-1:** `browser.open(url)` creates a browser-type window with URL and content surfaces
  - Test: `ctest --test-dir build -R command_registry --output-on-failure`
- [x] **AC-2:** Browser keybinding handlers are registered and callable without crash
  - Test: manual TUI smoke in local app session

## Rollback

- Revert browser window registration and restore previous non-browser window creation flow.

## Status

Status: `done`
GitHub issue: #22
PR: —
