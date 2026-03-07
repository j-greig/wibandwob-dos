---
id: E002
title: TS TUI Root Migration
status: done
issue: ~
pr: ~
depends_on: []
---

# E002 - TS TUI Root Migration

## TL;DR

Promote the TypeScript TUI from spike to primary app layout by lifting
`/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp` into repo root shape.
Target architecture is already defined. This epic is the migration path from
spike layout to root canon without dragging legacy repo clutter forward.

## Read First

- [/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md](/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md)
- [/Users/james/Repos/wibandwob-dos/docs/020-target-architecture.md](/Users/james/Repos/wibandwob-dos/docs/020-target-architecture.md)

## Objective

Make the TS TUI app the primary repo runtime layout:

- `src/` lives at repo root
- Bun config becomes canonical at repo root
- root `README.md` and `AGENTS.md` are replaced with TS TUI versions
- spike-only structure disappears
- repo-root disposition follows the prune-heavy rules in `020`

## Acceptance Criteria

- [x] AC-1: Repo root matches the target TS TUI layout closely enough that
  `spikes/ts-tui-mvp` is no longer the app root-in-practice.
  Test: `bun run typecheck` succeeds from repo root; `src/`, `package.json`,
  `bun.lock`, and TS config are rooted at `/Users/james/Repos/wibandwob-dos/`.

- [x] AC-2: Root canon docs and instructions point to the TS TUI architecture,
  not the old mixed repo shape.
  Test: root `README.md` and `AGENTS.md` describe the TS TUI as primary app;
  removed/stale instructions are absent.

- [x] AC-3: Legacy root clutter is either retained intentionally, rewritten,
  or pruned per the disposition rules in `020`.
  Test: migration summary lists every top-level retained, moved, rewritten, or
  deleted item; no ambiguous leftovers remain in the working set.

- [x] AC-4: Active planning for this move lives under `.planning/epics/e002-*`
  rather than in ad hoc spike notes.
  Test: this epic plus the first story brief are sufficient to execute the
  first migration slice without consulting a separate "prompt chat".

## Planned First Story

- [x] S01 — Lift TS TUI to root without changing behavior

