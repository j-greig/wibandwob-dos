# F02: WebSocket Bridge (PartyKit Relay)

## Parent

- Epic: `e008-multiplayer-partykit`
- Epic brief: `.planning/epics/e008-multiplayer-partykit/e008-epic-brief.md`

## Objective

Bridge WibWob-DOS state to PartyKit in real time. Originally planned as a C++ WebSocket client (ixwebsocket); pragmatically implemented as a Python relay bridge that polls IPC state, diffs it, and pushes deltas to PartyKit. Also receives remote deltas and applies them via IPC commands.

## Design Choice: Python Bridge over C++ WebSocket

C++ WebSocket (ixwebsocket) was the initial plan. Parking lot reason:
- `ixwebsocket` unavailable via brew; would need git submodule + CMake integration
- libwebsockets (installed) has complex event-loop API, conflict with TV event loop
- Python relay achieves identical behaviour with zero C++ changes and full testability

The Python bridge runs as a sidecar process alongside each multiplayer room instance.
Orchestrator spawns it when `multiplayer: true` in room config.

## Bridge Architecture

```
WibWob IPC (Unix socket)
      │
      ▼
partykit-bridge.py  ←──→  PartyKit WebSocket
      │                    (ws://localhost:1999 or wss://...)
      └── poll get_state every 500ms
      └── diff against last state
      └── push state_delta if changed
      └── receive state_delta → apply via IPC commands
```

## Scope

**In:**
- `tools/room/partykit-bridge.py` — standalone bridge process
- State polling via IPC `get_state` command
- JSON diff (add/remove/update windows)
- WebSocket connection to PartyKit (ws:// or wss://)
- Apply remote deltas via IPC `create_window`, `move_window`, `close_window`
- Orchestrator spawns bridge when `multiplayer: true`

**Out:**
- C++ WebSocket client (parked — Python bridge is sufficient for MVP)
- Sub-100ms latency (Python polling at 500ms is fine for MVP)

## Stories

- [ ] `s01-bridge-poll-diff` — poll IPC, compute state diff, push to PartyKit
- [ ] `s02-bridge-apply-remote` — receive PartyKit delta, apply via IPC commands
- [ ] `s03-orchestrator-spawn` — orchestrator spawns bridge as sidecar

## Acceptance Criteria

- [ ] **AC-1:** Bridge connects to PartyKit WebSocket and sends state_delta within 1s of window open
  - Test: start bridge against mock PartyKit WS server, open a window via IPC, assert state_delta received by mock
- [ ] **AC-2:** Bridge applies remote state_delta to local WibWob instance via IPC
  - Test: send state_delta with add:[window] to bridge input; assert IPC create_window called
- [ ] **AC-3:** Orchestrator spawns bridge process when multiplayer:true
  - Test: mock spawn, assert bridge process started for multiplayer room, absent for single-player
- [ ] **AC-4:** Bridge reconnects on PartyKit disconnect (within 5s)
  - Test: close mock WS server, reopen, assert bridge reconnects

## Parking Lot

- **C++ WebSocket client**: originally planned with ixwebsocket. Parked — Python bridge achieves same result with less complexity. Revisit if sub-100ms latency becomes a requirement.

## Status

Status: not-started
GitHub issue: #65
PR: —
