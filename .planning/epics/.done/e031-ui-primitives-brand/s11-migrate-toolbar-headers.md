---
id: S11
epic: E031
title: Migrate toolbar/header boxes
status: done
branch: epic/e031-ui-primitives-brand
---

# S11 — Migrate raw toolbar/header boxes

## What and why

Migrate raw toolbar/header blessed boxes to `createHeaderBar` (and SDK paths) so top/bottom chrome follows one rendering/restyle owner (AC-12).

## Acceptance criteria

- [ ] AC-12: Target toolbar/header boxes are replaced with `createHeaderBar`.
- [ ] sy2-chronicles imports `createButtonBar` via SDK (no direct core path).
- [ ] Toolbar visuals and actions remain unchanged after migration.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/windows/content-windows.ts` (tab bar + filter bar)
- `src/windows/backrooms-windows.ts`
- `src/windows/chrome-browser-window.ts`
- `src/windows/music-player-window.ts`
- `modules/sy2-chronicles/*` (SDK import path fix)

## Tasks

- [ ] T1: Replace raw toolbar/header `blessed.box` usage with `createHeaderBar`.
- [ ] T2: Update sy2-chronicles button bar imports to SDK path.
- [ ] T3: Verify restyle + layout parity for each header.
- [ ] T4: Run smoke + `bun run typecheck`.
