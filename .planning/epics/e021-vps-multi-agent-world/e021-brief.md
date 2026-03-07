---
Status: in-progress
Type: epic
Epic: e021-vps-multi-agent-world
---

<human-prompt>
So I want to think about the next step in this. Once this world component is working and it has a multi-agent chat room. I want to attach the locations of the chat positions and correlate them to folders of a shared Linux server. And that would mean that to put files into a server. The agents would need to navigate in the Wibwob World 3D space to reach that chat point, which can cause a server on the folder, and then they can then write to files in that folder or interact with whatever's in that folder. To do that, we'll need to serve up WebWob DOS on a VPS. We'll need to allow multiple agents to chat to it. Don't worry about that side assume that's a solved problem. We've got another agent working on that currently. And the IRC infrastructure for that multi-agent. I'm thinking more about the hardening of the VPS. And how we enable WebWobDAS to be available to agents at on other computers like so far the agents are running on my computer, likely what if one of the agents is running on the VPS itself, and what if another agent is running on a friend's computer. I guess they could all just use the terminal, right? We don't need a web view, but we need terminal views, multiple agents and some kind of authorization. Maybe we just use M variables for that initially, or there's a key or SSH keys. Could you first of all compile this into a new epic folder of the dot planning and then put what I've just written full as the raw human prompt inside XML tags at the top of that.
</human-prompt>

# E021 — VPS Multi-Agent World

## Concept

WibWobWorld chatspots become spatial mounts into a shared VPS filesystem: each chatspot/channel maps to a server directory, and agents must navigate/join that chatspot in-world before they can read or write files in the mapped path; WibWob-DOS runs on a Linux VPS and is operated through terminal sessions over SSH (no webview), with IRC treated as already solved and this epic focused on VPS hardening, remote terminal/control access, authorization, and deterministic chatspot-to-folder binding.

## Scope

In:
- Linux VPS baseline for running Bun + WibWob-DOS continuously.
- Remote terminal access model for multiple agents via SSH.
- VPS-layer identity and authorization model (agent principals, key ownership, revocation path).
- Remote-safe control API access path for agents (`/health`, `/state`, `/commands/*`, world/chat endpoints).
- Chatspot-to-folder binding contract and enforcement when joining/leaving spots.
- Agent-visible/API-visible state for active mount/binding and permission status.

Out:
- IRC server/client infrastructure and protocol behaviour from E020.
- Multi-agent chat relay semantics over IRC.
- New web UI/webview transport.
- General-purpose distributed filesystem design beyond chatspot-scoped directory access.

## Open Questions

- Is chatspot→folder binding static (world-gen/snapshot time) or mutable at runtime via API/command?
- Does binding key on `chatspotId`, `channelId`, or `worldKey + chatspotId` for deterministic restore?
- What minimum role model is needed (`read`, `write`, `admin`) and who grants/revokes it?
- Is membership-only write enough, or must write additionally require explicit per-agent ACL?
- How does a remote agent “navigate”: full TUI control over SSH only, control API only, or both with parity guarantees?
- How is remote control API exposure secured: SSH tunnel, private VPN, or restricted public listener with auth?
- Where is agent identity source-of-truth: Linux user, SSH key fingerprint, WibWob-DOS `instanceLabel`, or a mapped identity table?
- How are paths sandboxed to prevent escape (`..`, symlink traversal, bind mount leakage)?
- What is expected behaviour when an agent leaves a chatspot with active file handles?
- How does workspace restore rebuild active mounts safely after restart?

## Stories

### S00 — Docker smoke (VERIFIED ✓)

Goal: Prove the runtime, SSH posture, and control API work in a clean Linux/ARM64
container before touching the real VPS. Gate for all subsequent stories.

Files: `deploy/Dockerfile.smoke`, `deploy/smoke-entrypoint.sh`, `deploy/test_agent_key.pub`

Acceptance criteria:
- [x] GATE1: SSH key auth — `wibwob@localhost:2849` admitted with `test_agent_key`
- [x] GATE2: Password auth blocked — `ssh -o PasswordAuthentication=yes` rejected
- [x] GATE3: tmux session live — `tmux has-session -t wibwob` returns 0
- [x] GATE4: `/health` via SSH tunnel returns `ok:true`, `instanceLabel:"smoke"`
- [x] GATE5: Direct port 8099 not reachable from host (bound to 127.0.0.1 inside container)
- [x] GATE6: `/state` and `/commands/list` functional via tunnel (88 commands)
- [x] GATE7: `microapp.wibwobworld.open` — container survives, window appears in `/state`
- [x] GATE8: ttyd serves xterm.js at `http://127.0.0.1:7681/` — TUI in browser

```bash
# Build and run
docker build --platform linux/arm64 -t wibwob-vps-smoke -f deploy/Dockerfile.smoke .
docker run -d -t -p 127.0.0.1:2849:22 -p 127.0.0.1:7681:7681 \
  --platform linux/arm64 --name wibwob-smoke wibwob-vps-smoke

# Establish control API tunnel
ssh -fN -i deploy/test_agent_key -p 2849 -o StrictHostKeyChecking=no \
  -L 19099:127.0.0.1:8099 wibwob@localhost

# Verify all gates
curl http://127.0.0.1:19099/health    # GATE4
curl http://127.0.0.1:19099/state     # GATE6
curl http://127.0.0.1:7681/           # GATE8 (check for xterm in response)
```

Commit: `c550086` — `feat(e021/S00): Docker VPS smoke — verified green`

### S01 — VPS baseline

Goal: Run WibWob-DOS reliably on a Linux VPS with stable process/session management.

Acceptance criteria:
- [ ] VPS has Bun runtime and repo checkout with repeatable startup command.
- [ ] App runs in persistent tmux session (`wibwob`) and survives SSH disconnect.
- [ ] `GET /health` returns `ok:true` and identity fields from remote host.
- [ ] Restart procedure is documented and reproducible without manual pane recovery.

Verification:
```bash
bun run typecheck
TMUX= tmux has-session -t wibwob
curl -s http://127.0.0.1:8099/health
```

### S02 — Remote terminal access model

Goal: Allow at least two remote agent identities to access the VPS via SSH and operate the TUI.

Acceptance criteria:
- [ ] SSH key auth enabled; password auth disabled for agent access path.
- [ ] At least two distinct agent keys/principals are provisioned.
- [ ] Each identity can attach to or observe the tmux-backed TUI session per policy.
- [ ] Access logs/audit trail capture which key/principal connected.

Verification:
```bash
ssh -i ~/.ssh/agent_a_key -p 2849 <user>@<vps> 'tmux list-sessions'
ssh -i ~/.ssh/agent_b_key -p 2849 <user>@<vps> 'tmux list-sessions'
# Ubuntu 24.04 uses journald — auth.log may not exist without rsyslog
ssh -p 2849 <user>@<vps> 'journalctl -u ssh --since "1 hour ago" | grep "Accepted publickey"'
```

### S03 — Remote control API exposure

Goal: Expose control API to remote agents securely with a supported access pattern.

Acceptance criteria:
- [ ] Remote agent can reach `/state` and `/commands/list` via approved secure path.
- [ ] Remote agent can `POST /commands/run` and observe resulting state change.
- [ ] Exposure method is documented (SSH tunnel or equivalent) with threat model notes.
- [ ] Endpoint discovery (`/help`, `/openapi.json`) is reachable through same path.

Verification:
```bash
ssh -N -L 18099:127.0.0.1:8099 -p 2849 <user>@<vps>
curl -s http://127.0.0.1:18099/state
curl -s -X POST http://127.0.0.1:18099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open","args":{}}'
```

### S04 — Chatspot to folder binding

Goal: Bind world chatspots to VPS directories and expose mount state through world/control surfaces.

Acceptance criteria:
- [ ] Deterministic mapping exists from chatspot identity to absolute VPS directory.
- [ ] Joining nearest chatspot activates that directory as current workspace mount.
- [ ] Agent can list and write files only within mounted chatspot directory.
- [ ] `/state` and/or dedicated endpoint reports active chatspot, channel, and mount path.

Verification:
```bash
curl -s http://127.0.0.1:8099/state
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.join-nearest-chatspot","args":{}}'
curl -s http://127.0.0.1:8099/state | rg "joinedChannelId|nearestChannelId|mount|chatspot"
```

### S05 — Agent authorization enforcement

Goal: Enforce read/write permissions for mounted folders based on agent identity and chatspot membership.

Acceptance criteria:
- [ ] Agent in chatspot with write role can create/update files in mapped directory.
- [ ] Agent not in chatspot cannot write to mapped directory.
- [ ] Unauthorized write attempts return explicit error and are logged with identity.
- [ ] Read/write policy is represented as machine-readable state/API metadata.

Verification:
```bash
# authorized agent
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"<write-command>","args":{"path":"<chatspot-file>","content":"ok"}}'

# unauthorized agent/session should fail
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"<write-command>","args":{"path":"<chatspot-file>","content":"deny"}}'
```

## Non-goals

- Redesigning IRC transport/server behaviour from E020.
- Building browser-based remote control UI.
- Shipping a generic multi-tenant cloud filesystem service.
- Solving non-terminal remote rendering or pixel-stream protocols.
- Broad OS hardening unrelated to WibWob-DOS runtime/access path.

## Invariants To Preserve

- Keep terminal-native operation; do not pivot to webview/browsers for primary control.
- Preserve single control/API path for user-visible surfaces (`command-catalog`/registry + control API parity).
- Keep world/chat semantics API-visible (`describeState()` + control API), no UI scraping-only flows.
- Extend existing ownership seams: world state in world services, access/auth in dedicated service layer, avoid parallel helpers.
- Keep world identity stable across resize; do not regress E020 S06 (`worldKey` must not include viewport dimensions).
- Any new mount/authorization action must be command-visible and API-visible.

## Hosting / DevOps Context

### The VPS (wibwob1)

Hetzner CAX11, Ubuntu 24.04 LTS, **aarch64 (ARM64)**, 2 vCPU, 3.7GB RAM, 38GB disk.
IP: 89.167.18.207. SSH port: **2849** (non-standard — all SSH configs and firewall rules
must use this port explicitly).

Runbook and service files live in a separate repo:
`~/Repos/vps-hetzner-one/` → `/opt/vps-hetzner-one/` on the VPS.
This repo is the resurrection doc. Any wibwob-dos VPS setup steps must land in its
`RUNBOOK.md` (thin section, link to app README) and a `.service` file in `services/`.

### Current service layout

```
/opt/
├── symbiotica/              # sy-discord bot (GitHub Actions auto-deploy)
├── symbient-shared-skills/  # signal-daemon (systemd, non-root user)
├── wibandwob-heartbeat/     # daemon context — TOPOFMIND, HUMANS, memories
└── vps-hetzner-one/         # this runbook repo
```

`wibwob-dos` will land at `/opt/wibandwob-dos/` following the same pattern.

### Bun

Not yet installed on the VPS. Bun publishes native ARM64 Linux binaries — install with:
```bash
curl -fsSL https://bun.sh/install | bash
cp /root/.bun/bin/bun /usr/local/bin/bun   # copy not symlink — same gotcha as uv
# verify: bun --version
```
Pin an explicit Bun version in the runbook (e.g. `1.1.x`) — `package.json` `engines`
is advisory only and is not enforced at runtime.

### systemd service pattern

All long-running services are systemd units with `Restart=on-failure`. WibWob-DOS
is a blessed TUI — it must run inside a tmux session to be attachable. These are not
competing models: systemd is the supervisor, tmux is the interactive surface.

**Critical gotcha:** `tmux new-session -d` daemonises and exits immediately with code 0.
systemd `Type=simple` sees that exit and triggers a restart loop. Use a wrapper script
instead:

```bash
# /opt/wibandwob-dos/scripts/start-tmux.sh
#!/bin/bash
tmux new-session -d -s wibwob -x 320 -y 79 \
  /usr/local/bin/bun run /opt/wibandwob-dos/src/app.ts
# Block — keep the foreground process alive so systemd tracks it
tmux wait-for wibwob
```

Service unit (`Type=simple`, not `Type=forking`):
```
ExecStart=/opt/wibandwob-dos/scripts/start-tmux.sh
ExecStop=/usr/bin/tmux kill-session -t wibwob
```

`vps-hetzner-one/services/signal-daemon.service` is the shape reference.
Add `wibwob-dos.service` to that repo's `services/` directory.

### Non-root user requirement (critical)

Claude CLI `--permission-mode bypassPermissions` is **blocked for root** on this VPS
(same constraint that forced signal-daemon into its own user). Any wibwob-dos process
that spawns Claude Code headless must run as a non-root user.
Provisioning pattern from runbook section 5b:
```bash
useradd -m -s /bin/bash wibwob   # NOT -r: system users block interactive Claude OAuth
chown -R wibwob:wibwob /opt/wibandwob-dos
# interactive OAuth — must be a real login shell, not a subshell:
su - wibwob -c 'claude'   # or: ssh in, then su - wibwob, then run claude manually
# verify: su - wibwob -c 'ls ~/.claude/'  (token files should exist)
```

### Control API port binding

Port 8099 must bind to `127.0.0.1` only — never `0.0.0.0`.
The Docker port binding gotcha in the runbook applies here too:
a bare `-p 8099:8099` or equivalent without host binding is a live exposure.
Remote agents access the API via SSH tunnel:
```bash
ssh -N -L 18099:127.0.0.1:8099 wibwob1 -p 2849
curl http://127.0.0.1:18099/health
```

### SSH key model for agent identity

`/root/.ssh/authorized_keys` (or `/home/wibwob/.ssh/authorized_keys`) already holds
per-machine ed25519 keys (Zilla's MacBook Air, Zilla's iMac). Agent principals follow
the same pattern — one key per agent identity, named in a comment:
```
ssh-ed25519 AAAA... agent-local-james-imac
ssh-ed25519 AAAA... agent-vps-wibwob
ssh-ed25519 AAAA... agent-friend-remote
```
Key fingerprint is the starting identity signal — loosely maps to
`WIBWOB_INSTANCE_LABEL` for the IRC/world layer for S02 purposes. This is NOT
a robust authorization model: shared tmux sessions destroy per-agent isolation (an
agent in the session can set any `instanceLabel`), and SSH key → label mapping is
convention only, not enforced. The Open Questions section covers what a stronger model
needs. No separate auth service for S02 — but S05 will require it.

### tmux session convention

All services with interactive TUI surfaces use a persistent tmux session named after
the service. Existing pattern: `tmux new-session -d -s wibwob -x 320 -y 79`.
The session persists across SSH disconnects. Remote agents attach with:
```bash
tmux attach -t wibwob        # take control
tmux attach -t wibwob -r     # read-only observe
```
Multiple agents in the same session share a single TUI pane — fine for observation,
requires coordination for input. S02 should clarify whether agents get isolated
sessions or shared.

**Resize gotcha:** tmux forces the session to the smallest attached terminal. A remote
agent attaching at a narrow terminal will shrink the blessed layout for everyone in the
session. Mitigate with `tmux attach -t wibwob -r` (read-only) for observers, or set
`setw -g aggressive-resize on` in `.tmux.conf` so only the smallest *active* client
determines size.

### RAM headroom

3.7GB total. Figures below are **unmeasured estimates** — baseline before adding
wibwob-dos. Measure with `smem -r` or `ps aux --sort=-%mem` under representative
load before committing to a memory budget.

- Current services idle: ~600MB–1.2GB (sy-discord Python, signal-daemon + Claude Code
  headless, signal-api Docker container)
- WibWob-DOS at idle: estimated ~150MB RSS (Bun + blessed TUI + IRC client)
- Claude Code headless subprocess: estimated ~300–500MB per spawn

Risk: concurrent Claude Code subprocesses (one from signal-daemon, one from wibwob-dos)
could push 2GB+ and cause swapping. Avoid concurrent spawns; consider a VPS RAM
upgrade to CAX21 (8GB) before shipping S04/S05 if measured headroom is tight.

### Deploy pattern

sy-discord deploys via GitHub Actions on push to main. WibWob-DOS can follow the same
pattern (`.github/workflows/deploy-vps.yml` in the app repo): SSH into VPS,
`git pull`, `bun install`, `systemctl restart wibwob-dos`. No Docker needed —
Bun runs the app directly.

### Secrets pattern

All secrets in 1Password + per-service `.env` files (chmod 600). For wibwob-dos:
`/opt/wibandwob-dos/.env` holds IRC env vars, instance label, any API keys.
Never committed. Reference entry added to runbook section 7 secrets table.

### aarch64 gotcha surface

All native modules must have ARM64 builds. Blessed (pure JS) is fine. Any native
addon brought in later (e.g. sqlite, canvas) needs explicit ARM64 verification.
Node.js v22 is already installed — Bun and Node can coexist.

## Local Docker Smoke Environment

### Rationale

Before touching the real VPS, prove the core hosting stack works in a throwaway
container. The Hetzner VPS is Ubuntu 24.04 LTS aarch64. This dev machine is also
ARM64 (Apple Silicon). Docker on ARM64 runs `linux/arm64` containers natively —
no QEMU emulation. Same ISA and OS image: a useful architecture-compatible smoke,
not a full VPS replica (kernel, cgroups, systemd, Hetzner networking, and disk
persistence are all absent or different).

What the container smoke can honestly cover:
- Bun installs cleanly on Ubuntu 24.04 ARM64 and the binary runs
- `bun install && bun run src/app.ts` starts without crashing under a non-root user
- `GET /health` responds correctly when the app is running
- tmux session starts and is attachable (`tmux attach` works)
- SSH key auth works: known key admitted, unknown key rejected,
  password auth refused (validates `authorized_keys` + `PasswordAuthentication no`)
- Control API SSH tunnel pattern works end-to-end

What it cannot cover:
- systemd supervision (no init — run app directly in container)
- Claude CLI non-root restriction (Claude not installed in container — validate
  this separately on first VPS login)
- Hetzner firewall / network topology
- RAM pressure at VPS scale
- Port-exposure security at the host-network level

### Port binding note (important)

If the app binds to `127.0.0.1:8099` inside the container (prod posture),
`docker run -p 18099:8099` will NOT forward — Docker's proxy connects via the
container's bridge interface, not loopback. Two honest testing postures:

**A — Test tunnel path (mirrors prod):** app binds `127.0.0.1:8099`, no `-p 8099`
published, access only via SSH tunnel through the container's sshd. Proves the
real access pattern.

**B — Test app startup only:** app binds `0.0.0.0:8099`, publish with
`-p 127.0.0.1:18099:8099` (host-bound to avoid LAN exposure). Quicker smoke
for "does the app start and respond" without needing sshd running.

Do not mix: claiming `127.0.0.1` binding AND `-p` direct access are both true is
wrong. Choose A or B per what you're proving.

### Sketch (incomplete — starting point only)

This needs an entrypoint script, sshd host keys, `authorized_keys`, and
`PasswordAuthentication no` before it is runnable as a real smoke harness.
Treat as scratch notes, not a copy-paste solution.

```dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y curl git tmux openssh-server sudo \
    && curl -fsSL https://bun.sh/install | bash \
    && cp /root/.bun/bin/bun /usr/local/bin/bun \
    && useradd -m -s /bin/bash wibwob \
    && mkdir -p /run/sshd /home/wibwob/.ssh \
    && ssh-keygen -A                          # generate sshd host keys
# TODO: COPY test_agent_key.pub /home/wibwob/.ssh/authorized_keys
# TODO: RUN chmod 700 /home/wibwob/.ssh && chown -R wibwob:wibwob /home/wibwob/.ssh
# TODO: RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
# TODO: ENTRYPOINT: start sshd, then su to wibwob and run app in tmux
COPY . /opt/wibandwob-dos
RUN chown -R wibwob:wibwob /opt/wibandwob-dos
EXPOSE 22
```

Run (posture A — tunnel only, mirrors prod):
```bash
docker build --platform linux/arm64 -t wibwob-vps-smoke .
docker run -d --rm \
  -p 127.0.0.1:2849:22 \   # SSH only — no direct API port published
  --platform linux/arm64 \
  --name wibwob-smoke \
  wibwob-vps-smoke
```

Verify inside container via SSH:
```bash
# SSH key auth
ssh -i ~/.ssh/test_agent_key -p 2849 wibwob@localhost 'whoami'
# tmux attach
ssh -i ~/.ssh/test_agent_key -p 2849 wibwob@localhost 'tmux attach -t wibwob -r'
# control API via tunnel
ssh -N -L 19099:127.0.0.1:8099 -i ~/.ssh/test_agent_key -p 2849 wibwob@localhost &
curl -s http://127.0.0.1:19099/health
# confirm direct host access is blocked (should fail)
curl -s http://127.0.0.1:8099/health  # expected: connection refused
```

### Story suggestion

Consider a pre-story **S00 — Docker smoke** that must pass before S01 (real VPS
work) begins. Gates: health endpoint live, non-root user running, SSH key auth
working, control API tunnel confirmed. Keeps the real VPS clean until the runtime
is proven locally.

## Known Structural Gaps (must resolve before S04/S05)

These are not implementation details — they are design prerequisites. S04 and S05
cannot be built without answering them first. Both stories should be treated as
mini-milestones requiring their own breakdown once these are resolved.

### Gap 1 — Terrain seed determinism

Chatspot IDs are derived from terrain seed, which is random on every WibWobWorld open.
A fresh restart, a reseed, or a second agent opening WibWobWorld independently will
produce different chatspots at different world coordinates. For chatspot→folder binding
to be stable, the VPS needs:

- A fixed, persisted seed stored server-side (not random at open-time)
- WibWobWorld configured to load that seed on the VPS instance
- Chatspot IDs defined as stable named entities (not coordinate-derived), OR the
  binding keyed on `channelId` (IRC channel) which IS stable if the seed is fixed

Until this is solved, the folder an agent "navigates to" can change between sessions.
This is a showstopper for S04.

### Gap 2 — API is single-tenant, S05 enforcement has no foundation

Every remote agent tunnels to the same port 8099 and issues `POST /commands/run`
with no per-agent identity on the HTTP request. The API has no concept of "which
principal is making this call." S05 says "agent not in chatspot cannot write" —
but the enforcement layer has nothing to enforce against.

Before S05 is buildable, the control API needs either:
- A per-request token (e.g. `Authorization: Bearer <agent-key>`) mapped to a principal
- Or a per-agent API instance (separate port per agent, separate process) — heavy
- Or the file write operations happen inside per-agent SSH sessions with UNIX permission
  enforcement at the OS layer (elegant but requires per-agent UNIX users, not a shared
  `wibwob` user)

The UNIX-user approach may be the simplest first pass: each agent identity gets its
own Linux user with appropriate directory permissions. No API auth layer needed — the
OS enforces it. Worth considering before designing a custom token system.

### Gap 3 — WibWobWorld not auto-opened on startup

S01 guarantees the app process is running. It does not guarantee WibWobWorld is open
and terrain has been generated. For S04 to work from a cold start a remote agent must:

1. Open WibWobWorld via API
2. Wait for terrain generation to complete
3. Confirm chatspots are visible in state
4. Navigate and join

This is not a blocker but it is an unspoken dependency. S01 AC should include a
workspace that auto-opens WibWobWorld on startup, or S04 AC should explicitly cover
the cold-start flow.

## Stretch Goal — Web TUI Access via ttyd + xterm.js

### Concept

Serve the WibWob-DOS TUI over HTTP using **ttyd** — a C binary that streams a
PTY to a browser via WebSocket, rendered by xterm.js. No browser plugin, no VNC.
Pure terminal in a tab.

The existing `deploy/Dockerfile` already uses ttyd for the web-session path.
Pattern is proven. The question is multi-user URL routing.

### Single-session MVP (simplest)

```bash
ttyd --writable -p 7681 su -c "tmux attach -t wibwob" wibwob
```

`http://vps:7681/` — everyone gets the same shared tmux session. Fine for a
demonstration or a trusted single-operator setup. Not suitable for per-agent
isolation.

### Per-user paths (S02 era question)

ttyd does not natively route `/username/` to per-user sessions. Options:

**Option A — One ttyd per agent, Caddy proxies paths:**
```
http://vps/alice/  →  ttyd on :7682  →  tmux attach (alice's session)
http://vps/bob/    →  ttyd on :7683  →  tmux attach (bob's session)
```
Caddy config: `reverse_proxy /alice/* localhost:7682`. Simple, explicit,
no extra deps. Each agent gets a dedicated port and their own tmux session.
Requires per-agent UNIX users (aligns with S03.6 UNIX-user identity model).

**Option B — wetty:**
Wetty (Node.js web terminal) natively supports `/username/` path routing
and SSH-based auth (`wetty --ssh-host localhost`). Agents authenticate with
their SSH key via the browser. No separate ttyd-per-user needed.
More moving parts but cleaner auth story.

**Option C — shared read-only + one writable:**
`http://vps/view/` → ttyd read-only attach (all observers share one view)
`http://vps/control/` → ttyd writable (one active controller at a time, basic auth)
Simplest for a VJ/demo scenario where one agent drives and others watch.

### Recommendation

For smoke testing: single-session ttyd at port 7681, no auth. Proves the
concept end-to-end in the container.

For VPS: Option A (one ttyd per agent, Caddy routing) aligns with the
per-agent UNIX user model already recommended in S03.6. No new auth layer.

For the `/username` URL question: yes, you need the path prefix if multiple
agents share one hostname. Caddy `handle_path /alice/*` strips the prefix
before proxying — ttyd doesn't see it. Clean.

### Smoke gate (added to S00)

- [ ] `http://127.0.0.1:7681/` serves xterm.js in browser showing live TUI
- [ ] typing in browser reaches the blessed app (writable session)
- [ ] container survives ttyd + sshd + app running concurrently

### Notes

- ttyd binary: ARM64 release at `github.com/tsl0922/ttyd/releases` (already
  in `deploy/Dockerfile` pattern)
- ttyd port must bind `127.0.0.1` on VPS, exposed via Caddy or SSH tunnel
  (same rule as control API — never `0.0.0.0` directly)
- xterm.js theme can be customised — opportunity to match WibWob-DOS aesthetic

## Commit Context Note

Recent commits show E020 effectively closed (IRC framework client, reconnect behaviour, dual-instance smoke, dev-server hardening) and E018 terrain/world work stabilized around WibWobWorld chatspots, world-key resize safety, and API identity fields (`instanceLabel`, `sessionId`) in `/health`; this epic starts from that baseline and adds VPS deployment/access hardening plus filesystem authorization semantics on top.
