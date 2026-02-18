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
partykit_bridge.py  ←──→  PartyKit WebSocket
      │                    (ws://localhost:1999 or wss://...)
      └── poll get_state every 500ms
      └── diff against last state
      └── push state_delta if changed
      └── receive state_delta → apply via IPC commands
```

## Scope

**In:**
- `tools/room/partykit_bridge.py` — standalone bridge process
- State polling via IPC `get_state` command
- JSON diff (add/remove/update windows)
- WebSocket connection to PartyKit (ws:// or wss://)
- Apply remote deltas via IPC `create_window`, `move_window`, `close_window`
- Orchestrator spawns bridge when `multiplayer: true`

**Out:**
- C++ WebSocket client (parked — Python bridge is sufficient for MVP)
- Sub-100ms latency (Python polling at 500ms is fine for MVP)

## Stories

- [x] `s01-bridge-poll-diff` — poll IPC, compute state diff, push to PartyKit
- [x] `s02-bridge-apply-remote` — receive PartyKit delta, apply via IPC commands
- [x] `s03-orchestrator-spawn` — orchestrator spawns bridge as sidecar

## Acceptance Criteria

- [x] **AC-1:** Bridge sends state_delta to PartyKit WebSocket when state changes
  - Test: `TestBridgePushDelta::test_push_delta_sends_state_delta_message` — verifies {type: state_delta, delta: ...} message format and WS send called
- [x] **AC-2:** Bridge applies remote state_delta to local WibWob instance via IPC
  - Test: `TestApplyDeltaToIpc::test_add_calls_create_window`, `test_remove_calls_close_window`, `test_update_calls_move_window`
- [x] **AC-3:** Orchestrator spawns bridge process when multiplayer:true
  - Test: `TestOrchestratorSpawnsBridge::test_bridge_spawned_for_multiplayer` and `test_bridge_not_spawned_for_single_player`
- [x] **AC-4:** Bridge reconnects on PartyKit disconnect (within 5s)
  - Test: `TestBridgeReconnect::test_reconnect_delay_under_5s` (RECONNECT_DELAY ≤ 5s constant); `test_run_loop_retries_after_exception` (skipped when websockets not installed — integration test)

## Parking Lot

- **C++ WebSocket client**: originally planned with ixwebsocket. Parked — Python bridge achieves same result with less complexity. Revisit if sub-100ms latency becomes a requirement.
- **AC-4 integration test**: full end-to-end reconnect test requires live WebSocket server; skipped in unit test environment. Manually verified by code review of run() reconnect loop.

## Status

Status: done
GitHub issue: #65
PR: —
