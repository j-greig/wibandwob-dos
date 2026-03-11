---
id: S35
epic: E031
title: Shared base types extraction
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S35 — Shared base types in types.ts

## What and why

Extract shared base interfaces from near-duplicate type clusters in `types.ts` to reduce drift and improve type clarity (AC-40).

## Acceptance criteria

- [ ] AC-40: Shared bases (`LabeledEntries`, `PointerDragBase`, `WindowGeometry`) are introduced and reused.
- [ ] Duplicate type clusters are refactored to compose these bases.
- [ ] Public type behavior remains compatible for consumers.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/types.ts`
- Consumer files if minor type import/shape adjustments are needed

## Tasks

- [ ] T1: Introduce the three shared base type definitions.
- [ ] T2: Refactor target duplicate clusters to compose base types.
- [ ] T3: Fix consumer typing fallout (if any) with minimal changes.
- [ ] T4: Run `bun run typecheck`.
