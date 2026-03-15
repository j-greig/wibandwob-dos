> **E042 Solid Foundations** — Slice 10 of 10
> ← Previous: [`e42-S09` Stability Annotations](../e42-S09/autoresearch.md)
> Planning: `.planning/epics/e042-solid-foundations/e042-slices-7-10.md`
> Related: WibMux MVP at `/Users/james/Repos/wibandwob-dos-wibmux/autoresearch/wibmux/wibmux.sh`

# Autoresearch: E042-S10 — File-Manager Microapp Migration

## Objective

Move `src/windows/file-manager-window.ts` (1623 lines) to `microapps/file-manager/`,
completing hero app #7. This is the largest migration — a full Finder-style file
manager with browse/search/filter, icon/list view modes, and preview pane.

## Metrics

- **Primary**: `hero_pass_count` (count out of 7, higher is better) — hero apps with
  both `describeState` and `captureText` in microapps/. Target: 7.
- **Secondary**:
  - `fm_in_src` — 1 if file-manager-window.ts still exists in src/windows/, 0 if removed
  - `fm_lines` — line count of microapps/file-manager/index.ts
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Change |
|------|--------|
| `src/windows/file-manager-window.ts` | Source — move to microapp, then delete |
| `microapps/file-manager/microapp.json` | New — manifest |
| `microapps/file-manager/index.ts` | New — migrated window code |
| `src/core/microapp-registry.ts` | Register `wibwob.file-manager` |
| `src/core/app-controller.ts` | Remove direct file-manager-window import, use microapp command |
| `src/core/command-catalog.ts` | Update file-manager command if needed |
| `docs/microapp-examples.md` | Update hero #7 — no longer "migration pending" |
| `PHILOSOPHY.md` | Update §6 hero status |

## Off Limits

- Rewriting file-manager functionality (move only, fix imports)
- Changing other microapps
- Breaking workspace restore (file-manager may be in saved workspaces)

## Constraints

- `bun run health` must pass
- File-manager must open via API and return valid describeState
- File-manager must have captureText
- Backward compat: `wibwob run "file-manager.open"` or equivalent must work
- Workspace restore must still restore file-manager windows

## What's Been Tried

_Nothing yet — depends on S07–S09._
