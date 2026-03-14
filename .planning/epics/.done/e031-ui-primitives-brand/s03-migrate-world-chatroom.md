---
id: S03
epic: E031
title: Migrate world-chatroom sidebar
status: done
branch: epic/e031-ui-primitives-brand
---

# S03 — Migrate world-chatroom

## What and why

Migrate world-chatroom’s right fixed-26 sidebar to `createSidebarPanel` to eliminate narrow-width overflow and align with the shared sidebar system (AC-4).

## Acceptance criteria

- [ ] AC-4: world-chatroom uses `createSidebarPanel` (right side, fixed 26, no toggle).
- [ ] Confirmed overflow bug at narrow widths is resolved.
- [ ] No behavior regressions in chatroom layout and interaction.
- [ ] AC-27: smoke the migrated module in running app.

## Files to change

- `microapps/world-chatroom/index.ts` (and related view file if split) — replace raw sidebar construction with primitive

## Tasks

- [ ] T1: Replace manual sidebar boxes with `createSidebarPanel` config (right/fixed 26).
- [ ] T2: Wire existing content into `main`/`sidebar` containers from primitive.
- [ ] T3: Smoke narrow-width behavior and verify overflow fix.
- [ ] T4: Run `bun run typecheck`.
