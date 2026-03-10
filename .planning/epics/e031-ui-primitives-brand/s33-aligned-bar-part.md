---
id: S33
epic: E031
title: createAlignedBarPart extraction
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S33 — createAlignedBarPart shared implementation

## What and why

Extract common implementation shared by `createHeaderBar` and `createStatusBar` into private `createAlignedBarPart` to remove duplication (AC-38).

## Acceptance criteria

- [ ] AC-38: `createAlignedBarPart` exists and powers both `createHeaderBar` and `createStatusBar`.
- [ ] Behavior/props defaults for existing public APIs remain compatible.
- [ ] Duplicate render/layout/restyle code between bars is removed.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-parts.ts`

## Tasks

- [ ] T1: Extract shared aligned-bar implementation function.
- [ ] T2: Refactor header/status factories to delegate to shared implementation.
- [ ] T3: Verify bar behavior parity in representative windows.
- [ ] T4: Run `bun run typecheck`.
