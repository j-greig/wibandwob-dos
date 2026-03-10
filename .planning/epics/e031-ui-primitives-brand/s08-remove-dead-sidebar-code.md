---
id: S08
epic: E031
title: Remove dead sidebar code
status: done
branch: epic/e031-ui-primitives-brand
---

# S08 — Remove dead sidebar code

## What and why

After S03–S07 are complete and smoked, delete obsolete manual sidebar helpers/branches so only the shared ownership path remains (AC-9).

## Acceptance criteria

- [ ] AC-9: Manual sidebar pattern code paths removed after S03–S07 completion.
- [ ] `grep` for known raw sidebar construction patterns in migrated targets returns no hits.
- [ ] All migrated modules still pass smoke after cleanup.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- Sidebar migration target files from S03–S07 — remove superseded code
- Any now-unused helpers/constants tied to old sidebar implementations

## Tasks

- [ ] T1: Confirm S03–S07 are merged/smoked (unblock condition).
- [ ] T2: Remove dead manual sidebar branches/helpers.
- [ ] T3: Run targeted `grep` sanity checks for old pattern remnants.
- [ ] T4: Run smoke + `bun run typecheck`.
