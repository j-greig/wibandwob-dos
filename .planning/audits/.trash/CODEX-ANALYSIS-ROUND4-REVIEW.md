# Codex Round-4 Review: Verification Pass

**Raw log**: `codex-review-round4-20260218-201757.log`
**Token cost**: ~25,000 (Codex hit pytest-not-found before full findings output)
**Model**: gpt-5.3-codex

## Context

Verification-only pass after round-3 fixes. Codex could not run tests (pytest not in shell PATH
in its sandbox). It validated code structure and found:

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | Medium | Tests for `chat_receive` → `exec_command` routing were stale (asserted old `"chat_receive"` cmd) |
| 2 | Medium | `test_receive_delta_adopts_local_state_as_baseline` skipped the apply block because `_state_lock` was None (only set in `run()`) |
| 3 | Info | `windowTypeName()` is fully comprehensive — all 15 generative types covered |
| 4 | Info | `WindowTypeRegistry` k_specs table is correct and complete |
| 5 | Info | All round-3 fixes verified as correctly implemented in code structure |

## Fixes Applied (this session)

### Fix 1: Stale chat relay tests (tests/room/test_chat_relay.py)
Updated `test_remote_chat_calls_ipc` and `test_missing_instance_treated_as_remote` to assert
`exec_command` with `name="chat_receive"` params instead of old direct `"chat_receive"` call.

### Fix 2: Missing lock init in bridge test (tests/room/test_partykit_bridge.py)
Added `bridge._state_lock = asyncio.Lock()` inside the async test runner so `receive_loop`
doesn't short-circuit the apply block (which checks `if delta and self._state_lock`).

## Confirmed Safe/Correct (all rounds)

- `findWindowById` no longer clears ID maps — stable IDs, no desync loop
- `publish_event` partial writes + EINTR retry + backpressure drop — anti-stall behavior
- SIGPIPE hardening (MSG_NOSIGNAL / SO_NOSIGPIPE) — no process-kill from dead subscriber
- IPC percent-encoding end-to-end — spaces in paths/text safe
- WindowTypeRegistry data-driven dispatch — complete (all generative types)
- `windowTypeName()` — complete (all 15 generative/animated types via HAS_CHILD_VIEW + 8 direct casts)
- asyncio.Lock for all three concurrent coroutines (poll, event, state_delta)
- Auth handshake: sync path via `_ipc_auth_handshake`, async path via `_async_auth_handshake`
- `chat_receive` routed via `exec_command` → command registry
- `resize_window` sends `width`/`height` matching C++ IPC parser

## Test Status

**152 passed, 1 skipped** across all `tests/room/` tests.

## Remaining Work (not critical)

- P3 JSON dual-stack IPC — eliminates key-name drift permanently (large scope)
- Fix `text_view` spawn (uses `openAnimationFilePath` instead of `openTransparentTextFilePath`)
- E008 F05 stretch: Cursor overlay
- Move `TTestPatternWindow`/`TGradientWindow`/`TFrameAnimationWindow` to headers for full registry `matches` support
