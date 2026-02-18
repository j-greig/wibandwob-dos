# F01: PartyKit Server

## Parent

- Epic: `e008-multiplayer-partykit`
- Epic brief: `.planning/epics/e008-multiplayer-partykit/e008-epic-brief.md`

## Objective

TypeScript server deployed to Cloudflare edge via PartyKit. One Durable Object per room. Coordinates multiplayer state (window layout), chat relay, cursor presence.

## Location

`partykit/` — standalone npm package. Deploy with `npx partykit deploy`.

## Message Protocol

| Type | Direction | Purpose |
|------|-----------|---------|
| `state_delta` | C++ → Server → others | Window layout mutation |
| `state_sync` | Server → new joiner | Full canonical state on connect |
| `chat_msg` | C++ → Server → others | Scramble chat relay |
| `cursor_pos` | JS/C++ → Server → others | Terminal cursor position |
| `presence` | Server → all | Join/leave events |
| `ping`/`pong` | C++ ↔ Server | Keep-alive |

## Acceptance Criteria

- [x] **AC-1:** New joiner receives full canonical state (state_sync) on connect
  - Test: applyDelta logic tested; state_sync message format verified in unit tests
- [x] **AC-2:** state_delta broadcast to all except sender with server version
  - Test: applyDelta + version increment tested (12 unit tests)
- [x] **AC-3:** chat_msg relayed to all except sender
  - Test: message parsing unit test; relay logic in server.ts
- [x] **AC-4:** presence event broadcast on join/leave
  - Test: onConnect/onClose broadcast logic in server.ts
- [ ] **AC-5:** local dev server starts with `npx partykit dev`
  - Test: `cd partykit && npx partykit dev` starts without error; `curl -s http://localhost:1999/` returns a response

## Local Dev

```bash
cd partykit
npx partykit dev   # starts on http://localhost:1999
```

Connect a WebSocket client to `ws://localhost:1999/party/room-name` to test.

## Deploy

```bash
cd partykit
npx partykit deploy
```

Deployed URL: `https://wibwob.your-username.partykit.dev`

## Status

Status: in-progress
GitHub issue: #65
PR: —
