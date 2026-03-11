---
id: S38
epic: E031
title: Module SDK import path cleanup
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S38 — Remove direct src/core imports from modules

## What and why

Stop modules from importing internals via `src/core/*` paths by exporting needed APIs through `microapp-sdk.ts` and migrating module imports (AC-43).

## Acceptance criteria

- [ ] AC-43: Direct `src/core/*` imports are removed from listed modules.
- [ ] Missing SDK exports are added to `microapp-sdk.ts`.
- [ ] Module behavior remains unchanged using SDK import paths.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `modules/e026-demo/index.ts`
- `modules/zine/index.ts`
- `modules/sy2-chronicles/panel-types.ts`
- `src/microapp-sdk.ts`

## Tasks

- [ ] T1: Add any missing SDK exports used by target modules.
- [ ] T2: Replace direct core imports in modules with SDK imports.
- [ ] T3: Remove now-unused direct-path import dependencies.
- [ ] T4: Run `bun run typecheck` + module smoke checks.
