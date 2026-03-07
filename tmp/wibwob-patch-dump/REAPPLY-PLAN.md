# Patch Reapply Plan
## After reset to 16e7b6a (codex/e002-root-migration)

Patches are in /tmp/wibwob-patch-dump/0001-0032.patch

Strategy: 16e7b6a is the good codebase — full app-controller, all API routes,
all commands, kaomoji, session ID — all intact. modules-private is restored to
c4357e6 (wibwobworld + world-chatroom + wibwobworld-iso with E022 S01+S02 fixes).

---

## SKIP — migration noise, never needed again

0004 E022 S01: update modules-private submodule ref  — submodule back to c4357e6 already
0005 E022 S02: update modules-private submodule ref  — same, already there
0006 migrate: move wibwobworld etc to modules         — SKIP, undoing this whole thing
0007 migrate: update submodule ref after removal      — SKIP
0009 docs: update module paths modules-private→modules — SKIP (paths stay in modules-private)
0024 fix: restore session ID/kaomoji/module loading   — 16e7b6a already has all this
0025 fix: restore legacy command aliases              — 16e7b6a already has them
0026 fix: restore window.toggle_maximize              — 16e7b6a already has it
0027 fix: restore AGENTS.md/CLAUDE.md symlink         — 16e7b6a has AGENTS.md as real file
0028 fix: restore theme.choose/theme.set              — 16e7b6a already has them
0029 chore: close TODO-f9c4afb7                       — planning noise

---

## APPLY — real code fixes worth keeping

0008 fix(agent): clear assistant entry, prevent transcript leak (#112)
     → src/services/wibwob-agent-session.ts — clean bug fix, apply cleanly

0011 fix(e022-s03): iso serialises terrain params not file path
     → modules-private/wibwobworld-iso — but need to apply to modules-private NOT modules/
     → Check patch carefully, target file changed due to migration

0012 fix(e022-s04): microapp geometry restored on restart
     → src/core/workspace-snapshots.ts + src/core/app-controller.ts
     → 16e7b6a may already have some of this — diff carefully first

0016 fix(e022-s05): hybrid iso pane uses pane-sized world
     → modules-private/wibwobworld — apply to modules-private version
     → Check patch, path changed due to migration

0021 fix(poetry-clock): graceful fallback when no API key
     → modules/wibwob-poetry-clock — path same, should apply cleanly

0022 fix(monster-cam): guard against missing venv/deps
     → src/windows/monster-cam-window.ts — should apply cleanly

---

## APPLY — planning/docs/tooling worth keeping

0001 chore: session handover note
0002 docs: fix epics, update handover
0003 docs: spike auto-generated handover
0010 docs(e022): tick S01+S02 done
0013 docs(e022): tick S03+S04 done
0014 feat(handover): scripts/handover.sh auto-generate
     → scripts/handover.sh — new file, applies cleanly
0015 docs: mark spk-session-handover done
0017 docs(planning): rewrite README
0018 chore(planning): remove stale loose docs
0019 docs(e022): tick S05 done
0020 docs(e022): close S06, mark epic done
0023 fix(handover): epic table fix (parse_epics bug)
0030 chore: session state, todos
0031 docs(e001-s01): CLAUDE.md agent constitution
     → .agents/CLAUDE.md — new file, applies cleanly
0032 docs: tick E001 S01 done

---

## INVESTIGATE — may conflict or need manual merge

0012 fix(e022-s04): microapp geometry restored on restart
     16e7b6a's workspace-snapshots.ts may already handle some of this via
     the registrySerialize path. Diff before applying.

0011/0016: E022 S03/S05 patches — these were applied to modules/ paths,
     need to redirect to modules-private/ paths instead. Manual edit needed.

---

## ORDER TO APPLY

1. Reset main to 16e7b6a (force push)
2. Update submodule ref to point at c4357e6 in modules-private
3. Apply code fixes: 0008, 0021, 0022
4. Apply E022 S03+S05 manually (modules-private path)
5. Investigate 0012 (e022-s04) — may already be in 16e7b6a
6. Apply tooling: 0014 (handover.sh), 0023 (epic table fix)
7. Apply docs/planning in bulk
8. Apply 0031 (CLAUDE.md constitution)
9. typecheck, push

---

## WHAT 16e7b6a ALREADY HAS (don't re-apply)
- kaomoji + session ID in top right
- loadModules wired correctly
- all 60+ commands including legacy aliases, theme.*, finder.*, maximize
- full control-api routes (world-chat, batch, openapi, maximize)
- full state-service (instanceLabel, sessionId, capabilities, theme)
- full app-controller (1933 lines)
- AGENTS.md as real file (192 lines — will want to update to 477-line version)
- Monster Cam MVP
