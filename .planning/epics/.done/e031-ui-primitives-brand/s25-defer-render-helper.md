---
id: S25
epic: E031
title: deferRender helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S25 — deferRender(fn) helper

## What and why

Replace ambiguous `setTimeout(..., 0)` preview defers with a named `deferRender(fn)` helper so intent is explicit and magic numbers are centralized (AC-30).

## Acceptance criteria

- [ ] AC-30: Shared `deferRender(fn)` helper exists in core owner path.
- [ ] Three `setTimeout(..., 0)` calls in target windows are replaced.
- [ ] Deferred preview/content updates still render correctly.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- Helper file in core UI utility owner (implementation choice)
- `src/windows/content-windows.ts`
- `src/windows/backrooms-windows.ts`

## Tasks

- [ ] T1: Add `deferRender(fn)` helper with existing behavior.
- [ ] T2: Replace targeted `setTimeout(0)` usage with helper.
- [ ] T3: Smoke preview update timing after list selection.
- [ ] T4: Run `bun run typecheck`.
