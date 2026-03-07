# E021 Next Session Plan — VPS Smoke Deploy + Agent Onboarding

## Session Goal
Deploy the proven Docker smoke runtime to the real Hetzner VPS, keep control API private via SSH tunnel, and validate that a fresh agent can operate WibWob-DOS remotely using only `.pi/skills/wibwobdos` while a human monitors ttyd in-browser.

## Current Truth (Start Here)
- Docker smoke stack is green locally (all 8 gates passed).
- VPS target: `89.167.18.207`, SSH port `2849`, Ubuntu 24.04, ARM64.
- Required precondition before deploy: define a Docker-safe app list/profile so known-broken commands are hidden/disabled.
- Not done yet:
1. Docker-safe app list profile.
2. Caddy/TLS/basic-auth hardening for public ttyd exposure.
3. Per-agent UNIX users (current model is shared `wibwob` user + key-level identity only).

## Non-Negotiable Constraints
1. Keep control API bound to `127.0.0.1:8099` inside container/VPS; never expose it publicly.
2. Reach control API only through SSH tunnel (`connect.sh` already does this).
3. If exposing ttyd beyond localhost, place it behind Caddy basic auth.
4. Use SSH keys only; no password auth.

## Ordered Task List (Agent-Executable)

### 1. Confirm repo + host assumptions
1. Ensure you are on `wibandwob-dos` branch intended for this session.
2. Confirm VPS runbook repo is available locally (`~/Repos/vps-hetzner-one`).
3. Confirm SSH access to VPS still works.

Verification:
```bash
git rev-parse --abbrev-ref HEAD
ssh -p 2849 root@89.167.18.207 'uname -a && arch && whoami'
```

### 2. Implement Docker-safe app list/profile (blocker)
1. Add a smoke/VPS profile that excludes known unstable features:
- Monster Cam (crashes; requires Python/MediaPipe).
- Poetry Clock sentient/liminal/terrain modes unless `ANTHROPIC_API_KEY` is present.
2. Wire the profile so command registry/API list reflects only safe commands in smoke deployment.
3. Document profile switch/env var in both app repo and `vps-hetzner-one` runbook.

Verification:
```bash
bun run typecheck
# launch local smoke container and inspect command list via tunnel
curl -s http://127.0.0.1:19099/commands/list | rg -n 'monster|poetry|clock|safe|profile'
```

Exit criteria:
- Broken commands are absent or explicitly guarded with actionable error messages.

### 3. Update vps-hetzner-one runbook (do before deploying)

The resurrection doc at `~/Repos/vps-hetzner-one/RUNBOOK.md` has no wibwob-dos
section yet. Per the E021 invariant, any VPS setup steps must land there before
the service is running — so the VPS can be rebuilt from zero without tribal knowledge.

Also add a systemd service file at `~/Repos/vps-hetzner-one/services/wibwob-dos.service`.

1. Add a **wibwob-dos section** to RUNBOOK.md covering:
   - Bun install (pin version, `cp` not symlink to `/usr/local/bin/`)
   - `wibwob` user creation (`useradd -m -s /bin/bash wibwob`)
   - Claude OAuth for the wibwob user (`su - wibwob -c 'claude'`)
   - Repo checkout at `/opt/wibandwob-dos/` with correct ownership
   - `.env` file location, required vars, secrets pattern
   - Docker image build + run command (or direct Bun run — document both)
   - Control API SSH tunnel pattern (copy from `.pi/skills/wibwobdos/references/connection.md`)
   - ttyd access (port 7681, Caddy basic-auth path)
   - Restart procedure: `docker rm -f wibwob-smoke && docker run ...`

2. Add `services/wibwob-dos.service` (systemd unit for direct Bun deploy path):
```ini
[Unit]
Description=WibWob-DOS TUI Desktop Shell
After=network.target

[Service]
Type=simple
User=wibwob
WorkingDirectory=/opt/wibandwob-dos
EnvironmentFile=/opt/wibandwob-dos/.env
ExecStart=/opt/wibandwob-dos/scripts/start-tmux.sh
ExecStop=/usr/bin/tmux kill-session -t wibwob
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

3. Add `scripts/start-tmux.sh` to the app repo (used by systemd):
```bash
#!/bin/bash
tmux new-session -d -s wibwob -x 320 -y 79 \
  /usr/local/bin/bun run /opt/wibandwob-dos/src/app.ts
tmux wait-for wibwob   # blocks — keeps systemd tracking the process
```

4. Commit and push `vps-hetzner-one` before touching the live VPS.

Verification:
```bash
cd ~/Repos/vps-hetzner-one
grep -n "wibwob-dos" RUNBOOK.md | head -5   # section exists
ls services/wibwob-dos.service               # service file exists
git log --oneline -1                          # committed
```

### 4. Build and transfer VPS smoke image
1. Build ARM64 image from `deploy/Dockerfile.smoke`.
2. Package image and transfer to VPS (or build directly on VPS if preferred).
3. Load image on VPS and stop any prior conflicting container.

Verification:
```bash
# local build
docker build --platform linux/arm64 -t wibwob-vps-smoke -f deploy/Dockerfile.smoke .

# example transfer path
docker save wibwob-vps-smoke | gzip > /tmp/wibwob-vps-smoke.tar.gz
scp -P 2849 /tmp/wibwob-vps-smoke.tar.gz root@89.167.18.207:/tmp/
ssh -p 2849 root@89.167.18.207 'gunzip -c /tmp/wibwob-vps-smoke.tar.gz | docker load'
```

### 5. Run container on VPS with private API and ttyd
1. Start container with SSH on host port `2849` (or alternate if host SSH already occupies 2849; adjust mapping explicitly).
2. Keep API internal (`127.0.0.1:8099` inside container; no host publish).
3. Expose ttyd only as needed:
- Preferred: bind `127.0.0.1:7681` and front with Caddy.
- Temporary smoke: bind public `:7681` only for short controlled testing.
4. Inject optional secrets when needed (`ANTHROPIC_API_KEY`) via `docker run -e`.

Verification:
```bash
ssh -p 2849 root@89.167.18.207 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
ssh -p 2849 root@89.167.18.207 'docker logs --tail=120 wibwob-smoke'
```

### 6. Provision new agent SSH key for VPS
1. Generate a dedicated keypair for the new agent identity.
2. Add public key to `/home/wibwob/.ssh/authorized_keys` in the running environment.
3. Label the key comment with principal name (`agent-<name>-<origin>`).

Verification:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/agent_vps_new -C 'agent-fresh-claude-vps'
ssh -i ~/.ssh/agent_vps_new -p 2849 wibwob@89.167.18.207 'whoami && tmux ls'
```

### 7. Verify the 8 gates on the real VPS
Run all gates against VPS, not localhost container.

Verification:
```bash
# GATE1: SSH key auth
ssh -i ~/.ssh/agent_vps_new -p 2849 wibwob@89.167.18.207 'echo ok'

# GATE2: password auth blocked
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -p 2849 wibwob@89.167.18.207
# expect: permission denied

# GATE3: tmux session live
ssh -i ~/.ssh/agent_vps_new -p 2849 wibwob@89.167.18.207 'tmux has-session -t wibwob'

# GATE4/GATE6: health + state + commands via tunnel
ssh -fN -i ~/.ssh/agent_vps_new -p 2849 -L 19099:127.0.0.1:8099 wibwob@89.167.18.207
curl -s http://127.0.0.1:19099/health
curl -s http://127.0.0.1:19099/state
curl -s http://127.0.0.1:19099/commands/list

# GATE5: direct API should fail from non-tunnel path
curl -sS --max-time 2 http://89.167.18.207:8099/health
# expect: connection refused/timeout

# GATE7: open WibWobWorld
curl -s -X POST http://127.0.0.1:19099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open","args":{}}'

# GATE8: ttyd web frontend
curl -s http://89.167.18.207:7681 | rg -n 'xterm|ttyd|websocket'
```

Exit criteria:
- All 8 gates pass and are logged in session notes with timestamps.

### 8. Fresh-agent skill onboarding test (critical)
1. Start a fresh Claude/Codex instance with no prior VPS context.
2. Give only the onboarding script below.
3. Agent must connect via `.pi/skills/wibwobdos`, list commands, open a window, send input, and export state.
4. Human observes ttyd frontend and confirms remote actions are visible.

Verification:
```bash
# from fresh agent machine after onboarding
bash .pi/skills/wibwobdos/scripts/connect.sh
bash .pi/skills/wibwobdos/scripts/state.sh
bash .pi/skills/wibwobdos/scripts/open.sh microapp.wibwobworld.open
bash .pi/skills/wibwobdos/scripts/send.sh <window-id> "hello from fresh agent"
bash .pi/skills/wibwobdos/scripts/export.sh <window-id>
```

Exit criteria:
- Fresh agent succeeds with only skill docs + env vars.

### 9. Optional Caddy hardening pass (if exposing ttyd publicly)
1. Put ttyd behind Caddy route with basic auth.
2. Keep ttyd bound localhost-only where possible.
3. Add HTTPS certificate path (Let’s Encrypt) and document renewal assumptions.

Verification:
```bash
# unauthenticated should get 401
curl -I https://<host>/tui
# authenticated should return 200
curl -I -u '<user>:<pass>' https://<host>/tui
```

## Human Monitoring Checklist (Browser Observer)
Use while the remote agent is driving via API/skill.

1. Browser opens and stays connected to ttyd without refresh loops.
2. Top bar/session label remains stable (no repeated app restarts).
3. Window opens requested by agent actually appear (e.g. WibWobWorld).
4. Focus changes match commanded operations (no stuck focus).
5. Text input appears exactly once (no duplicated sends).
6. No obvious rendering corruption after agent actions (drag/open/close/send).
7. API-driven actions are visible within 1-2 seconds in the TUI.
8. If crash/freeze occurs, capture timestamp + last action + screenshot immediately.

## Fresh Agent Onboarding Script (Literal Prompt)
Paste this to the fresh Claude/Codex instance:

```text
You are operating a remote WibWob-DOS instance on a VPS using the existing skill at `.pi/skills/wibwobdos`.

Use only the skill workflow. Do not assume VPS internals. The tunnel script handles API access.

Set:
- WIBWOB_HOST=89.167.18.207
- WIBWOB_PORT=2849
- WIBWOB_SSH_KEY=~/.ssh/agent_vps_new

Then run, in order:
1) eval "$(bash .pi/skills/wibwobdos/scripts/connect.sh)"
2) bash .pi/skills/wibwobdos/scripts/state.sh
3) bash .pi/skills/wibwobdos/scripts/open.sh --list
4) bash .pi/skills/wibwobdos/scripts/open.sh microapp.wibwobworld.open
5) bash .pi/skills/wibwobdos/scripts/state.sh and report the window id you opened
6) bash .pi/skills/wibwobdos/scripts/export.sh <that-window-id>

After each step, report exact command + concise result.
If a step fails, debug using the same skill scripts first, then report blocker and smallest fix.
```

## Evidence to Capture in Session Notes
1. Command transcript of all 8 gate checks.
2. `/health` JSON and `/state` excerpt showing opened world window.
3. Screenshot or short screen recording of ttyd during remote control.
4. Public key fingerprint and key comment for the provisioned fresh agent.
5. Any deviations from plan (ports, users, auth model) with reason.

## Known Risks and Honest Status
1. Docker-safe app list is still pending and should be completed before production-like VPS smoke.
2. ttyd public exposure without Caddy auth is acceptable only for brief controlled testing.
3. Per-agent UNIX user isolation is not implemented yet; current shared session model is cooperative, not hard multi-tenant isolation.
