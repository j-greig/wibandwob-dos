---
id: E006
title: Browser-Hosted Deployment (Teleport Rooms)
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E006: Browser-Hosted Deployment (Teleport Rooms)

tl;dr: Serve WibWob-DOS to remote users via browser. Zoom-link-style URLs to curated sessions — Twitter OAuth, custom system prompts, persistent rooms, $5 VPS.

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
[nginx] → Twitter OAuth flow → session cookie
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
| Auth | Twitter OAuth | Identity for personalisation + rate limiting |
| Preload | System prompt + files | Custom prompt shapes LLM. Markdown/primers as context windows. |
| Persistence | Persistent room | Session survives disconnect. Visitor returns and picks up. |
| LLM provider | `anthropic_api` (curl) | No Node.js dependency. API key dialog exists. |

## Candidate Features

- **F1: Room Config** — YAML/JSON room definition (layout, prompt, file paths, auth settings)
- **F2: Room Orchestrator** — CLI/daemon that spawns ttyd+WibWob per room, manages lifecycle
- **F3: Auth Layer** — nginx + Twitter OAuth proxy, session tokens, rate limiting
- **F4: Layout Restore** — replay window layout from room config via IPC commands
- **F5: State Persistence** — serialise/restore chat history + desktop state across disconnects
- **F6: IPC Safety** — fix socket unlink race (probe before unlink), check `start()` return value

## Open Questions

1. Room creation UX — CLI tool? Web UI? Config file? (recommend: YAML + CLI first)
2. Rate limiting — how many LLM messages per Twitter user per session?
3. LLM costs — host's API key per room? Visitor brings own?
4. Room capacity — 1:1 or many:1? (shared terminal = shared cursor if multiple visitors)
5. Layout restoration — sequence of IPC `create_window` commands from config?
6. Chat persistence format and location?
7. Multi-visitor interaction model?

## Known Risks

- **Socket unlink race** — two instances sharing a path silently steal each other's IPC. Fix sketched in `multi-instance-debug.md`.
- **ttyd `--writable` security** — gives full terminal access. Needs auth wrapper for any public deployment.
- **LLM cost** — unbounded without rate limiting per visitor.
- **Right-edge clipping** — xterm.js reports wide terminal, TUI draws to that width. Fix: cap cols or use fit-addon.

## Definition of Done

- [ ] Room config format defined and documented
- [ ] At least 1 room serveable to a browser visitor with auth
- [ ] Layout restores from config on room join
- [ ] Chat persists across visitor disconnect/reconnect
- [ ] Deployed and reachable on Hetzner VPS
- [ ] IPC unlink race fixed
- [ ] Rate limiting on LLM calls per visitor

## Status

Status: `not-started`
GitHub issue: (create when work begins)
PR: —

## References

- Spike issue: [#54 — SP: xterm.js PTY rendering validation](https://github.com/j-greig/wibandwob-dos/issues/54)
- Spike branch: `spike/xterm-pty-validation`
- Feature concept: `memories/2026/02/20260217-teleport-rooms.md`
- Multi-instance IPC: commit `3d0b216`
