---
id: S13
epic: E031
title: Migrate inline search consumers
status: done
branch: epic/e031-ui-primitives-brand
---

# S13 — Migrate zine and sy2-chronicles inline search

## What and why

Replace duplicated `openSearchPrompt()` logic in zine and sy2-chronicles with `createInlineSearch` to centralize behavior and reduce lifecycle bugs (AC-14).

## Acceptance criteria

- [ ] AC-14: zine and sy2-chronicles search overlays use `createInlineSearch`.
- [ ] Existing submit/cancel behavior and keybindings are preserved.
- [ ] Duplicated destroy+recreate prompt logic is removed from both modules.
- [ ] AC-27: smoke both modules after migration.

## Files to change

- `microapps/zine/index.ts`
- `microapps/sy2-chronicles/index.ts`

## Tasks

- [ ] T1: Replace module-local search prompt builders with `createInlineSearch`.
- [ ] T2: Map existing callbacks to primitive `onSubmit`/`onCancel`.
- [ ] T3: Remove obsolete inline search code branches.
- [ ] T4: Run smoke + `bun run typecheck`.
