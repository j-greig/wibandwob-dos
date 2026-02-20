# Codex Round-2 Review: IPC Architecture Hardening

**Raw log**: `codex-review-round2-20260218-200353.log`
**Token cost**: ~63,700
**Model**: gpt-5.3-codex

## Context

Review of P0 (WindowTypeRegistry) and P1 (Event push) implementations, looking for remaining
robustness issues.

## Findings (Prioritised)

| # | Severity | Finding |
|---|----------|---------|
| 1 | Critical | Auth mismatch — orchestrator sets `WIBWOB_AUTH_SECRET`, bridge has no HMAC handshake |
| 2 | Critical | SIGPIPE crash risk — `::write` to dead subscriber fd can kill TUI process |
| 3 | High | Partial writes in `publish_event` — short writes truncate JSON, EAGAIN not handled |
| 4 | High | ID stability — `findWindowById` (line 658) clears maps, reassigns IDs, causes desync |
| 5 | High | Delta apply misses resize — only `move_window` sent, never `resize_window` for w/h changes |
| 6 | High | IPC param encoding unsafe — spaces in paths/text break key=value tokenisation |
| 7 | Medium | `last_windows` coroutine race — stale baseline can overwrite after awaited `push_delta` |
| 8 | Medium | `text_view` spawn uses `openAnimationFilePath` instead of `openTransparentTextFilePath` |

## Key Fixes Needed

### Fix 1: Python HMAC auth handshake (state_diff.py `ipc_send`)
Protocol: receive `{"type":"challenge","nonce":"<hex>"}`, send `{"type":"auth","hmac":"<hmac>"}`,
wait for `{"type":"auth_ok"}`. HMAC is HMAC-SHA256(secret, nonce), hex-encoded.

### Fix 2: C++ SIGPIPE protection (api_ipc.cpp `publish_event`)
Replace `::write` with `::send(fd, ..., MSG_NOSIGNAL)` on Linux. On macOS use
`setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one))` on the fd.

### Fix 3: Partial write handling (api_ipc.cpp `publish_event`)
Current: `n >= 0` = success. Fix: loop on partial writes; drop subscriber if buffer fills.

### Fix 5: Add resize_window to delta apply (state_diff.py)
When an update has changed `w` or `h`, also send `resize_window id=X w=Y h=Z`.

### Fix 6: URL-encode IPC params (state_diff.py `ipc_command`)
All param values containing spaces need encoding. Simplest: percent-encode `%20` for spaces,
or switch to JSON IPC (P3).

### Fix 7: asyncio.Lock for last_windows (partykit_bridge.py)
Add `self._state_lock = asyncio.Lock()` and acquire it in `_sync_state_now` around the
diff+update block to prevent interleaving.

## Next Steps

1. Apply fixes 1-3 immediately (prevent silent failures and crashes)
2. Apply fixes 5-7 (correctness)
3. Implement P3 JSON dual-stack IPC (solves fix 6 permanently)
4. Fix text_view spawn helper (fix 8)
