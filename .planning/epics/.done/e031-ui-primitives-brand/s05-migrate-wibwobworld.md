---
id: S05
epic: E031
title: Migrate WibWobWorld sidebar
status: done
branch: epic/e031-ui-primitives-brand
---

# S05 — Migrate WibWobWorld

## What and why

Migrate WibWobWorld’s right percent sidebar (`1/6`, min 14, `i` toggle) to the shared primitive and preserve mode-aware open state handling (AC-6).

## Acceptance criteria

- [ ] AC-6: WibWobWorld uses `createSidebarPanel` with percent width (`1/6`), min 14, right side.
- [ ] `i` key toggle remains functional.
- [ ] Mode-aware `setOpen` behavior is preserved.
- [ ] Narrow-window overflow bug is fixed.
- [ ] AC-27: smoke WibWobWorld after migration.

## Files to change

- `microapps/wibwobworld/index.ts` (and related files if split) — sidebar migration

## Tasks

- [ ] T1: Replace manual sidebar layout with `createSidebarPanel` config.
- [ ] T2: Port mode-aware visibility logic to primitive `setOpen`.
- [ ] T3: Rebind `i` toggle and verify interaction parity.
- [ ] T4: Run smoke + `bun run typecheck`.
