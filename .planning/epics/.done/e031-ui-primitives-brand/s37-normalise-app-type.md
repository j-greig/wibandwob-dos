---
id: S37
epic: E031
title: Normalise module appType values
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S37 — Normalise appType values

## What and why

Normalize module `appType` strings to `wibwob.slug` format so workspace restore/state flows rely on one stable naming scheme (AC-42).

## Acceptance criteria

- [ ] AC-42: Target module `appType` values are normalized to canonical `wibwob.slug`.
- [ ] Workspace restore works with normalized values.
- [ ] No mixed-format appType values remain in target modules.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `microapps/glitchbox/index.ts`
- `microapps/wibwob-tidepool/index.ts`
- `microapps/sy2-chronicles/index.ts`
- `microapps/zine/index.ts`

## Tasks

- [ ] T1: Update appType literals to canonical format in each target module.
- [ ] T2: Adjust any comparisons/filters that depended on old strings.
- [ ] T3: Verify workspace restore/state behavior with new values.
- [ ] T4: Run `bun run typecheck`.
