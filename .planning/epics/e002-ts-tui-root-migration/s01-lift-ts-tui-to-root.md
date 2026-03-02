Status: in-progress
GitHub issue: —
PR: —

# S01 — Lift TS TUI To Root

## Purpose

First migration slice for the TS TUI promotion. Move the live app from
`spikes/ts-tui-mvp` into repo root shape without widening product scope.

## Agent Prompt

You are executing the first root-migration slice for the WibWob-DOS TS TUI.

Read first:

- [/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md](/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md)
- [/Users/james/Repos/wibandwob-dos/docs/020-target-architecture.md](/Users/james/Repos/wibandwob-dos/docs/020-target-architecture.md)

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
- `partykit/` (can move to .trash if you want)
- retained repo-wide test/tools areas only if they still have a clear role

Must review carefully before moving/deleting anything from:

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

- [x] Audit repo-root items against `020` disposition rules
- [x] Move live TS TUI app root files into repo root
- [x] Replace root `README.md` and `AGENTS.md`
- [x] Remove root `CLAUDE.md` and symlink AGENTS.md -> CLAUDE.md
- [x] Rework root ignore/submodule config
- [x] Record retained vs deleted items in a migration summary
- [x] Run root-level typecheck and smoke verification
- [x] Update this story status and task checkboxes

## Disposition Decisions (confirmed by user)

1. `tools/api_server/` — DELETE. TS app will serve its own API.
2. `tools/smoke_parade.py` and `tests/contract/` — DELETE. They test
   the C++ app via the Python API server, both now dead.
3. `scripts/tmux-launch.sh` — ADD to 020-target-architecture.md as a
   post-migration task (rewrite for TS launch). Related to E001 trigger
   table / session-start work already noted there.
4. `partykit/` — MOVE to `.trash/`. Multiplayer parked for now.
5. `spikes/ts-tui-mvp/docs/` (21 architecture docs) — MOVE to
   `.planning/epics/e002-ts-tui-root-migration/legacy-docs/`. They are
   spike-era reference, not canon for the promoted app.
6. `spikes/ts-tui-mvp/vendor/` and root `vendor/` — MERGE into root
   `vendor/`. Deduplicate if overlapping.
7. CLAUDE.md is the real file (Claude Code convention). Symlink
   AGENTS.md -> CLAUDE.md for Codex/GitHub compatibility.
8. `spikes/ts-tui-mvp/scratch/` and root `scratch/` — MERGE into root
   `scratch/`.

Other `tools/` items to disposition during migration:
- `tools/arrange.py` — layout prototyping script, probably dead (TS has its own)
- `tools/agent_mailbox/` — review if still used
- `tools/contour_stream.py`, `tools/generative_*.py` — C++ era, likely dead
- `tools/github/`, `tools/monitor/`, `tools/room/` — review per 020 rules
- `tools/scripts/` — nested scripts dir, review for live items

Other `tests/` items:
- `tests/room/` — multiplayer tests, dead with partykit parked
- `tests/test_browser*.py`, `tests/test_paint_ipc.py` — C++ IPC tests, dead
- `tests/run_ipc_chain.py`, `tests/test_ipc_chain.sh` — C++ IPC, dead

Other `scripts/` items:
- `scripts/dev-start.sh`, `scripts/dev-stop.sh` — review if TS-relevant
- `scripts/parity-check.py` — C++ parity, dead
- `scripts/snap.sh`, `scripts/stamp.sh` — review
- `scripts/sprite-*.sh` — C++ era, likely dead
- `scripts/workspace_snapshot.py` — review if superseded by TS workspace service
- `scripts/init-submodules.sh` — keep if submodules still used

## Notes

- There is no `.planning/epochs/` convention in this repo canon, we use epics instead.
- This work is tracked under `.planning/epics/e002-ts-tui-root-migration/`.
- Do the move as ONE commit (git mv, not copy-delete) to preserve blame/history.
  Then fix paths in a SECOND commit.
- CLAUDE.md is real file, AGENTS.md is symlink (decision #7).
