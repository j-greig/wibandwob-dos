---
id: S19
epic: E031
title: Empty state constants
status: done
branch: epic/e031-ui-primitives-brand
---

# S19 — Empty state constants

## What and why

Introduce shared empty-state string constants and replace scattered inline literals to keep copy consistent and centrally editable (AC-20).

## Acceptance criteria

- [ ] AC-20: `src/core/empty-states.ts` exists with shared constants for common empty states.
- [ ] Target inline empty strings are replaced with constant imports.
- [ ] User-facing wording remains unchanged unless intentionally normalized.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/empty-states.ts` (new)
- Windows/modules containing inline empty-state literals from P09 audit

## Tasks

- [ ] T1: Create constant module with canonical empty-state strings.
- [ ] T2: Replace inline literals in audited files with constants.
- [ ] T3: Verify UI messages still render correctly in empty states.
- [ ] T4: Run `bun run typecheck`.
