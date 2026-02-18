# Codex Round-8 Review: Final Verification Pass

**Raw log**: `codex-review-round8-20260218.log`
**Token cost**: ~74,000
**Model**: gpt-5.3-codex

## Context

Final comprehensive sweep after rounds 3-7 fixes. Asked Codex to focus on
remaining subtle issues: partial update logic, t.exception() safety, writer
cleanup, percent-decoding, title churn, reconnect state.

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | Low | `_rect()` doesn't recurse through double-nested rect dicts — not produced by current PartyKit flow |

## All Clean (explicit verification)

- `add` defaults (x=0 y=0 w=40 h=20) safe when coords absent ✓
- `event_subscribe_loop` writer = None guard + finally cleanup ✓
- `FIRST_COMPLETED` with `not t.cancelled()` + `exc = t.exception(); if exc: raise exc` ✓
- `receive_loop` clean close → async for exits → run() raises ConnectionError ✓
- `last_windows` retained across reconnect — reasonable, avoids rebroadcast ✓
- C++ IPC parser percent-decodes token values (`api_ipc.cpp:358`) ✓
- `_normalise_win` does not strip title → no title-churn per-poll ✓
- `create_window` spawns without title (app generates its own) — parity gap, not a loop regression ✓

## Fixes Applied (this session before round-8)

### Fix: t.exception() double-call + CancelledError safety

`t.exception()` raises `CancelledError` on cancelled tasks (not returns it).
Previous code called it twice with `if t.exception(): raise t.exception()`.

Fixed to:
```python
if not t.cancelled():
    exc = t.exception()
    if exc is not None:
        raise exc
```

## Test Status

**156 passed, 2 skipped** across all `tests/room/` tests.

## Assessment: System is Robust

After 8 Codex review rounds, the only remaining items are:
- **Low / not in current flow**: double-nested rect in `_rect()`
- **Acceptable by design**: TAsciiImageWindow falls back to "test_pattern"
- **Pre-existing unrelated**: command_registry_test linker error
- **Large scope, future work**: P3 JSON dual-stack IPC, E008 F05 cursor overlay

The E008 multiplayer sync code is now hardened with:
- Correct async auth handshake for all IPC paths
- Lock protection against baseline races
- SIGPIPE immunity
- Reconnect on clean WS disconnect
- Path emission for file-backed windows
- No spurious move/resize on partial updates
- Proper task cleanup and exception propagation
