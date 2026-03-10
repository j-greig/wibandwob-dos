---
id: S27
epic: E031
title: applyInitialPos helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S27 — applyInitialPos helper

## What and why

Extract duplicated initial position restore block into one helper and use it in both current call sites (AC-32).

## Acceptance criteria

- [ ] AC-32: Shared `applyInitialPos(frame, pos)` helper exists.
- [ ] Duplicate restore blocks in `wibwob-agent-window.ts` and `scramble-window.ts` are replaced.
- [ ] Initial geometry restore behavior is unchanged.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- Helper location in core/window utilities (implementation choice)
- `src/windows/wibwob-agent-window.ts`
- `src/windows/scramble-window.ts`

## Tasks

- [ ] T1: Add helper that assigns top/left/width/height safely.
- [ ] T2: Replace both duplicate restore code blocks with helper call.
- [ ] T3: Smoke restore/open flow for both windows.
- [ ] T4: Run `bun run typecheck`.
