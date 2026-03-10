---
id: S39
epic: E031
title: focusOrCreate SDK helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S39 — focusOrCreate helper

## What and why

Add SDK-level `focusOrCreate()` helper and migrate singleton-style modules to consistent open-or-focus behavior (AC-44).

## Acceptance criteria

- [ ] AC-44: `focusOrCreate()` helper exists in SDK and is used by singleton target modules.
- [ ] Modules that should be singleton focus existing window instead of opening duplicates.
- [ ] Existing glitchbox guard is aligned with shared helper usage.
- [ ] AC-27: smoke singleton open flows after migration.

## Files to change

- `src/microapp-sdk.ts` (and helper owner file if needed)
- `modules/glitchbox/index.ts`
- `modules/wibwob-tidepool/index.ts`
- `modules/wibwobworld/index.ts`
- `modules/patchbay-lab/index.ts`
- `modules/zine/index.ts`

## Tasks

- [ ] T1: Implement `focusOrCreate()` helper in SDK surface.
- [ ] T2: Migrate singleton module open handlers to helper.
- [ ] T3: Verify repeated open commands focus existing window.
- [ ] T4: Run smoke + `bun run typecheck`.
