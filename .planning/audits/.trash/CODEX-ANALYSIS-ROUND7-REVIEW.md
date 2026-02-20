# Codex Round-7 Review: Verification Pass

**Raw log**: `codex-review-round7-20260218.log`
**Token cost**: ~74,000
**Model**: gpt-5.3-codex

## Context

Verification pass after round-6 fixes (reconnect deadlock, empty path guard).

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | High | `apply_delta_to_ipc` sends spurious `move_window x=0 y=0` on size-only update deltas |
| 2 | Medium | `event_subscribe_loop` writer not closed/awaited on task cancellation — FD leak under reconnect churn |
| 3 | Medium | EINTR retry in `publish_event` is unbounded — theoretical; non-blocking sockets make this academic |
| 4 | Low | Nondeterministic which exception raised when multiple tasks fail simultaneously in `run()` |

## Confirmed Correct

- `asyncio.wait(FIRST_COMPLETED)` + task cancellation in `run()`: correct, no task leak
- `CancelledError` propagation: correct — re-raised for graceful shutdown
- `receive_loop` clean close → `run()` raises `ConnectionError` → reconnect fires
- `ConnectionClosed*` from websockets also reconnects correctly
- `publish_event` iterator invalidation: `it = erase(it)` pattern is correct

## Fixes Applied (this session)

### Fix 1: No spurious move on size-only update (High)

**Root cause**: `rect.get("x", 0)` default fires even when `x` not in delta → sends
`move_window id=wXX x=0 y=0` for any size-only update, jumps window to origin.

**Fix** (`tools/room/state_diff.py` update loop):
- Check `"x" in rect and "y" in rect` before calling `move_window`
- Check `"w" in rect or "width" in rect` (and same for h) before `resize_window`
- Use `rect["x"]` (not `.get("x", 0)`) so missing keys are never defaulted

**Tests**: `test_size_only_update_no_spurious_move`, `test_position_only_update_no_spurious_resize`

### Fix 2: Close writer in finally block (Medium)

**Fix** (`tools/room/partykit_bridge.py event_subscribe_loop`):
- Added `writer = None` before try block
- Added `finally:` clause: `writer.close(); await writer.wait_closed()` wrapped in
  `contextlib.suppress(Exception)` to handle already-closed writer gracefully

## Test Status

**156 passed, 2 skipped** across all `tests/room/` tests.

## Remaining Work (not critical)

- TAsciiImageWindow falls back to "test_pattern" — acceptable (TU-local, needs same files on both machines)
- Unbounded EINTR retry in publish_event — academic on non-blocking sockets
- Nondeterministic exception ordering in FIRST_COMPLETED — cosmetic, reconnect still fires
- E008 F05 stretch: Cursor overlay
- P3 JSON dual-stack IPC (eliminates key-name drift permanently, large scope)
- Fix pre-existing `command_registry_test` linker error
