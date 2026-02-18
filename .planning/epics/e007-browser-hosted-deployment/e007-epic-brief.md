---
id: E007
title: Browser-Hosted Deployment (Teleport Rooms)
status: not-started
issue: 57
pr: ~
depends_on: []
---

# E007: Browser-Hosted Deployment (Teleport Rooms)

tl;dr: Serve WibWob-DOS to remote users via browser. YAML room configs, ttyd orchestrator, HMAC agent auth, layout restore, IPC safety fix. MVP: a URL serves a curated WibWob room.

## Objective

Ship a production browser deployment path for WibWob-DOS. A host creates a "room" — a curated desktop layout with specific windows + a chat panel powered by a custom system prompt and pre-loaded files. The room gets a unique URL. Visitors authenticate via Twitter OAuth, land in the curated layout, and chat with a Wib&Wob instance shaped by the host's config.

## Context for Agent (no prior conversation assumed)

### What exists already

The xterm-pty-validation spike (`spike/xterm-pty-validation` branch, issue #54) proved:

- **ttyd** bridges WibWob-DOS TUI to browser via WebSocket+PTY with zero C++ changes
- **8/9 render fidelity tests pass** — menus, windows, art engines, 256-colour, ANSI images, mouse, resize all work
- **Multi-instance IPC** landed (commit `3d0b216`): `WIBWOB_INSTANCE=N` env var drives per-instance socket `/tmp/wibwob_N.sock`, backward compat when unset
- **Instance monitor** (`tools/monitor/instance_monitor.py`) — ANSI dashboard, discovers sockets via glob, 2s poll
- **tmux launcher** (`tools/scripts/launch_tmux.sh`) — spawns N panes + monitor sidebar
- **API key dialog** — `anthropic_api` provider with runtime `setApiKey()`, TUI dialog for browser users
- **Startup stderr logging** — instance ID + socket path on launch

### Key files to read first

| File | What it tells you |
|------|-------------------|
| `.planning/spikes/spk-xterm-pty-validation/dev-log.md` | Full spike results, test matrix, architecture decisions, API key dialog implementation |
| `.planning/spikes/spk-xterm-pty-validation/multi-instance-debug.md` | Multi-instance IPC debug notes, unlink race analysis, known issues |
| `memories/2026/02/20260217-teleport-rooms.md` | Feature concept with architecture sketch, design decisions, open questions |
| `memories/2026/02/20260217-tmux-dashboard-plan.md` | Original 7-phase implementation plan for multi-instance IPC |
| `app/test_pattern_app.cpp` | Main TUI app — socket path derivation at ~L698, API key dialog |
| `app/api_ipc.cpp` | IPC server — socket bind/listen, command dispatch, unlink race at L109 |
| `tools/monitor/instance_monitor.py` | Monitor script — socket discovery, state polling |
| `tools/scripts/launch_tmux.sh` | tmux orchestrator |
| `CLAUDE.md` | Build commands, architecture diagram, multi-instance env vars |

### Build & run

```bash
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build

# Single instance (legacy)
./build/app/test_pattern 2>/tmp/wibwob_debug.log

# Named instance
WIBWOB_INSTANCE=1 ./build/app/test_pattern 2>/tmp/wibwob_1.log

# ttyd browser bridge
ttyd --port 7681 --writable -t fontSize=14 -t 'theme={"background":"#000000"}' \
  bash -c 'cd /path/to/repo && TERM=xterm-256color WIBWOB_INSTANCE=1 exec ./build/app/test_pattern 2>/tmp/wibwob_1.log'

# Monitor dashboard
python3 tools/monitor/instance_monitor.py

# tmux multi-instance (4 panes + monitor)
./tools/scripts/launch_tmux.sh 4
```

## Architecture

```
[Visitor browser] → [wibwob.symbient.life/room/abc123]
       │
       ▼
[nginx] → (auth parked for MVP)
       │
       ▼
[ttyd instance] → [WibWob-DOS + WIBWOB_INSTANCE=N]
       │               ├── curated window layout (from room config)
       │               ├── system prompt (from room config)
       │               ├── pre-loaded files/primers
       │               └── chat with anthropic_api provider
       │
       ▼
[Room state store] → persists layout + chat history
```

Target: $5 Hetzner VPS (2GB ARM), 4 concurrent rooms max.

## Design Decisions (from spike)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PTY bridge | ttyd | Zero-config, battle-tested, proven in spike |
| Visitor surface | Curated layout | Host arranges windows + chat. Visitor interacts but can't rearrange. |
| Auth | HMAC challenge-response | Shared secret at spawn, ephemeral session keys, ~75 LOC. Twitter OAuth parked. |
| Preload | System prompt + files | Custom prompt shapes LLM. Markdown/primers as context windows. |
| Persistence | Persistent room | Session survives disconnect. Visitor returns and picks up. |
| LLM provider | `anthropic_api` (curl) | No Node.js dependency. API key dialog exists. |

## MVP Features

- [~] **F01: Room Config** — YAML schema, validation, example config → `f01-room-config/`
- [ ] **F02: Room Orchestrator** — spawn ttyd+WibWob per room, health check, restart → `f02-room-orchestrator/`
- [ ] **F03: Agent Auth** — HMAC challenge-response over IPC sockets → `f03-agent-auth/`
- [ ] **F04: Layout Restore** — WIBWOB_LAYOUT_PATH env var, auto-restore on startup → `f04-layout-restore/`
- [ ] **F05: IPC Safety** — probe-before-unlink, bind failure propagation → `f05-ipc-safety/`

Parked items (Twitter OAuth, state persistence, rate limiting, etc): `e007-parking-lot.md`

## Open Questions

Full technical planning report (build order, schema, risk register, auth design): [#57 comment](https://github.com/j-greig/wibandwob-dos/issues/57#issuecomment-3916823285)

Three decisions needed before implementation starts:

1. **API key model** — host key per room (recommended: host pays, rate limit bounds cost, visitor UX is clean) vs visitor brings own key (kills the "walk through a door" metaphor)
2. **Multi-visitor model** — ttyd default is shared cursor when two visitors hit same room URL. Feature (shared space) or bug? Recommend: ship as shared in V1, revisit in V2.
3. **Room creation UX** — hand-authored YAML + TUI-saved workspace JSON (recommended for V1) vs CLI wizard (2+ days extra)

Resolved in planning report:
- Rate limiting: 20 LLM messages/visitor/hour tracked in orchestrator, inject message on exceed
- Layout restoration: `WIBWOB_LAYOUT_PATH` env var → auto-restore on startup via existing `loadWorkspaceFromFile()`
- Chat persistence: JSON per visitor in `{state_dir}/chat_{handle}.json`, append after each LLM response
- Room capacity: 4 concurrent rooms max on €3.79/mo Hetzner CAX11 ARM (~50MB/instance)

## Known Risks

- **Socket unlink race** — two instances sharing a path silently steal each other's IPC. Fix sketched in `multi-instance-debug.md`.
- **ttyd `--writable` security** — gives full terminal access. Needs auth wrapper for any public deployment.
- **LLM cost** — unbounded without rate limiting per visitor.
- **Right-edge clipping** — xterm.js reports wide terminal, TUI draws to that width. Fix: cap cols or use fit-addon.

## Definition of Done (MVP)

- [ ] Room config YAML schema defined, validated, documented
- [ ] Orchestrator spawns ttyd+WibWob from config, restarts on failure
- [ ] Agent auth via HMAC challenge-response on IPC sockets
- [ ] Layout restores from config on room join
- [ ] IPC unlink race fixed — no silent socket theft
- [ ] At least 1 room serveable to a browser visitor via URL

Deferred from MVP (see parking lot):
- ~~Chat persists across disconnect~~ (parked)
- ~~Deployed on Hetzner VPS~~ (parked — local serving first)
- ~~Rate limiting on LLM calls~~ (parked — needs visitor identity)
- ~~Twitter OAuth~~ (parked)

## Status

Status: `not-started`
GitHub issue: [#57](https://github.com/j-greig/wibandwob-dos/issues/57)
PR: —

## References

- Epic issue: [#57 — E007: Browser-Hosted Deployment (Teleport Rooms)](https://github.com/j-greig/wibandwob-dos/issues/57)
- Planning report: [#57 comment — full technical analysis](https://github.com/j-greig/wibandwob-dos/issues/57#issuecomment-3916823285)
- Spike issue: [#54 — SP: xterm.js PTY rendering validation](https://github.com/j-greig/wibandwob-dos/issues/54)
- Spike branch: `spike/xterm-pty-validation`
- Feature concept: `memories/2026/02/20260217-teleport-rooms.md`
- Multi-instance IPC: commit `3d0b216`
