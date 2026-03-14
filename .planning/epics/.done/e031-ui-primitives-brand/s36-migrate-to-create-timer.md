---
id: S36
epic: E031
title: Migrate modules to createTimer/clearTimers
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S36 — Migrate modules to createTimer

## What and why

Replace raw interval usage in modules with SDK timer helpers so teardown is consistent and leaks are avoided (AC-41).

## Acceptance criteria

- [ ] AC-41: Target modules use `createTimer`/`clearTimers`; raw `setInterval`/`clearInterval` patterns are removed in scope.
- [ ] Module cleanup reliably stops timers on close/unload.
- [ ] Behavior cadence remains unchanged after migration.
- [ ] AC-27: smoke affected modules after migration.

## Files to change

- `microapps/wibwob-poetry-clock/index.ts`
- `microapps/touchlab-mvp/index.ts`
- `microapps/glitchbox/index.ts`

## Tasks

- [ ] T1: Replace raw interval setup with `createTimer` registration.
- [ ] T2: Ensure cleanup paths call `clearTimers` consistently.
- [ ] T3: Verify cadence + teardown in each module.
- [ ] T4: Run smoke + `bun run typecheck`.
