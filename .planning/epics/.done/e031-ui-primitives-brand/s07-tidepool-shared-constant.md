---
id: S07
epic: E031
title: Tidepool shared sidebar sizing constant
status: done
branch: epic/e031-ui-primitives-brand
---

# S07 — Tidepool shared sizing constant

## What and why

Deduplicate Tidepool sidebar width policy into one shared constant used by both `renderer.ts` and `index.ts`, reducing drift until full primitive migration is possible (AC-8).

## Acceptance criteria

- [ ] AC-8: One shared sidebar sizing constant is defined and imported in both Tidepool files.
- [ ] No duplicate fixed width literals remain across Tidepool sidebar sizing paths.
- [ ] Behavior remains unchanged after dedupe.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `modules/wibwob-tidepool/index.ts` — consume shared sizing constant
- `modules/wibwob-tidepool/renderer.ts` — consume shared sizing constant
- (new Tidepool constants file if needed)

## Tasks

- [ ] T1: Introduce canonical Tidepool sidebar width constant.
- [ ] T2: Replace duplicate literals in both files with shared import.
- [ ] T3: Verify runtime behavior is unchanged.
- [ ] T4: Run `bun run typecheck`.
