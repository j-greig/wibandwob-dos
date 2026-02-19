# Codex Round-3 Review: IPC Hardening Verification

**Raw log**: `codex-review-round3-20260218-201023.log`
**Token cost**: ~40,087
**Model**: gpt-5.3-codex

## Context

Verification review of all round-2 fixes (SIGPIPE, partial writes, HMAC auth, asyncio.Lock,
ID stability, resize_window, percent-encoding, WindowTypeRegistry). Looking for remaining issues.

## Findings (Prioritised)

| # | Severity | Finding |
|---|----------|---------|
| 1 | Critical | `event_subscribe_loop` sends `subscribe_events` before auth handshake — subscription silently fails when `WIBWOB_AUTH_SECRET` is set |
| 2 | High | `resize_window` IPC sends `w`/`h` but server expects `width`/`height` — remote resize deltas fail |
| 3 | High | `state_delta` apply in `receive_loop` runs outside `_state_lock` — race with poll/event loops |
| 4 | Medium | `chat_receive` sent as `cmd:chat_receive` but IPC parser has no such branch — must use `cmd:exec_command name=chat_receive` |
| 5 | Medium | `publish_event` drops subscriber on `EINTR` — should retry write |
| 6 | Low | Auth challenge read in `authenticate_connection` is single-shot — partial frame can cause spurious auth failure |

## Key Fixes Needed

### Fix 1: Async auth handshake in event_subscribe_loop (partykit_bridge.py)

`event_subscribe_loop` uses asyncio `StreamReader/StreamWriter` (not the blocking socket used by
`ipc_send`). Need to add an async version of the HMAC handshake before sending `cmd:subscribe_events`.

When `WIBWOB_AUTH_SECRET` is set:
1. Read `{"type":"challenge","nonce":"<hex>"}\n` from reader
2. Compute HMAC-SHA256(secret, nonce), hex-encoded
3. Write `{"type":"auth","hmac":"<mac>"}\n` via writer
4. Read `{"type":"auth_ok"}\n` from reader
5. Only then send `cmd:subscribe_events\n`

### Fix 2: resize_window parameter names (state_diff.py)

`apply_delta_to_ipc` currently sends:
```python
ipc_command(sock_path, "resize_window", {"id": wid, "w": w, "h": h})
```
Server (`app/api_ipc.cpp:414-423`) reads `kv["width"]` and `kv["height"]`.
Fix: change to `{"id": wid, "width": w, "height": h}`.

### Fix 3: Lock state_delta apply path (partykit_bridge.py receive_loop)

`apply_delta_to_ipc` at line ~199 and the baseline refresh at ~203-206 must both be inside
`async with self._state_lock:`.

### Fix 4: Use exec_command for chat_receive (partykit_bridge.py)

Change:
```python
ipc_command(self.sock_path, "chat_receive", {"sender": sender, "text": text})
```
To:
```python
ipc_command(self.sock_path, "exec_command", {"name": "chat_receive", "sender": sender, "text": text})
```
(or add a direct `chat_receive` branch in api_ipc.cpp — the exec_command path is simpler).

### Fix 5: EINTR retry in publish_event (api_ipc.cpp)

In the partial-write loop, add `|| errno == EINTR` to the continue condition:
```cpp
} else if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) {
    if (errno == EINTR) continue;  // retry
    drop = true; break;
```

### Fix 6: Auth challenge line-framed read (api_ipc.cpp)

In `authenticate_connection`, read challenge in a loop until `\n`:
```cpp
while (raw.find('\n') == std::string::npos) {
    chunk = recv(fd, buf, sizeof(buf), 0);
    // ... append to raw
}
```

## Confirmed Safe/Correct

- `findWindowById` no longer clears ID maps — stable IDs, no desync loop
- `publish_event` partial writes + backpressure drop — anti-stall behavior
- SIGPIPE hardening (MSG_NOSIGNAL / SO_NOSIGPIPE) — no process-kill from dead subscriber
- IPC percent-encoding end-to-end — spaces in paths/text safe
- WindowTypeRegistry data-driven dispatch — clean, correct
- asyncio.Lock for last_windows (poll/event loops) — partial fix, state_delta path still needs it

## Next Steps

1. Apply fixes 1-4 immediately (correctness)
2. Apply fixes 5-6 (robustness)
3. Add tests for: auth handshake, resize_window params, percent-encoding, chat exec_command path
4. Consider P3 JSON dual-stack IPC — eliminates all key-name drift issues permanently
