# E023 Agent Handover — Capability-Aware Command Registry

**Date:** 2026-03-07  
**Branch:** `codex/e023-capability-aware-command-registry`  
**Worktree:** `/Users/james/Repos/wibandwob-dos-e023`  
**Main branch:** `codex/e002-root-migration`  
**Repo root:** `/Users/james/Repos/wibandwob-dos`

---

## What was built

E023 makes the WibWob-DOS command registry capability-aware. Commands declare
`requires?: CapabilityKey[]`. A new `CapabilityService` probes at boot. The
`CommandRegistry` becomes the single gate — menus, palette, `/commands/list`,
and agent tools all see the same filtered truth. A `WIBWOB_DEPLOY_PROFILE` env
var loads a policy JSON overlay (forceOff/forceOn) for deterministic deployment
gating without forking catalogs.

## Commits on the e023 branch

```
2122043  docs(e023): mark epic done, add implementation summary, update skill
da941da  feat(e023): capability-aware command registry — S00-S05 complete
```

Both sit 2 commits ahead of the fork point `f72514c`.

## Files changed

```
src/services/capability-service.ts        NEW — CapabilityService, probes, policy merge
src/core/command-catalog.ts               requires?: CapabilityKey[] on AppCommandDefinition
src/core/command-registry.ts              list() filters, run() guards
src/core/types.ts                         capabilities in DesktopState.app
src/services/state-service.ts             capabilities in buildState()
src/services/control-api.ts               ?includeUnavailable=1 on /commands/list
src/services/chrome-browser-service.ts    capability gate before Puppeteer launch
src/services/monster-cam-worker.ts        capability gate + clear error before spawn
src/windows/backrooms-windows.ts          error handler on child process spawn
config/capability-profiles/docker-safe.json   NEW — forceOff: chrome, monster_cam, backrooms
config/capability-profiles/full.json          NEW — no overrides
deploy/Dockerfile.smoke                   COPY config/ + WIBWOB_DEPLOY_PROFILE=docker-safe in .env
.planning/epics/e023-.../e023-brief.md    Status: done + Implementation Summary
.pi/skills/wibwobdos/references/connection.md  Deployment Profiles section added
```

## Verified behaviour

```
bun run typecheck → clean

CapabilityService on dev machine:
  OK   bin.figlet
  OK   bin.chrome
  NO   path.monster_cam.venv  -- missing mediapipe venv
  OK   path.backrooms.repo
  NO   env.anthropic_api_key  -- not set

WIBWOB_DEPLOY_PROFILE=docker-safe on dev machine:
  4 commands gated: chrome.open, monster_cam.open, backrooms.open, backrooms.run
  54 / 58 available

Docker smoke container (rebuilt, SSH tunnel verified):
  bin.figlet            OK  [probe]
  bin.chrome            NO  [profile-force-off]
  path.monster_cam.venv NO  [profile-force-off]
  path.backrooms.repo   NO  [profile-force-off]
  env.anthropic_api_key NO  [probe] — expected, no key injected
  73 total commands → 4 gated → 69 available ✓
```

## Branch tree

```
f72514c  ← fork point
         ├── da941da  feat(e023): S00-S05        ← e023 branch
         │   2122043  docs(e023): done + skill   ← e023 branch
         │
         ├── a157ffe  planning: register e023    ← main branch (codex/e002-root-migration)
         └── 1c5c3ab  chore: planning todos      ← main branch
```

## Your job — merge into main

```bash
cd /Users/james/Repos/wibandwob-dos

# Merge (recommended — simple, safe for handoff)
git merge codex/e023-capability-aware-command-registry --no-ff \
  -m "merge(e023): capability-aware command registry into e002-root-migration"

# Verify
bun run typecheck

# Confirm capabilities shape in /state (needs app running)
# curl -s http://127.0.0.1:8099/state | python3 -c "import sys,json; print(json.load(sys.stdin)['app'].get('capabilities','MISSING'))"
```

No conflicts expected — e023 touches source files, main branch touches only
planning docs and todos.

## If you want linear history instead (optional)

```bash
cd /Users/james/Repos/wibandwob-dos-e023
git rebase codex/e002-root-migration

cd /Users/james/Repos/wibandwob-dos
git merge codex/e023-capability-aware-command-registry   # fast-forward now
```

## Context links

- Epic brief: `.planning/epics/e023-capability-aware-command-registry/e023-brief.md`
- Skill docs updated: `.pi/skills/wibwobdos/references/connection.md`
- Profile files: `config/capability-profiles/docker-safe.json`, `full.json`
- Next epic after merge: E021 VPS deploy — see `.planning/epics/e021-vps-multi-agent-world/next-session-plan.md`
