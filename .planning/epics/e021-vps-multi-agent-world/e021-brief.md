---
Status: not-started
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
ssh -i ~/.ssh/agent_a_key <user>@<vps> 'tmux list-sessions'
ssh -i ~/.ssh/agent_b_key <user>@<vps> 'tmux list-sessions'
ssh <user>@<vps> 'grep -n "Accepted publickey" /var/log/auth.log | tail -n 20'
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
ssh -N -L 18099:127.0.0.1:8099 <user>@<vps>
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

## Commit Context Note

Recent commits show E020 effectively closed (IRC framework client, reconnect behaviour, dual-instance smoke, dev-server hardening) and E018 terrain/world work stabilized around WibWobWorld chatspots, world-key resize safety, and API identity fields (`instanceLabel`, `sessionId`) in `/health`; this epic starts from that baseline and adds VPS deployment/access hardening plus filesystem authorization semantics on top.
