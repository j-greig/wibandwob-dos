---
id: S06
epic: E031
title: Migrate Patchbay Lab sidebar
status: done
branch: epic/e031-ui-primitives-brand
---

# S06 — Migrate Patchbay Lab

## What and why

Migrate Patchbay Lab’s left sidebar (`32%` clamped `24–36`) to `createSidebarPanel`, keeping mode-gated visibility intact (AC-7).

## Acceptance criteria

- [ ] AC-7: Patchbay Lab uses `createSidebarPanel` with left percent width + clamp (24–36).
- [ ] Mode-gated visibility still controls sidebar via `setOpen`.
- [ ] Layout behavior remains stable across terminal sizes.
- [ ] AC-27: smoke Patchbay Lab after migration.

## Files to change

- `microapps/patchbay-lab/index.ts` — sidebar migration and mode gating wiring

## Tasks

- [ ] T1: Swap manual sidebar construction to primitive config (left, percent 32, min/max).
- [ ] T2: Port mode-gated open/close logic to primitive.
- [ ] T3: Verify sizing clamp at small/large widths.
- [ ] T4: Run smoke + `bun run typecheck`.
