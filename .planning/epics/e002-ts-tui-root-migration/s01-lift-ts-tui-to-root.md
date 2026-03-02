Status: not-started
GitHub issue: —
PR: —

# S01 — Lift TS TUI To Root

## Purpose

First migration slice for the TS TUI promotion. Move the live app from
`spikes/ts-tui-mvp` into repo root shape without widening product scope.

## Agent Prompt

You are executing the first root-migration slice for the WibWob-DOS TS TUI.

Read first:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/000-docs-overview.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/000-docs-overview.md)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/020-target-architecture.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/docs/020-target-architecture.md)

Objective:

- make `/Users/james/Repos/wibandwob-dos/` the effective TS TUI app root
- preserve current TS TUI behavior
- avoid adding features
- prune aggressively rather than carrying legacy clutter forward
- clearly label/tag the prior commit so zilla can find pre-refactor files from the OG tvsion app if we have forgotten anything
- simplify and make DRY the codebase and documentation when practical or when front-loaded effort now will reduce sprawl/pain later

Non-goals:

- no new apps/windows
- no renderer/framework pivot
- no broad behavior redesign
- no speculative cleanup outside migration scope unless front-loaded effort is merited

Required outcomes:

1. Move TS TUI root-owned app files from `spikes/ts-tui-mvp` into repo root:
   - `src/`
   - `package.json`
   - `bun.lock`
   - TS config files
   - spike-local scripts that are still live
2. Replace repo-root `README.md` and `AGENTS.md` with TS TUI canon versions.
3. Delete repo-root `CLAUDE.md`.
4. Refactor repo-root `.gitignore` and `.gitmodules` to fit the new root.
5. Keep only intentionally retained top-level dirs/files per `020`.
6. Do not drag forward dead legacy runtime files “just in case”.

Top-level disposition rule:

- if an item is not clearly needed for the new TS TUI root, prefer delete,
  rewrite, or explicit quarantine over silent retention
- use git history as recovery path rather than preserving clutter
- use a temporary .trash folder in repo root for anything which still sits in a grey area for deletion after all the above considered

Must preserve:

- all top-level dot-directories already marked keep by the user
- `modules/`
- `modules-private/`
- `logs/`
- `scratch/`
- `screenshots/`
- `vendor/`
- `partykit/`
- retained repo-wide test/tools areas only if they still have a clear role

Must review carefully before moving/deleting:

- `tools/`
- `tests/`
- `scripts/`
- `.github/`
- `.planning/`
- `exports/`

Execution constraints:

- smallest vertical slice
- behavior-preserving move first
- update docs/instructions in the same pass
- if a file is moved, fix imports/paths immediately
- if a folder is retained, record why
- if a folder is removed, record why

Deliverables:

1. migrated root layout
2. concise migration summary file listing:
   - moved
   - retained
   - rewritten
   - deleted
3. updated planning status in this story

Tests:

- `bun run typecheck` from repo root
- one repo-root app launch smoke command documented
- verify key doc links still resolve

Rollback note:

- this slice should be reversible by restoring the pre-move tree from git;
  avoid destructive edits that mix migration with unrelated refactors

## Tasks

- [ ] Audit repo-root items against `020` disposition rules
- [ ] Move live TS TUI app root files into repo root
- [ ] Replace root `README.md` and `AGENTS.md`
- [ ] Remove root `CLAUDE.md` and symlink AGENTS.md -> CLAUDE.md
- [ ] Rework root ignore/submodule config
- [ ] Record retained vs deleted items in a migration summary
- [ ] Run root-level typecheck and smoke verification
- [ ] Update this story status and task checkboxes

## Notes

- There is no `.planning/epochs/` convention in this repo canon, we use epics instead.
- This work is tracked under `.planning/epics/e002-ts-tui-root-migration/`.
