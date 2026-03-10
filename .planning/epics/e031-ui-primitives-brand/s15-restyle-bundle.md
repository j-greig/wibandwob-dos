---
id: S15
epic: E031
title: Restyle bundle primitive
status: done
branch: epic/e031-ui-primitives-brand
---

# S15 — createRestyleBundle in ui-parts.ts

## What and why

Create `createRestyleBundle` to consolidate 24 duplicated restyle blocks and ensure complete declarative widget restyling on theme changes (AC-16).

## Acceptance criteria

- [ ] AC-16: `createRestyleBundle(entries)` exists and windows use `frame.onRestyle = bundle.restyle`.
- [ ] All 24 targeted restyle blocks migrate to the shared bundle pattern.
- [ ] Theme-switch restyling covers all declared widgets without stale style regressions.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-parts.ts` — add restyle bundle utility
- Window files listed in P03 — migrate `frame.onRestyle` implementations

## Tasks

- [ ] T1: Implement `createRestyleBundle` factory API.
- [ ] T2: Migrate P03 windows to declarative entry lists.
- [ ] T3: Smoke theme switch across representative windows.
- [ ] T4: Run `bun run typecheck`.
