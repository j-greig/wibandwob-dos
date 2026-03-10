---
id: S34
epic: E031
title: Command catalog builder cleanup
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S34 — command-catalog builder cleanup

## What and why

Reduce command-catalog repetition by defaulting `api/agent` flags and introducing local builders for repeated command shapes (AC-39).

## Acceptance criteria

- [ ] AC-39: Local `windowByIdCommand()` (or equivalent) builder is used for window-by-id command family.
- [ ] Repeated explicit `api:true`/`agent:true` boilerplate is removed via safe defaults.
- [ ] Command registry output behavior remains unchanged.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/command-catalog.ts`
- (if needed) related command typing files used by catalog

## Tasks

- [ ] T1: Introduce safe defaults for command capability flags.
- [ ] T2: Add local builder for repeated window-by-id command entries.
- [ ] T3: Refactor catalog entries to use builder/defaults without behavior change.
- [ ] T4: Run `bun run typecheck` and sanity-check command list output.
