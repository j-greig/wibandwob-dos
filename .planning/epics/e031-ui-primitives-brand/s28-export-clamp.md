---
id: S28
epic: E031
title: Export clamp helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S28 — Export clamp helper

## What and why

Expose a reusable clamp helper in UI primitives and replace inline clamp math to reduce repetition and improve readability (AC-33).

## Acceptance criteria

- [ ] AC-33: `clamp(value, min, max)` (or exported equivalent) is available from ui-primitives.
- [ ] Seven inline clamp expressions are replaced in target files.
- [ ] Numeric behavior remains identical.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-primitives.ts` — add/export clamp helper
- `src/windows/text-windows.ts`
- `src/windows/content-windows.ts`

## Tasks

- [ ] T1: Add/export clamp helper in `ui-primitives.ts`.
- [ ] T2: Replace inline clamp math in target windows.
- [ ] T3: Verify unchanged behavior in affected UI flows.
- [ ] T4: Run `bun run typecheck`.
