---
id: S26
epic: E031
title: Close keys helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S26 — bindCloseKeys helper

## What and why

Standardize close-key behavior with a single helper binding both `q` and `Escape` to window close, replacing inconsistent per-window wiring (AC-31).

## Acceptance criteria

- [ ] AC-31: Shared `bindCloseKeys(widget, frame)` helper is implemented and used by target windows.
- [ ] `q` + `Escape` close behavior is consistent across migrated windows.
- [ ] Close path consistently uses approved window-close owner flow.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- Helper file in core/window utility owner (implementation choice)
- `src/windows/markdown-viewer-window.ts`
- `src/windows/backrooms-log-browser-window.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/music-player-window.ts`

## Tasks

- [ ] T1: Implement close-key helper and align close callback semantics.
- [ ] T2: Migrate target windows to helper usage.
- [ ] T3: Smoke q/Escape close behavior in each window.
- [ ] T4: Run `bun run typecheck`.
