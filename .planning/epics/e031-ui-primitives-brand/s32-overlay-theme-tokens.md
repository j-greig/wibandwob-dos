---
id: S32
epic: E031
title: Overlay theme-token migration
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S32 — Overlay theme token migration

## What and why

Replace hardcoded overlay prompt color literals with theme-token usage so overlays participate in theme switching like other core surfaces (AC-37).

## Acceptance criteria

- [ ] AC-37: Hardcoded overlay prompt fg/bg literals are replaced by `theme()` tokens.
- [ ] Overlay prompts restyle correctly when theme changes.
- [ ] No literal prompt color values remain in targeted overlay style blocks.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/overlay-manager.ts`

## Tasks

- [ ] T1: Audit hardcoded prompt style literals in overlay manager.
- [ ] T2: Replace literals with semantically correct theme token lookups.
- [ ] T3: Smoke prompt rendering across theme switch.
- [ ] T4: Run `bun run typecheck`.
