---
id: S21
epic: E031
title: WindowKind cleanup (markdown-viewer → reader)
status: done
branch: epic/e031-ui-primitives-brand
---

# S21 — WindowKind type cleanup

## What and why

Rename `WindowKind` value `markdown-viewer` to `reader` and provide restore-time legacy aliasing so old snapshots still load (AC-22).

## Acceptance criteria

- [ ] AC-22: `WindowKind` uses `reader` instead of `markdown-viewer`.
- [ ] All wiring (catalog/action/factory/state) is updated to new kind.
- [ ] Workspace restore gracefully maps legacy `markdown-viewer` snapshots to `reader`.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/types.ts` — union rename
- `src/core/command-catalog.ts`, `src/core/app-controller.ts` — wiring updates
- Workspace restore path(s) in controller/workspace service — legacy alias mapping

## Tasks

- [ ] T1: Rename type value and compile-fix all references.
- [ ] T2: Add backward-compat mapping in restore flow.
- [ ] T3: Verify old snapshot load path manually.
- [ ] T4: Run `bun run typecheck`.
