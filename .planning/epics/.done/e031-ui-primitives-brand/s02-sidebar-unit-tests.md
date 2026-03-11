---
id: S02
epic: E031
title: Sidebar width-resolution unit tests
status: done
branch: epic/e031-ui-primitives-brand
---

# S02 — Unit tests for sidebar width resolution

## What and why

Add focused tests for sidebar sizing and overflow behavior to lock the new primitive’s contract before broad migrations (AC-3).

## Acceptance criteria

- [ ] Percent width with `min`/`max` clamps correctly across multiple parent widths.
- [ ] Fixed width resolves correctly at small and large parent sizes.
- [ ] Overflow guard shrinks sidebar when needed to preserve `mainMinWidth`.
- [ ] Zero-width / tiny-width edge cases are covered and stable.
- [ ] Test suite passes (`bun test`) and AC-26 typecheck stays clean.

## Files to change

- Sidebar test file near `ui-parts` tests (add or extend existing test module)
- `src/core/ui-parts.ts` (only if test-driven fixes are needed)

## Tasks

- [ ] T1: Add width-resolution table tests (fixed + percent).
- [ ] T2: Add overflow-guard regression tests for narrow containers.
- [ ] T3: Add edge-case tests (0 width, divider on/off).
- [ ] T4: Run `bun test` and `bun run typecheck`.
