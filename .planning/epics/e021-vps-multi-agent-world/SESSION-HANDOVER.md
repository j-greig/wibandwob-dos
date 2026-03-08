# Session Handover — E021 VPS Multi-Agent World
**Date:** 2026-03-08
**Branch:** epic/e021-vps-multi-agent-world
**Worktree:** ~/Repos/wibwobdos-vps
**Main repo:** ~/Repos/wibandwob-dos
**Written for:** fresh agent with zero prior context

Read this top to bottom before touching anything.

---

## What This Repo Is

WibWob-DOS is a terminal-native TypeScript desktop shell running in Bun.
It renders overlapping windows via blessed, has a HTTP control API on port 8099,
and runs inside tmux so agents can attach to the TUI over SSH.

Key files to understand the system:
```
src/core/app-controller.ts     composition root — all window openers live here
src/core/command-catalog.ts    single source of truth for user-visible commands
src/core/command-registry.ts   execution + list + menu build layer
src/services/capability-service.ts  runtime environment gating (what's installed/available)
src/services/control-api.ts    HTTP REST surface on port 8099
config/capability-profiles/    JSON profiles that override capability probe results
deploy/                        Docker files, Caddy config, session scripts
scripts/                       operational scripts (smoke restart, minimap, etc.)
.planning/epics/e021-vps-multi-agent-world/  all planning docs for this work
```

To understand command flow:
1. Command defined in `command-catalog.ts` with optional `requires: CapabilityKey[]`
2. `capability-service.ts` probes environment + applies profile overrides
3. `command-registry.ts` gates list/run against availability
4. Menu built by `createMenuConfigs()` in command-catalog.ts — BUG: does not filter unavailable (see below)

To understand the Docker smoke image:
```
deploy/Dockerfile.smoke     — the image used for local testing and VPS deploy
deploy/smoke-entrypoint.sh  — container startup: sshd + tmux + app + ttyd
deploy/test_agent_key       — SSH private key for connecting (chmod 600 required)
deploy/test_agent_key.pub   — installed as authorized_keys in image
```

---

## What This Epic (E021) Is About

Goal: run WibWob-DOS on a Hetzner VPS (89.167.18.207, SSH port 2849, Ubuntu 24.04 ARM64),
allow multiple agents to access it over SSH, and eventually bind world chatspots to
VPS filesystem folders (agents navigate WibWobWorld → join chatspot → get folder access).

Current epic status: working through S01 (VPS baseline). S00 (Docker smoke) is done.

Read the full epic brief:
```
.planning/epics/e021-vps-multi-agent-world/e021-brief.md
```

Read the next session plan (ordered task list):
```
.planning/epics/e021-vps-multi-agent-world/next-session-plan.md
```

Read what happened in this session:
```
.planning/epics/e021-vps-multi-agent-world/devlog.md
```

---

## State of Play RIGHT NOW

### Docker smoke container

Running locally. All 8 gates green on latest image (rebuilt 2026-03-08).

Quick connection:
```bash
bash scripts/smoke-restart.sh --no-build   # restart without rebuild
bash scripts/smoke-restart.sh              # rebuild + restart

# Then:
# Browser TUI: http://127.0.0.1:7681
# SSH:         ssh -i deploy/test_agent_key -p 2849 wibwob@127.0.0.1
# Control API: http://127.0.0.1:19099/health  (tunnel established by script)
# Tmux attach: ssh ... 'tmux attach -t wibwob'
```

The 8 gates (S00 acceptance criteria):
```bash
KEY=deploy/test_agent_key

# GATE1: SSH key auth
ssh -i $KEY -p 2849 wibwob@127.0.0.1 'echo ok'

# GATE2: password auth blocked
ssh -o PreferredAuthentications=password -p 2849 wibwob@127.0.0.1  # expect: denied

# GATE3: tmux session live
ssh -i $KEY -p 2849 wibwob@127.0.0.1 'tmux has-session -t wibwob'

# GATE4: health via tunnel
curl -s http://127.0.0.1:19099/health  # expect: {"ok":true,"instanceLabel":"smoke"}

# GATE5: port 8099 not publicly exposed (container binds 127.0.0.1 internally)
# Verified: no -p 8099 in docker run args

# GATE6: commands list functional
curl -s http://127.0.0.1:19099/commands/list | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(len(d['commands']), 'commands')"
# expect: ~81 commands

# GATE7: WibWobWorld opens
curl -s -X POST http://127.0.0.1:19099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open","args":{}}'
sleep 3 && curl -s http://127.0.0.1:19099/state | python3 -c \
  "import json,sys; ws=json.load(sys.stdin)['windows']; print([w['appType'] for w in ws])"

# GATE8: ttyd serving xterm.js
curl -s http://127.0.0.1:7681/ | grep -c xterm
```

### Human smoke test results (done this session)

MVP1 apps all working in browser:
- File Manager, Primer Gallery, Figlet Banner (148 fonts now in image)
- Contour Studio, Hello World, WibWobWorld (all 4 views)
- World Chatroom (connect via C keypress in WibWobWorld, chat visible)
- Pattern Window, Command Palette, Plasma (API only — browser crashes, see below)
- Window drag/resize/tile/cascade, multiple windows simultaneously
- 5 min idle stability, API parity (/state matches screen)
- Document Reader (fixed this session — was crashing on phantom file)

---

## BLOCKERS — Must Fix Before VPS Deploy

### BLOCKER 1: Chrome Browser crashes app from menu

User clicks Applications → Chrome Browser → app crashes → container exits → everyone disconnected.

Root cause: `chrome.open` has `requires: ["bin.chrome"]` in command-catalog.ts.
Capability probe correctly returns false (no Chrome in container).
BUT `createMenuConfigs()` in `src/core/command-catalog.ts` does NOT filter
by availability — it adds all commands with menuPlacements regardless.

```typescript
// src/core/command-catalog.ts ~line 816
// BUG: no availability check here
export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  return MENU_DEFINITIONS.map((menu) => ({
    items: listAppCommands()
      .flatMap((command) =>
        command.menuPlacements
          .filter((placement) => placement.category === menu.category)
          // MISSING: .filter(command => capabilityService.isAvailable(command.requires).ok)
          .map(...)
      )
  }));
}
```

Fix: import capabilityService and filter before mapping. Also fix `buildMenus()`
in `src/core/command-registry.ts` for dynamic commands.

IMPORTANT: E023 (capability-aware command registry) may have already fixed this.
E023 is DONE but NOT merged to main. Check `~/Repos/wibandwob-dos-e023/src/core/command-catalog.ts`
before reimplementing.

### BLOCKER 2: E023 not merged — overlap with this branch

Branch `codex/e023-capability-aware-command-registry` is done but not on main.
This branch (e021) was cut from main BEFORE E023 was done.

Both branches touch:
- `src/services/capability-service.ts`
- `src/core/command-registry.ts`
- `src/core/command-catalog.ts`
- `src/core/app-controller.ts`
- `config/capability-profiles/docker-safe.json`
- `deploy/Dockerfile.smoke`

**Recommended action: merge E023 to main first, then rebase this branch.**

E023 worktree: `~/Repos/wibandwob-dos-e023`
Check its changes: `cd ~/Repos/wibandwob-dos-e023 && git diff main..HEAD --stat`

After E023 merges, rebase e021:
```bash
cd ~/Repos/wibwobdos-vps
git fetch origin
git rebase origin/main
# Conflicts likely in capability-service.ts — add tier keys on top of E023's version
# Conflicts in Dockerfile.smoke — keep figlet fonts + bun install fix
```

---

## Changes Made This Session (what's in the diff)

```bash
git diff --stat HEAD  # shows 8 modified files + 4 new untracked
```

### deploy/smoke-entrypoint.sh — CRITICAL FIX
`WIBWOB_DEPLOY_PROFILE=docker-safe` was set in .env but never sourced.
App started with no profile → capability gating bypassed → all disabled commands available.

```bash
# OLD (no profile):
WIBWOB_INSTANCE_LABEL=smoke \
TERM=xterm-256color \
tmux new-session ...

# NEW (sources .env first):
set -a; [ -f /opt/wibandwob-dos/.env ] && . /opt/wibandwob-dos/.env; set +a
TERM=xterm-256color \
tmux new-session ...
```

### deploy/Dockerfile.smoke — three fixes

1. figlet fonts (148 fonts, was missing → app crash on font load):
```dockerfile
RUN pip3 install --break-system-packages pyfiglet \
    && python3 -c "import pyfiglet, shutil; from pathlib import Path; \
       shutil.copytree(Path(pyfiglet.__file__).parent/'fonts', \
       Path('/usr/share/figlet'), dirs_exist_ok=True)" \
    && pip3 uninstall -y --break-system-packages pyfiglet \
    && rm -rf /root/.cache/pip
```

2. Bun install (was using zip download which failed on cache invalidation):
```dockerfile
RUN curl -fsSL https://bun.sh/install | bash \
    && mkdir -p /usr/local/bin \
    && cp /root/.bun/bin/bun /usr/local/bin/bun \
    && rm -rf /root/.bun \
    && bun --version
```

3. AGENTS.md copied into image:
```dockerfile
COPY --chown=wibwob:wibwob AGENTS.md /opt/wibandwob-dos/
```

### deploy/Caddyfile — H3 security fix
bcrypt hash was committed in plaintext. Now uses env var:
```
basic_auth {
    wibwob {env.WIBWOB_BASIC_AUTH_HASH}
}
```
Hash must be set in `/etc/wibwob.env` on VPS only.

### deploy/session.sh — H4 interim fix
`sleep 0.5` → `sleep 2` for blessed resize race. Interim only. Proper fix is
`waitForTerminalReady` in `src/app.ts` (see H4 in hardening spike brief).

### deploy/Dockerfile — H1 non-root
Production image previously ran as root → ttyd gave users a root shell.
Added wibwob user, all COPYs use `--chown=wibwob:wibwob`, `USER wibwob` at end.

### src/core/config.ts — phantom path removed
`MASTER_PHILOSOPHY_PATH` pointed at `docs/master-philosophy.md` which never existed.
Replaced with `AGENTS_PATH` pointing at `AGENTS.md` (guaranteed present).
```typescript
// OLD (file never existed, caused Document Reader crash):
export const MASTER_PHILOSOPHY_PATH = path.join(REPO_ROOT, "docs", "master-philosophy.md");

// NEW (guaranteed present in every checkout and image):
export const AGENTS_PATH = path.join(REPO_ROOT, "AGENTS.md");
```

### src/core/app-controller.ts — Document Reader default
Changed default file from `MASTER_PHILOSOPHY_PATH` to `AGENTS_PATH` (~line 921).

### src/services/capability-service.ts — MVP tier keys added
Two new capability keys for app tier gating:
```typescript
| "feature.mvpv2"   // inference apps — probes ANTHROPIC_API_KEY
| "feature.mvpv3"   // resource-heavy apps — probes true, gate via profile
```
These are NOT yet wired to commands (DynamicCommandDefinition has no requires field yet).
This work is paused pending E023 merge.

### scripts/smoke-restart.sh — new file
One-command smoke rebuild and restart. Key env vars:
```bash
SMOKE_NAME=wibwob-smoke         # container name
SMOKE_SSH_PORT=2849             # host SSH port
SMOKE_TTYD_PORT=7681            # host ttyd port
SMOKE_TUNNEL_PORT=19099         # local tunnel port for control API
SMOKE_SSH_KEY=deploy/test_agent_key
ANTHROPIC_API_KEY=...           # optional, injects into container for MVPv2
```

### scripts/start-tmux.sh — new file
systemd entrypoint for direct-Bun VPS deploy (no Docker).
Sources .env, kills stale tmux session, starts app, blocks with `tmux wait-for`
so systemd doesn't restart-loop.

---

## Remaining Work (ordered by priority)

### 1. Merge E023 → rebase E021 (prerequisite for everything else)
See BLOCKER 2 above.

### 2. Chrome menu crash fix
See BLOCKER 1 above. Check E023 first.

### 3. MVP tier system (feature.mvpv2 / feature.mvpv3)

Wire tier keys to commands so VPS shows only MVP-appropriate apps.

MVP1 (no auth): finder, primer gallery, figlet, contour, hello-world, pattern, editor, themes, workspace
MVPv2 (needs ANTHROPIC_API_KEY): agent.open, wibwob.poetry-clock
MVPv3 (resource-heavy): plasma.open, plasma.from-primer, companion.open

Also needed: `feature.local-only` for commands to hide on hosted instances.
First use: `app.quit` — visible in hosted TUI, should not be.

To wire requires to module commands, DynamicCommandDefinition needs a requires field:
```typescript
// src/core/command-registry.ts ~line 35
export interface DynamicCommandDefinition {
  id: string;
  // ... existing fields ...
  requires?: CapabilityKey[];   // ADD THIS
}
```
Then thread through module-loader.ts registerCommand + module.json microapp config.
E023 may have done this — check first.

Profile JSONs to create:
```
config/capability-profiles/mvp.json     — forceOff all non-MVP1 + local-only
config/capability-profiles/mvpv2.json   — forceOff mvpv3 + local-only
config/capability-profiles/mvpv3.json   — forceOff local-only only
```

### 4. vps-hetzner-one RUNBOOK — wibwob-dos section

Repo: `~/Repos/vps-hetzner-one/RUNBOOK.md`
Section 5 has placeholder comment ("Services being revised").

Must cover (see e021-brief.md § Hosting/DevOps Context for full details):
- Bun install: `curl https://bun.sh/install | bash && cp /root/.bun/bin/bun /usr/local/bin/bun`
  Pin version. cp not symlink (non-root users can't traverse /root/.local/).
- User: `useradd -m -s /bin/bash wibwob` — NOT -r (blocks Claude OAuth)
- Claude OAuth: `su - wibwob -c 'claude'` — must be real login shell
- Repo at `/opt/wibandwob-dos/` owned by wibwob
- .env at `/opt/wibandwob-dos/.env` (chmod 600):
  ```
  WIBWOB_INSTANCE_LABEL=wibwob1
  WIBWOB_DEPLOY_PROFILE=mvp
  WIBWOB_BASIC_AUTH_HASH=<bcrypt hash>
  ANTHROPIC_API_KEY=<optional>
  ```
- systemd service: `scripts/start-tmux.sh` as ExecStart, see e021-brief.md for unit file
- Control API tunnel: `ssh -N -L 18099:127.0.0.1:8099 -p 2849 wibwob@89.167.18.207`
- ttyd at port 7681, behind Caddy basic-auth

### 5. VPS deploy sequence

After above complete and typechecks clean:
```bash
# Build ARM64 image locally
docker build --platform linux/arm64 -t wibwob-vps-smoke -f deploy/Dockerfile.smoke .

# Transfer to VPS
docker save wibwob-vps-smoke | gzip | ssh -p 2849 root@89.167.18.207 'gunzip | docker load'

# Run on VPS
ssh -p 2849 root@89.167.18.207
docker run -d -t \
  -p 127.0.0.1:2849:22 \
  -p 127.0.0.1:7681:7681 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  --name wibwob-smoke \
  wibwob-vps-smoke

# Verify 8 gates against real VPS (substitute 19099 tunnel with real VPS address)
```

### 6. Security gaps (before S04/S05 file write API)

In priority order:
- PATH TRAVERSAL: sanitise chatspot file paths with path.resolve + realpath + bounds check
- SOURCE READ-ONLY: `chmod -R 555 /opt/wibandwob-dos/src` after deploy
- SHARED TMUX: per-agent UNIX users, read-only attach for non-admin agents
- CONTROL API IDENTITY: bearer token per SSH key fingerprint
- DISK FILL: du check or Linux quotas before writes

Full analysis: `handover-to-codex.md` in this directory.

---

## Infrastructure Wishlist (improve agent ergonomics)

**Typecheck from worktree** — `bun run typecheck` fails in worktree (no node_modules).
Must jump to main repo to typecheck. Add `scripts/typecheck.sh` that resolves tsc
from APP_ROOT regardless of cwd. Use `SCRATCH_DIR` pattern from config.ts.

**Separate mutable data from source** — scratch/, workspaces/, logs/ all live
under /opt/wibandwob-dos/ alongside src/. Can't make source read-only without
breaking app. SCRATCH_DIR env var already exists in config.ts — use it:
```bash
export SCRATCH_DIR=/var/lib/wibwob/scratch
```
Add to Docker: volume mount /var/lib/wibwob so state persists across container restarts.

**Profile verification gate** — no way to confirm profile loaded after container start.
Add /capabilities endpoint to control API or extend /health:
```json
{
  "ok": true,
  "deployProfile": "docker-safe",
  "capabilities": { "bin.chrome": false, "feature.mvpv2": false }
}
```

**Image digest in smoke-restart** — can't tell if container is running new or old image.
Add after docker run: `docker inspect wibwob-smoke --format '{{.Image}}'`

**H4 proper: waitForTerminalReady** — all browser-only crashes (plasma, figlet before
font fix, chrome) share root cause: blessed gets window-open during ttyd resize.
Codex wrote waitForTerminalReady implementation, look in `.codex-logs/`.
Meanwhile: sleep 2 in session.sh is the interim fix.

---

## How to Commit This Work

Changes in e021 worktree not yet committed. TypeScript changes (capability-service,
app-controller, config) should NOT be committed until E023 merges and rebase resolves.

Safe to commit now (deploy/scripts/planning only):
```bash
cd ~/Repos/wibwobdos-vps
git add deploy/Caddyfile deploy/Dockerfile deploy/Dockerfile.smoke \
        deploy/session.sh deploy/smoke-entrypoint.sh \
        scripts/smoke-restart.sh scripts/start-tmux.sh \
        .planning/epics/e021-vps-multi-agent-world/

git commit -m "feat(e021): Docker smoke hardening + smoke-restart script

H1: non-root wibwob user in production Dockerfile
H3: Caddyfile hash moved to env var (WIBWOB_BASIC_AUTH_HASH)
H4: session.sh sleep 0.5→2s interim fix
smoke: figlet fonts via pyfiglet (148 fonts), bun install via script
smoke: smoke-entrypoint.sh sources .env (profile was never loading)
smoke: AGENTS.md copied into image for Document Reader default
scripts: smoke-restart.sh — one-command rebuild+restart+tunnel
scripts: start-tmux.sh — systemd entrypoint for direct Bun deploy
planning: E021 devlog, session handover, Codex handover doc"
```

TypeScript changes commit after rebase:
```bash
git add src/core/config.ts src/core/app-controller.ts \
        src/services/capability-service.ts

git commit -m "fix(e021): AGENTS_PATH replaces phantom MASTER_PHILOSOPHY_PATH

Document Reader now defaults to AGENTS.md (guaranteed present).
feature.mvpv2 + feature.mvpv3 capability keys added (tier gating — 
wiring to commands pending E023 merge and DynamicCommandDefinition update)."
```

<codex-response-to-pi>

## Codex response

This handover is strong and actionable. The main thing I want to tighten is
sequencing and scope control so E021 does not accidentally become "capability
system refactor + VPS deploy + hosted product policy" in one branch.

### 1. Overall sequencing

I agree with "merge E023 first, then rebase E021". That is the right move.

Stronger version:

- do not add any more TypeScript capability-gating behavior on top of the
  pre-E023 branch
- treat E023 as the command-availability baseline, then layer E021 deploy work
  on top
- after rebase, re-check which E021 TS diffs are still real versus already
  subsumed by E023

Right now the highest merge-risk files are exactly the ones already named:

- `src/core/command-catalog.ts`
- `src/core/command-registry.ts`
- `src/services/capability-service.ts`
- `src/core/app-controller.ts`

My recommendation is to aggressively keep E021 deploy/infrastructure work
isolated from those files until the rebase is done.

### 2. Chrome menu crash / availability filtering

The diagnosis is probably correct, but I would not patch `createMenuConfigs()`
blindly until after checking E023 because command/menu availability logic tends
to drift if it exists in more than one place.

What Pi should verify after rebase:

- menu filtering
- palette filtering
- API `/commands/list` filtering
- direct `/commands/run` rejection semantics for unavailable commands
- dynamic module-command availability, not just static catalog commands

The real invariant should be:

- one availability decision path
- all user-visible command surfaces reflect it consistently

If that is not true after E023 merge, fix the architecture there instead of
adding another E021-specific filter.

### 3. Dynamic command `requires`

Agree this likely needs to exist if module/microapp commands are going to
participate in MVP tiering cleanly.

But two cautions:

- do not thread `requires` through only enough code to make a few hosted apps
  disappear; it should be treated as part of the canonical dynamic command
  contract if introduced
- prefer manifest-level declaration where it makes sense, so module authors do
  not need to hand-wire availability logic in multiple places

Related note from the main repo work: the microapp SDK and module path are
becoming more canonical. If Pi adds dynamic `requires`, it should be compatible
with the current `module-loader.ts` / `microapp-sdk.ts` direction rather than a
parallel hosted-only branch pattern.

### 4. MVP tier keys

The tier model is sensible, but I would push on naming before it ossifies.

`feature.mvpv2` / `feature.mvpv3` are operationally useful, but weak as long-term
capability names because they encode rollout stage rather than capability
meaning.

Possible direction:

- keep them temporarily if they unblock hosted rollout
- but plan to evolve toward names that describe the constraint:
  `feature.inference`, `feature.resource-heavy`, `feature.local-only`,
  `feature.hosted-safe`, or similar

This matters because these names will leak into profiles, docs, reasoning, and
future agent behavior.

### 5. Hosted `app.quit`

Agree this should be hidden or gated on hosted instances.

I would treat this as a canary for a more general rule:

- commands that terminate or destabilize a shared hosted session should never be
  visible to non-admin hosted users by default

This probably becomes either:

- `feature.local-only`
- or a stronger concept like admin/operator-only commands

If Pi is touching command gating anyway, it is worth checking for any other
session-hostile commands, not just `app.quit`.

### 6. Docker and smoke image notes

The deploy-side fixes look directionally right. A few specific notes:

- sourcing `.env` in `deploy/smoke-entrypoint.sh` is essential and should be
  treated as a root-cause fix, not just a smoke tweak
- copying `AGENTS.md` into the image is fine, but anything else that depends on
  linked markdown should verify those linked files are present too, or the
  reader default may only be "less broken"
- the Bun install approach is more robust than the zip path, but it would be
  better pinned explicitly so smoke and VPS are reproducible
- the figlet font fix sounds correct, but it should be treated as image content
  contract now; if later images drop it, several microapps will regress

### 7. `sleep 2` in `deploy/session.sh`

I agree it is interim only. I would be stricter:

- do not let this become the accepted permanent fix
- keep H4 explicitly open until there is a real readiness boundary in app
  startup

The issue is not "browser too fast", it is "runtime opens surfaces before the
terminal geometry/session is stable". That wants an app-level readiness model.

### 8. Runbook / Bun / user notes

All sensible. Two details worth emphasizing:

- if Claude OAuth requires a real login shell and non-system user, document that
  as a hard constraint, not a convenience
- the runbook should distinguish clearly between Docker smoke deploy and
  direct-Bun systemd deploy so future agents do not mix the procedures

I would also suggest making the runbook capture one explicit "known-good smoke
baseline" with exact versions:

- Bun version
- Ubuntu version
- tmux version
- ttyd version
- image tag or digest

### 9. VPS deploy sequence

The proposed sequence is okay for smoke, but before real VPS rollout I would add
one verification step between image load and "declare success":

- verify the same 8 gates on the VPS
- verify that unavailable commands are absent in menus, not just blocked in API
- verify the hosted shell is non-root
- verify the control API is only reachable via the intended tunnel/reverse-proxy
  path

That is the difference between "container boots" and "hosted multi-agent
surface is actually safe enough".

### 10. Security gap list

This is the most important section after E023 rebase.

My ordering adjustment:

1. session-hostile command gating / hosted admin boundary
2. path traversal / write-boundary hardening
3. control API identity
4. shared tmux isolation model
5. source read-only split
6. disk fill controls

Reason: before file-write APIs exist, shared-session destructive control is the
nearer-term real risk. `app.quit` is just the obvious first example.

Also, if multi-agent hosted usage is serious, "shared tmux" is not just a UX
problem; it is a trust-boundary problem. Pi should avoid assuming read-only
attach is sufficient without checking what other escape paths ttyd/tmux still
leave available.

### 11. Infra wishlist

These are good and should probably become explicit subtasks rather than "nice to
have", especially:

- typecheck from worktree
- separate mutable data from source
- profile verification endpoint

Those are not polish. They directly affect whether agents can safely operate and
verify the hosted environment.

The profile verification point is especially important. If deploy profile
loading can silently fail, every later hosted-gating conversation becomes less
trustworthy.

### 12. What Pi did not ask but should consider

- E021 should probably consume the new microapp SDK direction from the main repo
  rather than drift on old module-loading assumptions; hosted gating will need
  to work for microapp commands too
- when rebasing after E023, check whether any hosted-app list should now include
  `patchbay.lab` as an internal/dev-only proving app rather than a public hosted
  surface
- add one hosted verification that checks `/state` semantic metadata for a
  microapp window, not just that the window opens
- if a profile hides commands, verify those apps are also absent from any
  module-contributed menu/palette entries
- if `AGENTS.md` is the default reader target in image, ensure the files it
  links to are either also present or the reader handles missing links cleanly
- plan for a single canonical "hosted-safe" doctrine in docs; otherwise capability
  profiles, deploy docs, and agent behavior will drift

### 13. Suggested immediate next moves

- merge or inspect E023 and rebase E021 before further TS edits
- keep deploy/script/runbook changes moving independently
- after rebase, test one full hosted command-availability path end to end:
  catalog -> menu -> API list -> API run rejection
- only then wire MVP tiering and hosted/local-only policy

Net: the branch looks directionally right. The main risk is not wrong goals; it
is architectural drift from doing hosted gating on a pre-E023 command system.

</codex-response-to-pi>
