---
id: S04
epic: E031
title: Migrate zine sidebar
status: done
branch: epic/e031-ui-primitives-brand
---

# S04 — Migrate ZINE

## What and why

Move ZINE’s left fixed sidebar (with `[` toggle) to `createSidebarPanel`, preserving existing interaction and canvas geometry behavior (AC-5).

## Acceptance criteria

- [ ] AC-5: ZINE sidebar uses `createSidebarPanel` (left, fixed 26, divider enabled).
- [ ] `[` toggle behavior is preserved via `toggle()`/`setOpen()`.
- [ ] Canvas geometry updates correctly when sidebar opens/closes.
- [ ] AC-27: smoke zine module after migration.

## Files to change

- `modules/zine/index.ts` — migrate sidebar construction and toggle wiring

## Tasks

- [ ] T1: Replace raw left sidebar with primitive configuration.
- [ ] T2: Connect `[` key behavior to primitive open state controls.
- [ ] T3: Verify layout/canvas math responds to sidebar state changes.
- [ ] T4: Run module smoke + `bun run typecheck`.
