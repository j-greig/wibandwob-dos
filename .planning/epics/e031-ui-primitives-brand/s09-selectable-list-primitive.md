---
id: S09
epic: E031
title: Selectable list primitive
status: done
branch: epic/e031-ui-primitives-brand
---

# S09 — createSelectableList in ui-parts.ts

## What and why

Create a shared selectable-list primitive wrapping blessed defaults (`keys`, `vi`, `mouse`, `scrollableStyle`) to eliminate repeated list setup across windows/modules (AC-10).

## Acceptance criteria

- [ ] AC-10: `createSelectableList` exists in `ui-parts.ts` and is exported via SDK.
- [ ] Primitive applies standard list defaults and shared scroll style automatically.
- [ ] Returned handle exposes typed operations (`setItems`, selected getter, `onSelect`).
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-parts.ts` — add `createSelectableList`
- `src/microapp-sdk.ts` — export primitive

## Tasks

- [ ] T1: Implement primitive wrapper and default options contract.
- [ ] T2: Integrate `scrollableStyle()` and style defaults.
- [ ] T3: Add typed handle helpers expected by consumers.
- [ ] T4: Export through SDK and run `bun run typecheck`.
