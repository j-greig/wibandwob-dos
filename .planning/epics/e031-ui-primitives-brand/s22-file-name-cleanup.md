---
id: S22
epic: E031
title: Window file-name cleanup
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S22 — File name cleanup

## What and why

Remove ambiguous window filenames (`misc-windows.ts`, generic `content-windows.ts`) by renaming/splitting to descriptive ownership boundaries without logic redesign (AC-23).

## Acceptance criteria

- [ ] AC-23: No file named `misc-windows.ts` remains.
- [ ] `content-windows.ts` is renamed or split into descriptive files (per brief guidance) with imports updated.
- [ ] Re-exports/import paths compile cleanly after movement.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/windows/misc-windows.ts` (rename/split target)
- `src/windows/content-windows.ts` (rename/split target)
- Any barrels/import sites consuming these files

## Tasks

- [ ] T1: Audit exports in both files and choose minimal rename/split plan.
- [ ] T2: Move/rename files with no logic behavior changes.
- [ ] T3: Update import/re-export graph across app.
- [ ] T4: Run `bun run typecheck` + smoke key windows.
