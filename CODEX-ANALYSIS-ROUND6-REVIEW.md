# Codex Round-6 Review: Verification Pass

**Raw log**: `codex-review-round6-20260218.log`
**Token cost**: ~116,000
**Model**: gpt-5.3-codex

## Context

Verification pass after round-5 fixes (path emission for file-backed windows).

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | High | `asyncio.gather()` in `run()` deadlocks reconnect when `receive_loop` exits cleanly |
| 2 | Medium | `TAsciiImageWindow` not detected — falls back to "test_pattern" (acceptable: TU-local) |
| 3 | Medium | Test coverage gaps for async auth in event path, _state_lock edge cases |
| 4 | Low | `spawn_frame_player`/`spawn_text_view` accept empty path string |

## Confirmed Correct (all previously fixed items)

- `api_get_state` path emission for TTransparentTextWindow + TFrameAnimationWindow: correct
- `windowTypeName()`: complete for all registered multiplayer types
- `api_open_text_view_path`: correctly creates TTransparentTextWindow directly
- `TFrameAnimationWindow`: filePath_ stored in ctor + getFilePath() correct
- `apply_delta_to_ipc` path forwarding + percent-encoding: correct
- `_normalise_win`: sound
- `compute_delta`: no remaining issues
- `_state_lock` usage in receive_loop: correct
- `_async_auth_handshake`: sequence correct
- SIGPIPE protection: correct platform guards
- `authenticate_connection` read loop: handles partial reads + timeout
- `create_window` path handling via registry: correct

## Fixes Applied (this session)

### Fix 1: Clean WS disconnect triggers reconnect (High)

**Root cause**: `asyncio.gather()` requires ALL tasks to complete. When `receive_loop`
exits normally (clean server-side close), `poll_loop` and `event_subscribe_loop` keep
running forever — gather never returns, outer reconnect loop never fires.

**Fix** (`tools/room/partykit_bridge.py`):
- Replace `asyncio.gather(...)` with `asyncio.wait({...}, return_when=FIRST_COMPLETED)`
- Cancel pending tasks after any one completes
- Re-raise first exception from done tasks (or raise `ConnectionError` on clean exit)
- Propagate `CancelledError` cleanly for graceful shutdown

**Test**: `test_clean_disconnect_triggers_reconnect` — skipped when websockets not installed.

### Fix 2: Empty path accepted by spawn functions (Low)

**Fix** (`app/window_type_registry.cpp`):
- `spawn_frame_player`: `if (it == kv.end() || it->second.empty())`
- `spawn_text_view`: same guard

## Test Status

**154 passed, 2 skipped** across all `tests/room/` tests.

## Remaining Work (not critical)

- Medium: TAsciiImageWindow (image files) falls back to "test_pattern" — can't fix without
  exporting the class from ascii_image_view.h. Acceptable since image sync requires
  the same file path on both machines.
- Medium: Test coverage for async auth handshake in event subscription path
- P3 JSON dual-stack IPC — eliminates key-name drift permanently (large scope)
- E008 F05 stretch: Cursor overlay
- Fix pre-existing `command_registry_test` linker error (api_chat_receive symbol missing)
