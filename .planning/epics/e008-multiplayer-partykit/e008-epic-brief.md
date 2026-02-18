---
id: E008
title: Multiplayer Teleport Rooms (PartyKit)
status: not-started
issue: ~
pr: ~
depends_on: [E007]
---

# E008: Multiplayer Teleport Rooms (PartyKit)

tl;dr: Two users share a WibWob-DOS room via PartyKit. Side-by-side instances with full state mirror, C++ WebSocket push, ghost cursor overlay injected into ttyd, shared chat. PartyKit Durable Objects coordinate rooms. Cursor overlay is stretch — park after 3-4 failed passes.

## Directive

**Park, don't block.** If any non-essential feature (cursor overlay, art seed sync, presence minimap) doesn't work after 3-4 code passes, move it to the parking lot at the bottom of this brief and ship without it. The MVP is two humans in synced rooms with chat. Everything else is gravy.

## Objective

A friend visits a room URL. They get their own WibWob-DOS instance with state mirrored from the host. Both users see the same windows, same positions, same content. Chat messages flow between instances. Optionally, ghost cursors show where the other person is pointing.

## Context for Agent

### What exists (E007)

- Room configs (markdown + YAML frontmatter) define rooms
- Orchestrator spawns ttyd + WibWob per room
- HMAC challenge-response auth on IPC sockets
- Layout restore from JSON workspace files
- IPC socket safety (probe-before-unlink)
- `get_state` returns full window layout as JSON via IPC

### What's new (E008)

- PartyKit server as real-time coordination layer
- C++ WebSocket client for state push/receive
- ttyd page JS injection for cursor overlay + presence
- Multi-instance state diffing and application

### Key files

| File | Relevance |
|------|-----------|
| `app/api_ipc.cpp` | IPC protocol — state queries, command dispatch |
| `app/test_pattern_app.cpp` | Main app — workspace save/restore, window management |
| `tools/room/orchestrator.py` | Room lifecycle — spawn, health, secrets |
| `tools/room/room_config.py` | Room config parser |
| `rooms/example.md` | Example room config |

### PartyKit essentials

- **Server**: JS class with `onConnect`, `onMessage`, `onClose` handlers
- **Room**: Durable Object with key-value storage (128KB/value), connection tracking
- **Broadcast**: `this.room.broadcast(msg, [sender.id])` fans out to all except sender
- **Deploy**: `npx partykit deploy` to Cloudflare edge
- **Docs**: https://docs.partykit.io/reference/partyserver-api/

## Architecture

```
[Host browser]                    [Guest browser]
   │ ttyd + injected JS              │ ttyd + injected JS
   │ cursor overlay                  │ cursor overlay
   │                                 │
   ▼                                 ▼
[WibWob instance A]              [WibWob instance B]
   │ C++ WebSocket client            │ C++ WebSocket client
   │                                 │
   └──────────┐          ┌──────────┘
              ▼          ▼
        [PartyKit Server]
        Durable Object per room
        ├── canonical state
        ├── cursor positions
        ├── chat messages
        └── presence (who's connected)
```

State flow:
1. Instance A mutates (user opens window) → pushes delta to PartyKit
2. PartyKit stores + broadcasts delta to all other connections
3. Instance B receives delta → applies via IPC command
4. Both screens converge within ~100ms

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync model | Side-by-side instances | Avoids cursor fights of shared terminal. Each user has own TUI. |
| State authority | PartyKit Durable Object | Canonical state lives at edge. Instances are clients. Conflict resolution is server-side. |
| State transport | C++ WebSocket to PartyKit | Low latency. No Python polling middleman. Direct push on mutation. |
| Cursor overlay | Inject JS into ttyd page | Lighter than replacing ttyd with custom xterm.js frontend. Fragile but minimal. |
| Chat | Relay via PartyKit | Messages broadcast to all instances. Scramble shows remote messages. |
| Sync scope | Full state mirror | Windows, positions, art params, chat. Not terminal character buffer. |

## MVP Features

- [ ] **F01: PartyKit Server** — room Durable Object, state store, delta broadcast, presence → `f01-partykit-server/`
- [ ] **F02: C++ WebSocket Client** — connect to PartyKit, push state deltas, receive + apply remote deltas → `f02-cpp-websocket/`
- [ ] **F03: State Diffing** — detect local mutations, compute minimal delta JSON, apply remote deltas to local state → `f03-state-diff/`
- [ ] **F04: Chat Relay** — Scramble messages broadcast via PartyKit, remote messages appear in local Scramble → `f04-chat-relay/`
- [ ] **F05: Cursor Overlay** — inject PartyKit JS client into ttyd page, render ghost cursor for remote user → `f05-cursor-overlay/`
- [ ] **F06: Room Config Extension** — `multiplayer: true` flag in room YAML, orchestrator spawns PartyKit-connected instances → `f06-room-config-mp/`

## Feature Detail

### F01: PartyKit Server

TypeScript server deployed to Cloudflare edge. One Durable Object per room.

```typescript
// Pseudocode
export default class WibWobRoom implements Party.Server {
  onConnect(conn, ctx) {
    // Send current canonical state to new joiner
    // Broadcast presence update to others
  }
  onMessage(msg, sender) {
    // Parse delta, merge into canonical state
    // Broadcast to all except sender
  }
  onClose(conn) {
    // Remove from presence, broadcast departure
  }
}
```

Message types: `state_delta`, `cursor_pos`, `chat_msg`, `presence`.

### F02: C++ WebSocket Client

Lightweight WebSocket in the TUI app. Options:
- **ixwebsocket** (header-only, C++11, MIT) — simplest integration
- **libwebsockets** — already a transitive dep via ttyd
- **Beast/Boost** — overkill

Connects on startup when `WIBWOB_PARTYKIT_URL` env var is set. Pushes state deltas on mutation. Receives and dispatches remote deltas.

### F03: State Diffing

Current `get_state` returns full JSON (~2-5KB). Diffing strategy:
- Track last-sent state hash per window
- On mutation (window open/close/move/resize, art param change), compute delta
- Delta format: `{"type": "state_delta", "add": [...], "remove": [...], "update": [...]}`
- Apply remote deltas via existing IPC command dispatch

### F04: Chat Relay

Scramble already has a message display system. Extension:
- New message type: `remote_chat` (shows sender name + message)
- PartyKit relays `{"type": "chat_msg", "sender": "james", "text": "look at this pattern"}`
- ScrambleView renders remote messages with different colour/prefix

### F05: Cursor Overlay (stretch — park if stuck after 3-4 passes)

Inject `<script>` into ttyd page via orchestrator or custom ttyd fork.
- PartyKit JS client connects from browser
- Sends local cursor position (xterm.js `buffer.cursorX/Y`)
- Receives remote cursor position
- Renders ghost cursor as CSS overlay (`position: absolute` div on top of xterm canvas)
- Colour-coded per user

Risk: ttyd page structure is not stable API. xterm.js canvas coordinate mapping is fiddly. This is the most likely feature to get parked.

### F06: Room Config Extension

Add optional fields to room YAML frontmatter:
```yaml
multiplayer: true
partykit_room: scramble-demo
max_players: 2
```

Orchestrator passes `WIBWOB_PARTYKIT_URL` env var when spawning. Existing single-player rooms unaffected.

## Open Questions

1. **WebSocket library** — ixwebsocket vs libwebsockets? Former is simpler, latter is already in the dep tree via ttyd.
2. **State conflict resolution** — last-write-wins sufficient? Or need CRDT for concurrent window moves?
3. **Cursor coordinate system** — xterm.js reports row/col, but terminal dimensions may differ between host and guest. Normalise to percentages?
4. **ttyd JS injection** — custom fork, `--inject-js` flag, or reverse-proxy rewriting HTML?
5. **Latency budget** — target <200ms for state convergence? PartyKit edge should deliver <100ms for same-region users.

## Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| C++ WebSocket adds build complexity | Medium | ixwebsocket is header-only, minimal deps |
| ttyd page injection is fragile | High | Pin ttyd version. Fallback: presence-only (no cursor overlay) |
| State diff bugs cause desync | High | Periodic full-state reconciliation (every 30s) as safety net |
| PartyKit free tier limits | Low | 20 concurrent connections free. Enough for MVP. |
| Art engine state is large/complex | Medium | Start with window layout sync only. Art params are stretch. |

## Definition of Done (MVP)

- [ ] Two browser users connect to same room, each gets own WibWob-DOS instance
- [ ] Window open/close/move in one instance appears in the other within 500ms
- [ ] Chat messages sent in one Scramble appear in the other
- [ ] Presence indicator shows who's connected
- [ ] Single-player rooms (E007) still work unchanged
- [ ] At least cursor presence (not necessarily pixel overlay) visible to both users

Stretch (park if blocked):
- Ghost cursor overlay on terminal canvas
- Art engine parameter sync (seed, palette, speed)
- More than 2 concurrent users per room

## Parking Lot

_Items moved here were attempted but blocked progress. Each entry records what was tried and why it was parked._

(empty — nothing parked yet)

## Status

Status: not-started
GitHub issue: —
PR: —

## References

- PartyKit docs: https://docs.partykit.io/
- PartyKit server API: https://docs.partykit.io/reference/partyserver-api/
- PartyKit chat example: https://docs.partykit.io/examples/app-examples/chat-app-with-ai-and-auth/
- ixwebsocket: https://github.com/nicedoc/ixwebsocket
- E007 epic: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`
- Depends on E007 room infrastructure (config, orchestrator, auth, layout restore)
