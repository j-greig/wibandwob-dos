---
id: S14
epic: E031
title: Focus target on WindowFacade
status: done
branch: epic/e031-ui-primitives-brand
---

# S14 — frame.setFocusTarget(widget) on WindowFacade

## What and why

Add `frame.setFocusTarget(widget)` on the WindowFacade to remove 23 duplicated focus boilerplate blocks and make focus wiring declarative per window (AC-15).

## Acceptance criteria

- [ ] AC-15: `WindowFacade` exposes `setFocusTarget(widget)` and behavior is implemented once in core owner path.
- [ ] All 23 duplicated caller sites migrate to the facade method.
- [ ] Focus behavior remains unchanged for every migrated window.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/window-facade.ts` — add method contract/implementation
- `src/core/window-manager.ts` and/or owner wiring file(s) — support method behavior
- Target window files listed in P02 — migrate call sites

## Tasks

- [ ] T1: Add `setFocusTarget` API to facade and wire through owner path.
- [ ] T2: Migrate all P02 focus boilerplate occurrences to one-line calls.
- [ ] T3: Smoke representative windows for focus behavior parity.
- [ ] T4: Run `bun run typecheck`.
