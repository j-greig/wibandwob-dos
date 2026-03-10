---
id: S12
epic: E031
title: Inline search primitive
status: done
branch: epic/e031-ui-primitives-brand
---

# S12 — createInlineSearch in ui-parts.ts

## What and why

Introduce a reusable bottom-anchored inline search prompt primitive for modules that currently recreate identical search overlays (AC-13).

## Acceptance criteria

- [ ] AC-13: `createInlineSearch(parent, { placeholder, onSubmit, onCancel })` is implemented in `ui-parts.ts`.
- [ ] Primitive supports open/close/isOpen lifecycle with textbox, Enter submit, Escape cancel.
- [ ] Primitive is exported through `microapp-sdk.ts`.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-parts.ts` — add `createInlineSearch`
- `src/microapp-sdk.ts` — export primitive

## Tasks

- [ ] T1: Implement inline overlay + textbox creation and positioning.
- [ ] T2: Wire Enter/Escape handlers and open/close lifecycle.
- [ ] T3: Expose simple API (`open`, `close`, `isOpen`).
- [ ] T4: Export via SDK and run `bun run typecheck`.
