---
id: S16
epic: E031
title: Migrate raw status bars
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S16 — Raw status bars to createStatusBar

## What and why

Convert the remaining six raw status-bar boxes to `createStatusBar` (migrate-only) so status chrome has one owner path (AC-17).

## Acceptance criteria

- [ ] AC-17: Six raw status bars are replaced by `createStatusBar` in listed files.
- [ ] No visual or functional regressions in status text updates.
- [ ] AC-27: smoke affected windows after migration.

## Files to change

- `src/windows/music-player-window.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/scramble-window.ts` (2 status bars)
- `src/windows/markdown-viewer-window.ts`
- `src/windows/backrooms-log-browser-window.ts`

## Tasks

- [ ] T1: Replace each raw status bar constructor with `createStatusBar`.
- [ ] T2: Rewire existing status update call sites to new handles.
- [ ] T3: Verify status rendering in each window.
- [ ] T4: Run smoke + `bun run typecheck`.
