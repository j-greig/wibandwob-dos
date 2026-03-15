---
id: S10
epic: E031
title: Migrate raw selectable lists
status: done
branch: epic/e031-ui-primitives-brand
---

# S10 — Migrate raw blessed.list calls

## What and why

Replace scattered raw `blessed.list()` usage (outside overlay-manager) with `createSelectableList` to centralize behavior and styling (AC-11).

## Acceptance criteria

- [ ] AC-11: Raw list constructions in target files are replaced with `createSelectableList`.
- [ ] `overlay-manager.ts` list implementations remain untouched (explicitly excluded).
- [ ] Selection behavior and key/mouse interactions remain unchanged in migrated windows/modules.
- [ ] AC-27: smoke migrated surfaces and verify list parity.

## Files to change

- `src/windows/content-windows.ts` (3 list constructions)
- `src/windows/backrooms-log-browser-window.ts`
- `src/windows/backrooms-windows.ts`
- `microapps/zine/index.ts`

## Tasks

- [ ] T1: Migrate each target raw list call to `createSelectableList`.
- [ ] T2: Remove duplicate per-list default option boilerplate.
- [ ] T3: Verify selection + keyboard behavior in each surface.
- [ ] T4: Run smoke + `bun run typecheck`.
