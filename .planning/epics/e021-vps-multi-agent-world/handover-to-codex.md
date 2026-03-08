# E021 VPS Deploy — Handover to Codex
**Date:** 2026-03-08
**From:** Claude (pi agent, worktree wibwobdos-vps, branch epic/e021-vps-multi-agent-world)
**To:** Codex agent (currently on codex/e023-capability-aware-command-registry)
**Status:** WORK PAUSED pending E023 merge to main

---

## CRITICAL: Merge Situation — Read First

Two branches have concurrent changes to overlapping files:

| File | E023 (Codex) | E021 (Claude) |
|------|-------------|---------------|
| `src/services/capability-service.ts` | Full rewrite — CapabilityKey, probe, profile | Added feature.mvpv2, feature.mvpv3 keys |
| `src/core/command-registry.ts` | Menu filter for unavailable commands (suspected) | Was about to add same fix (Chrome crash) |
| `src/core/command-catalog.ts` | Requires fields on commands | Chrome fix pending |
| `src/core/app-controller.ts` | Capability-related changes | MASTER_PHILOSOPHY_PATH → AGENTS_PATH |
| `config/capability-profiles/docker-safe.json` | Profile changes | Added feature.mvpv2/mvpv3 forceOff |
| `deploy/Dockerfile.smoke` | Smoke image changes | figlet fonts, bun install fix, AGENTS.md copy |
| `src/core/config.ts` | Unknown | MASTER_PHILOSOPHY_PATH removed, AGENTS_PATH added |

E023 is DONE but NOT merged to main. E021 is branched from main without E023's changes.

**Recommended order:**
1. Codex merges E023 to main (or James does)
2. E021 worktree rebases onto new main: `git rebase main` in `~/Repos/wibwobdos-vps`
3. Resolve conflicts (most will be additive, not destructive)
4. Resume E021 work from the rebased base

**E021 TypeScript changes that will need reconciling after rebase:**
- `src/core/config.ts` — MASTER_PHILOSOPHY_PATH constant removed, AGENTS_PATH added. If E023 didn't touch this file, applies cleanly.
- `src/core/app-controller.ts` line ~921 — default filePath changed from MASTER_PHILOSOPHY_PATH to AGENTS_PATH. Minor, reconcilable.
- `src/services/capability-service.ts` — feature.mvpv2 and feature.mvpv3 keys added. E023 has already restructured this file. Will need manual merge to add the tier keys on top of E023's version.

**E021 non-TypeScript changes (safe regardless of merge order):**
- `deploy/Dockerfile.smoke` — figlet fonts via pyfiglet, bun install via script, AGENTS.md copy
- `deploy/Caddyfile` — H3 hash moved to env var
- `deploy/session.sh` — H4 sleep 0.5→2s
- `deploy/Dockerfile` — H1 non-root wibwob user
- `deploy/smoke-entrypoint.sh` — sources .env before tmux launch (CRITICAL — profile wasn't loading)
- `scripts/smoke-restart.sh` — new script (rebuild + restart + tunnel in one command)
- `scripts/start-tmux.sh` — new script (systemd entrypoint for VPS direct deploy)
- `.planning/` — devlog, this handover doc

---

## What E021 Has Done (Docker smoke, system-level)

### Completed and verified

**smoke-entrypoint.sh — profile env fix**
WIBWOB_DEPLOY_PROFILE was in .env but entrypoint never sourced it. App started
without capability profile → all gating bypassed. Fixed: `set -a; . .env; set +a`
before tmux launch. Now profile loads on container start. Verified: instance label
and deploy profile visible in running container .env.

**Dockerfile.smoke — figlet fonts**
148 figlet fonts added via pyfiglet during build. Fonts copied to /usr/share/figlet.
Previously: `figlet -f binary` failed with "Unable to open font file" → app crash.
Now: all catalog fonts available.

**Dockerfile.smoke — bun install method**
Changed from direct zip download to `curl https://bun.sh/install | bash` + cp to
/usr/local/bin/bun. Previous zip method failed when layer cache was invalidated
(cp: cannot create regular file '/usr/local/bin/bun': directory missing). Install
script is more robust and matches VPS runbook pattern.

**Dockerfile.smoke — AGENTS.md**
AGENTS.md now copied into image. Document Reader defaults to AGENTS_PATH.
Previously defaulted to phantom MASTER_PHILOSOPHY_PATH (docs/master-philosophy.md
which never existed) → crash on open.

**Caddyfile — H3 hash moved to env**
bcrypt hash was hardcoded in repo. Now: `{env.WIBWOB_BASIC_AUTH_HASH}`.
Must be set in /etc/wibwob.env on VPS. Not committed.

**session.sh — H4 sleep**
0.5s → 2s. Interim fix for resize race. Proper fix (waitForTerminalReady) still
needed.

**Dockerfile — H1 non-root**
Production image now creates wibwob user, runs as non-root. Pattern ported from
Dockerfile.smoke. Claude CLI bypassPermissions is blocked for root — this is
a hard requirement for any Claude Code subprocess.

**scripts/smoke-restart.sh — new**
One command: stop container, rebuild (optional --no-build flag), start, wait for
SSH+tmux, establish tunnel, poll health, print connection info.
Config via env vars: SMOKE_NAME, SMOKE_SSH_PORT, SMOKE_TTYD_PORT, SMOKE_TUNNEL_PORT,
SMOKE_SSH_KEY, ANTHROPIC_API_KEY (injected if set, enables MVPv2 features).

**scripts/start-tmux.sh — new**
systemd entrypoint for direct Bun deploy (no Docker). Sources .env, kills stale
tmux session, starts new one, blocks with `tmux wait-for` so systemd tracks it.

### Human smoke test results (local Docker, 2026-03-08)

All MVP1 apps verified working:
- File Manager ✓, Primer Gallery ✓, Figlet Banner ✓, Contour Studio ✓
- Hello World ✓, WibWobWorld (all 4 views) ✓, World Chatroom ✓
- Pattern Window ✓, Command Palette ✓
- Window drag/resize/tile/cascade ✓, Multiple windows ✓
- 5 min idle stability ✓, API parity ✓

Known issues:
- Chrome Browser crashes app from browser/ttyd (bin.chrome gated but menu still shows it — BLOCKER for VPS)
- Plasma crashes from browser (H4 resize race — MVPv3, profile-gate acceptable)
- File → Quit visible on hosted instances (should be hidden)
- All crashes are browser-triggered only; API-triggered never crashes = H4 root cause

---

## What Still Needs Doing (E021 punch list)

### BLOCKER: Chrome must be hidden from menu before VPS deploy

Commands with unmet `requires` are correctly blocked at execution but still appear
in menus. When user clicks Chrome from Applications menu → app crashes entirely.

**Where to fix:** `createMenuConfigs()` in `src/core/command-catalog.ts` needs
to filter commands by `capabilityService.isAvailable(command.requires).ok` before
adding to menu items. Similarly `buildMenus()` in command-registry.ts for dynamic
commands.

E023 may have already done this (it was in scope). Check `createMenuConfigs` in
E023's branch before reimplementing.

### Tier system: feature.mvpv2 / feature.mvpv3 capability keys

User defined MVP app tiers for VPS deployment. Needs two new CapabilityKey values:

```
feature.mvpv2  — inference-required apps (agent.open, wibwob.poetry-clock)
                 probes against ANTHROPIC_API_KEY
feature.mvpv3  — resource-heavy apps (plasma.open, plasma.from-primer, companion.open)
                 probes true always; controlled via profile forceOff
```

MVP tier map:
```
MVP1 (no auth needed):
  finder.open, primer_gallery.open, figlet.open, contour.open,
  example.hello-world, pattern.open, primer.browse, editor.open,
  workspace.*, theme.*, window.*, desktop.*

MVPv2 (needs ANTHROPIC_API_KEY):
  agent.open                   requires: ["feature.mvpv2"]
  microapp.wibwob.poetry-clock requires: ["feature.mvpv2"]

MVPv3 (resource-heavy + inference):
  plasma.open                  requires: ["feature.mvpv3"]
  plasma.from-primer           requires: ["feature.mvpv3"]
  companion.open               requires: ["feature.mvpv3"]
```

Also needed: `feature.local-only` capability key. Commands that should never appear
on hosted instances get `requires: ["feature.local-only"]`. Profile forceOff in
docker-safe. First use: `app.quit` (File → Quit visible on VPS — confusing).

**Thread `requires` through module-registered commands:**
`DynamicCommandDefinition` in command-registry.ts has no `requires` field. Module
commands (poetry-clock, hello-world, wibwobworld) can't declare capability requirements.
Need: add `requires?: CapabilityKey[]` to DynamicCommandDefinition, thread through
module-loader.ts registerCommand, support `requires` in module.json microapp config.
E023 may have already done this — check before reimplementing.

### Profile JSONs to create

```
config/capability-profiles/mvp.json     — forceOff: [feature.mvpv2, feature.mvpv3, feature.local-only, bin.chrome, path.monster_cam.venv, path.backrooms.repo]
config/capability-profiles/mvpv2.json   — forceOff: [feature.mvpv3, bin.chrome, path.monster_cam.venv, path.backrooms.repo]
config/capability-profiles/mvpv3.json   — forceOff: [bin.chrome, path.monster_cam.venv, path.backrooms.repo]
```

Current docker-safe.json should become an alias or inherit from mvp.json.

### vps-hetzner-one RUNBOOK — wibwob-dos section

Not written yet. Repo at `~/Repos/vps-hetzner-one/RUNBOOK.md`.
Section 5 placeholder exists ("Services across sy/wibwob/scramble being revised").

Must cover:
- Bun install (pin version, cp not symlink to /usr/local/bin/)
- wibwob user creation (`useradd -m -s /bin/bash wibwob`)
  NOTE: NOT -r (system users block Claude OAuth interactive flow)
- Claude OAuth for wibwob user (must be real login shell: `su - wibwob -c 'claude'`)
- Repo checkout at /opt/wibandwob-dos/, correct ownership
- .env file location, required vars (WIBWOB_INSTANCE_LABEL, WIBWOB_DEPLOY_PROFILE,
  ANTHROPIC_API_KEY optional, WIBWOB_BASIC_AUTH_HASH for Caddy)
- Docker image build + transfer OR direct Bun deploy (document both)
- Control API SSH tunnel pattern
- systemd service install (scripts/start-tmux.sh + services/wibwob-dos.service)
- ttyd access (port 7681, Caddy basic-auth)
- Restart procedure

Also need: `~/Repos/vps-hetzner-one/services/wibwob-dos.service` created.

### Security gaps before opening to external agents (S04/S05 prerequisites)

**PATH TRAVERSAL** (critical before any file write API)
Agent sends ../../../etc/passwd as chatspot file path. No sanitisation yet.
Fix: `path.resolve()` + assert result starts with allowed chatspot root.
Add `fs.realpath()` after resolve to catch symlink escapes.

**SOURCE OVERWRITE**
wibwob user owns /opt/wibandwob-dos/src. Shell-access agent can overwrite source,
trigger restart, run arbitrary code.
Fix: after deploy, `chmod -R 555 /opt/wibandwob-dos/src` or separate root ownership.

**SHARED TMUX SESSION**
Any SSH agent attaches to same tmux session as human and other agents. Full TUI
control, can type commands, close windows, read screen.
Fix: per-agent UNIX users + `tmux attach -r` (read-only) for non-admin agents.

**CONTROL API — no per-request identity**
All agents tunnel to same 8099 port, no Authorization header. Any agent with tunnel
can run destructive commands (clear desktop, close windows).
Fix: bearer token per agent SSH key, mapped in /opt/wibandwob-dos/.env.
Or: UNIX-user model — per-agent processes, OS enforces.

**DISK FILL**
No quota on chatspot folder writes. Agent fills /opt partition.
Fix: du check before writes, or Linux quotas on /opt.

---

## Infrastructure Wishlist / Agent Ergonomics PRD

Things that would make agent work on this codebase materially easier.
Prioritised. For Codex to consider during refactor or as separate work.

### P0 — Typecheck works from any worktree

**Problem:** `bun run typecheck` in worktree fails — tsc not found, node_modules
not present. Agent must cd to main repo to typecheck, then return to worktree.
Breaks the "work in worktree, verify in place" loop.

**Fix:** Either ensure worktrees share node_modules via symlink or bun workspaces,
or add a `scripts/typecheck.sh` that resolves tsc from APP_ROOT regardless of cwd.

```bash
# scripts/typecheck.sh
#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/node_modules/.bin/tsc" --noEmit --project "$ROOT/tsconfig.json"
```

Add to package.json: `"typecheck": "bash scripts/typecheck.sh"`

### P0 — Menu hides unavailable commands

**Problem:** Commands with unmet `requires` are blocked at run-time but still appear
in menus. User clicks → crash. Chrome is the live example. This is a correctness
bug, not a polish issue. Crashes the container.

**Fix:** Filter in `createMenuConfigs()` and `buildMenus()` against capabilityService.
E023 may have already done this — verify before reimplementing.

### P1 — Dockerfile.smoke copies docs/ selectively

**Problem:** docs/ not in image. Any code referencing docs/ paths fails.
MASTER_PHILOSOPHY_PATH was the live case.

**Fix (immediate):** MASTER_PHILOSOPHY_PATH replaced with AGENTS_PATH (done in e021).
**Fix (proper):** Either don't reference docs/ from app code, or add `COPY --chown=wibwob:wibwob docs /opt/wibandwob-dos/docs` to Dockerfile.smoke.

Recommend: audit all constants in config.ts for paths that don't exist in the image.
Add a startup check: if referenced default path doesn't exist, warn and use README_PATH.

### P1 — Smoke image digest visible after restart

**Problem:** After `smoke-restart.sh`, no way to tell if running container is from
new or old image without manual docker inspect. Caused confusion during this session
(ran gates against stale image, got wrong results).

**Fix:** Print image digest/ID in smoke-restart.sh output after container starts.
```bash
IMAGE_ID=$(docker inspect wibwob-smoke --format '{{.Image}}' | cut -c1-12)
echo "[smoke] image: $IMAGE_ID"
```

### P1 — Docker data volume outside app directory

**Problem:** All mutable data (scratch/, workspaces/, logs/) lives under
/opt/wibandwob-dos/ alongside source. Consequences:
1. Source can't be made read-only without breaking the app
2. Docker bind mounts for persistence are awkward (mount whole app or nothing)
3. Upgrade = stop container, replace source, lose scratch state OR carefully preserve it
4. Agent shell access to src/ is a security gap

**Fix:** Separate mutable data to /var/lib/wibwob/ (or /home/wibwob/data/).
Use SCRATCH_DIR env var (already supported in config.ts) to point scratch/ outside
the app directory.

```bash
# In smoke-entrypoint.sh and systemd service:
export SCRATCH_DIR=/var/lib/wibwob/scratch

# In docker-compose.yml:
volumes:
  - wibwob_data:/var/lib/wibwob

# In Dockerfile.smoke:
RUN mkdir -p /var/lib/wibwob && chown wibwob:wibwob /var/lib/wibwob
```

Then: `chmod -R 555 /opt/wibandwob-dos/src` after deploy — source is read-only,
agents can't overwrite it even with shell access.

### P1 — Capability profile verified after container start

**Problem:** No smoke gate confirms the profile actually loaded. Profile loading
is silent — wrong env var name, wrong profile filename, or sourcing failure all
result in no profile, no warning, all commands ungated.

**Fix:** Add /capabilities endpoint to control API (or extend /health) that returns
the current capability snapshot including source (probe vs profile-force).
Then add gate to smoke-restart.sh:

```bash
# Verify docker-safe profile is active
CAPS=$(curl -s http://127.0.0.1:${TUNNEL}/capabilities)
if echo "$CAPS" | grep -q '"source":"profile-force-off"'; then
  echo "[smoke] profile: active"
else
  echo "[smoke] WARN: profile may not have loaded"
fi
```

### P2 — /health returns deploy profile and capability summary

**Problem:** /health returns {ok, port, instanceLabel, sessionId}. Agents can't
tell which profile is active, what capabilities are available, or whether
ANTHROPIC_API_KEY is set without additional calls.

**Fix:** Add to /health response:
```json
{
  "ok": true,
  "instanceLabel": "smoke",
  "deployProfile": "docker-safe",
  "capabilities": {
    "bin.figlet": true,
    "bin.chrome": false,
    "env.anthropic_api_key": false,
    "feature.mvpv2": false
  }
}
```

Agents can then self-configure based on what's available without querying
a separate endpoint.

### P2 — smoke-restart.sh detects stale tunnel

**Problem:** If a previous tunnel process is still running on the port, the new
tunnel silently fails or conflicts. Agent gets stale responses.

**Fix:** Already partially fixed (pkill before ssh -fN). But confirm the new
tunnel is actually connected before printing READY. Health poll via tunnel does
this implicitly — make it explicit.

### P3 — H4 proper: waitForTerminalReady in app.ts

**Problem:** blessed initialises before ttyd sends terminal dimensions via WebSocket.
All windows opened during/after this period may get wrong dimensions → crash.
Pattern observed: Chrome, Plasma, and Figlet (before font fix) all crashed from
browser but not API. API doesn't send resize events.

**Fix:** Codex wrote implementation in .codex-logs/ — search for waitForTerminalReady.
Pattern: listen for SIGWINCH, wait for stable dimensions before allowing
`screen.render()` and window open operations.
Session.sh sleep 2 is interim. Not sufficient for slow connections or slow machines.

### P3 — Agent identity in control API

**Problem:** All agents tunnel to same port 8099. HTTP requests have no per-agent
identity. Dangerous commands (clear desktop, close all windows) can be run by any
agent with tunnel access.

**Fix options (in order of implementation complexity):**
A. Bearer token in Authorization header, mapped from SSH key fingerprint via .env
B. Per-agent API instances on different ports (heavy)
C. UNIX-user model: each agent gets own Linux user, own tunnel, OS enforces isolation

Option A is minimum viable. Key fingerprint from `ssh-keygen -lf key.pub`, store
in .env as `AGENT_TOKEN_<fingerprint>=<instanceLabel>`, validate on each request.

---

## Recommended Next Steps for Codex

1. Merge E023 to main — it's marked done. Main is blocking E021 rebase.

2. After merge, check whether E023 already fixed:
   - Menu filtering for unavailable commands (Chrome crash fix)
   - DynamicCommandDefinition requires field threading
   - /capabilities or /health capability exposure

3. Rebase E021 onto new main:
   ```bash
   cd ~/Repos/wibwobdos-vps
   git fetch origin
   git rebase origin/main
   # Resolve conflicts in capability-service.ts (add tier keys on top of E023)
   # Resolve conflicts in Dockerfile.smoke (keep figlet fonts + bun install fix)
   # config.ts: keep AGENTS_PATH, drop MASTER_PHILOSOPHY_PATH
   ```

4. After rebase: implement remaining E021 blockers:
   - feature.mvpv2 / feature.mvpv3 tier keys (if E023 didn't add them)
   - Profile JSONs (mvp, mvpv2, mvpv3)
   - DynamicCommandDefinition requires threading (if E023 didn't do it)
   - RUNBOOK.md wibwob-dos section in vps-hetzner-one
   - wibwob-dos.service systemd unit

5. VPS deploy sequence (after all above green):
   - Build ARM64 image on local machine
   - Transfer via docker save | gzip | scp or build directly on VPS
   - Run with correct env vars (WIBWOB_BASIC_AUTH_HASH, ANTHROPIC_API_KEY optional)
   - Verify 8 gates on real VPS
   - Fresh agent onboarding test

6. Infrastructure wishlist (separate from E021, but high value):
   - Separate mutable data to /var/lib/wibwob/ (SCRATCH_DIR support already in config.ts)
   - Typecheck from any worktree
   - /health capability summary
   - Profile verification gate in smoke script
