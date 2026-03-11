---
id: S31
epic: E031
title: Shadow constants and sync helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S31 — Shadow constants + sync helper

## What and why

Move duplicated shadow offsets and sync logic into shared window-chrome helpers/constants so core and menu overlay use one shadow math path (AC-36).

## Acceptance criteria

- [ ] AC-36: `SHADOW_X_OFFSET`, `SHADOW_Y_OFFSET`, and shared `syncShadowRect` helper are defined in `window-chrome.ts`.
- [ ] `window-manager.ts` and `menu-overlay-manager.ts` use shared helper/constants.
- [ ] Shadow placement/rendering behavior remains unchanged.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/window-chrome.ts`
- `src/core/window-manager.ts`
- `src/core/menu-overlay-manager.ts`

## Tasks

- [ ] T1: Add shared shadow offsets + sync helper in `window-chrome.ts`.
- [ ] T2: Replace duplicated logic in both consumers.
- [ ] T3: Smoke window/menu shadows visually.
- [ ] T4: Run `bun run typecheck`.
