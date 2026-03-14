---
id: E024
title: Session retroapply — 5 stories onto clean 16e7b6a base
status: done
branch: fix/session-retroapply
created: 2026-03-07
---

# E024 — Session Retroapply

## Context

main was reset to `16e7b6a` (last known-good, codex/e002-root-migration) after
a bad merge gutted the codebase. modules-private restored to `c4357e6` (E022
S01+S02 applied — wibwobworld/wibwobworld-iso/world-chatroom intact).

Old main preserved as `main-archive-tvision`.
Working branch: `fix/session-retroapply`.

Patch dump for reference: `tmp/wibwob-patch-dump/` (patches 0001-0032).

---

## What 16e7b6a already has — confirmed, skip these

- Transcript leak fix (#112) — currentAssistantId already in wibwob-agent-session.ts
- E022 S04 microapp geometry restore — registrySerialize already in workspace-snapshots.ts
- Poetry clock fallback — already in microapps/wibwob-poetry-clock

---

## Stories

### S01 — Monster cam crash guard
**Status: done**
**Patch: 0022**

Adds existsSync preflight before spawning Python worker. No UI change.

- [ ] Apply or hand-copy the guard from patch 0022 into `src/windows/monster-cam-window.ts`
- [ ] typecheck passes
- [ ] commit: `fix(monster-cam): guard against missing camera/native deps`

---

### S02 — E022 S03: iso serialises terrain params not file path
**Status: done**
**Patch: 0011 — path redirect needed**

Serialisation only — no UI change. Fixes workspace restore breaking when a tmp
terrain file path no longer exists. Instead saves seed/seaLevel/levels/terrainIdx.

Patch targets `microapps/wibwobworld-iso/index.ts` (migration path, wrong).
Must be applied to `microapps-private/wibwobworld-iso/index.ts` instead.

- [ ] Read patch 0011, apply change manually to `microapps-private/wibwobworld-iso/index.ts`
- [ ] Commit inside modules-private: `fix(e022-s03): iso serialises terrain params not file path`
- [ ] Update submodule ref in main repo, commit: `fix(e022-s03): update modules-private submodule ref`

---

### S03 — E022 S05: hybrid iso pane uses its own sized world
**Status: done**
**Patch: 0016 — path redirect needed**

Adds a separate `hybridIsoCacheKey` + world sized to the iso pane, not the full
contour world. Prevents stride compression / squashed iso in hybrid view.

Patch targets `microapps/wibwobworld/index.ts` (migration path, wrong).
Must be applied to `microapps-private/wibwobworld/index.ts` instead.

- [ ] Read patch 0016, apply change manually to `microapps-private/wibwobworld/index.ts`
- [ ] Commit inside modules-private: `fix(e022-s05): hybrid iso pane uses pane-sized world`
- [ ] Update submodule ref in main repo

---

### S05 — Move wibwobworld + world-chatroom to microapps/, delete wibwobworld-iso
**Status: done**
**Depends on: S02 + S03 (E022 fixes must be in modules-private first)**

Move the two world modules out of the submodule into the main repo's microapps/.
Delete wibwobworld-iso entirely — its renderIso function is imported directly
by wibwobworld, so move that import inline or copy the needed code across.

- [ ] Copy `microapps-private/wibwobworld/` → `microapps/wibwobworld/`
- [ ] Copy `microapps-private/world-chatroom/` → `microapps/world-chatroom/`
- [ ] Delete `microapps-private/wibwobworld-iso/` from submodule
- [ ] Delete `microapps-private/wibwobworld/` from submodule
- [ ] Delete `microapps-private/world-chatroom/` from submodule
- [ ] Fix the `import { renderIso } from "../wibwobworld-iso/index.js"` in wibwobworld
      — either inline renderIso or copy wibwobworld-iso/index.ts into wibwobworld/
- [ ] Commit inside modules-private (just primers/prompts/phosphor-theme remain)
- [ ] Commit microapps/ additions + submodule ref update in main repo
- [ ] typecheck passes

---

### S04 — handover.sh
**Status: done**
**Patch: 0014 + 0023**

New script `scripts/handover.sh` — auto-generates session handover doc.
Patch 0023 fixes the epic table parse bug. Both are new files, clean apply.

- [ ] `git am tmp/wibwob-patch-dump/0014-*.patch`
- [ ] `git am tmp/wibwob-patch-dump/0023-*.patch`

---

## Acceptance criteria

- [ ] `bun run typecheck` passes clean
- [ ] App boots — kaomoji, session code, all 6 microapps in Applications menu
- [ ] WibWobWorld and World Chatroom open without error
- [ ] Monster Cam opens without crashing when venv missing
- [ ] Workspace restore opens WibWobWorld in correct renderMode (not forced to contours)
- [ ] Hybrid view iso pane not squashed
- [ ] `bun run handover` generates doc with populated epic table
- [ ] wibwobworld + world-chatroom in microapps/, not modules-private
- [ ] wibwobworld-iso deleted entirely
- [ ] modules-private contains only wibwob-primers, wibwob-prompts, wibwob-theme-phosphor
- [ ] PR fix/session-retroapply → main, squash merge, close E024
