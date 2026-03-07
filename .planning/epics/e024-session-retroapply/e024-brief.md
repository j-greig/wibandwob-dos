---
id: E024
title: Session Retroapply — cherry-pick real fixes onto clean 16e7b6a base
status: in-progress
branch: fix/session-retroapply
issue: ~
created: 2026-03-07
---

# E024 — Session Retroapply

## Context

Main was reset to `16e7b6a` (codex/e002-root-migration, last known-good) after
a bad merge `4e2500b` gutted ~700 lines from app-controller, deleted AGENTS.md,
stripped 23 commands, and killed all API routes.

modules-private is at `c4357e6` (E022 S02 — wibwobworld + world-chatroom +
wibwobworld-iso with E022 S01+S02 debug/renderMode fixes applied).

Patch dump: `tmp/wibwob-patch-dump/0001-0032.patch`
Full reapply notes: `tmp/wibwob-patch-dump/REAPPLY-PLAN.md`

---

## What 16e7b6a already has (do NOT re-apply)

- Full app-controller (1933 lines) — kaomoji, session ID, loadModules wired
- All 60+ commands including legacy aliases, theme.*, finder.*, maximize
- Full control-api routes (world-chat, batch, openapi, maximize)
- Full state-service with instanceLabel/sessionId/capabilities/theme
- AGENTS.md as real file (192 lines)
- Monster Cam MVP
- modules-private at c4357e6 with E022 S01+S02 applied

---

## Stories

### S01 — Bug fixes (patches 0008, 0021, 0022)
**Status: open**

Real bug fixes from the session, clean cherry-picks.

- [ ] AC-1: `0008` fix(agent): clear assistant entry between turns, prevent transcript leak (#112)
  - File: `src/services/wibwob-agent-session.ts`
  - Apply: `git am tmp/wibwob-patch-dump/0008-*.patch`
  - Risk: low — self-contained, well-scoped fix

- [ ] AC-2: `0021` fix(poetry-clock): graceful fallback to plain clock when no API key
  - File: `modules/wibwob-poetry-clock/`
  - Apply: `git am tmp/wibwob-patch-dump/0021-*.patch`
  - Risk: low — modules/ path unchanged

- [ ] AC-3: `0022` fix(monster-cam): guard against missing camera/native deps
  - File: `src/windows/monster-cam-window.ts`
  - Apply: `git am tmp/wibwob-patch-dump/0022-*.patch`
  - Risk: low — additive guard, no refactor

---

### S02 — E022 S03+S04+S05 (patches 0011, 0012, 0016) — MANUAL
**Status: open**

These patches were written against `modules/` paths after migration. Since we
reverted, target is now `modules-private/`. Needs manual path fixup.

- [ ] AC-1: `0011` fix(e022-s03): iso serialises terrain params not ephemeral file path
  - Original target: `modules/wibwobworld-iso/index.ts`
  - Now target: `modules-private/wibwobworld-iso/index.ts`
  - Action: read patch diff, apply change manually, commit to modules-private first
            then update submodule ref in main repo

- [ ] AC-2: `0012` fix(e022-s04): microapp geometry restored on restart
  - Files: `src/core/workspace-snapshots.ts`, `src/core/app-controller.ts`
  - Check if 16e7b6a already has registrySerialize path in workspace-snapshots
  - `grep -n "registrySerialize\|restoreMicroapp" src/core/workspace-snapshots.ts`
  - If missing: apply diff manually from patch file

- [ ] AC-3: `0016` fix(e022-s05): hybrid iso pane uses pane-sized world
  - Original target: `modules/wibwobworld/index.ts`
  - Now target: `modules-private/wibwobworld/index.ts`
  - Action: read patch diff, apply manually to modules-private, commit there first

---

### S03 — Tooling (patches 0014, 0023)
**Status: open**

New scripts that didn't exist in 16e7b6a, apply cleanly.

- [ ] AC-1: `0014` feat(handover): scripts/handover.sh auto-generate session handover
  - New file — `git am tmp/wibwob-patch-dump/0014-*.patch`
  - Also apply `0023` fix(handover): epic table parse_epics bug

- [ ] AC-2: `0023` fix(handover): epic table populates correctly
  - Depends on 0014
  - `git am tmp/wibwob-patch-dump/0023-*.patch`

---

### S04 — AGENTS.md update + CLAUDE.md constitution
**Status: open**

16e7b6a has AGENTS.md at 192 lines. The session produced a 477-line v2 and a
638-line .agents/CLAUDE.md agent constitution.

- [ ] AC-1: Update AGENTS.md to 477-line v2
  - Source: `git show a325fb2:AGENTS.md` — no, source is bc21111 version
  - Actually just write it fresh — it's docs, not code
  - `git show` the content from the orphaned commit if needed:
    `git show a2ad84d~1:AGENTS.md` (the commit before reset had the 477-line ver)

- [ ] AC-2: `0031` docs(e001-s01): .agents/CLAUDE.md agent constitution
  - New file — `git am tmp/wibwob-patch-dump/0031-*.patch`
  - 638-line agent constitution with trigger tables, subsystem map, commit rules

---

### S05 — Planning docs bulk
**Status: open**

Docs-only commits from the session. Apply in one pass.

Apply in order:
- `0001` chore: session handover note
- `0002` docs: fix epics, update handover
- `0003` docs: spike auto-generated handover
- `0010` docs(e022): tick S01+S02 done
- `0013` docs(e022): tick S03+S04 done
- `0015` docs: mark spk-session-handover done
- `0017` docs(planning): rewrite README for WibWob-DOS
- `0018` chore(planning): remove stale loose docs
- `0019` docs(e022): tick S05 done
- `0020` docs(e022): close S06, mark epic done
- `0032` docs: tick E001 S01 done in brief

Command to try bulk apply (expect some conflicts on planning files):
```
git am tmp/wibwob-patch-dump/0001-*.patch \
       tmp/wibwob-patch-dump/0002-*.patch \
       ...
```
Or apply one at a time with `git am --reject` and fix manually.

---

## Execution order

1. S01 — bug fixes (clean, do first, low risk)
2. S02 — E022 S03+S04+S05 (manual, modules-private first then submodule ref)
3. S03 — tooling (clean new files)
4. S04 — AGENTS.md + CLAUDE.md (docs but important)
5. S05 — planning bulk (docs only, any order)

typecheck after S01 and S02. Push fix/session-retroapply when clean.
PR into main. Do not force-push main again.

---

## Acceptance criteria

- [ ] `bun run typecheck` passes clean
- [ ] App boots: kaomoji visible, session code visible, all 6 microapps in menu
- [ ] WibWobWorld opens from Applications menu
- [ ] World Chatroom opens
- [ ] #112 fixed (no tool output in transcript)
- [ ] Poetry clock fallback works without API key
- [ ] handover.sh generates a full doc with epic table populated
- [ ] `.agents/CLAUDE.md` exists with trigger tables
