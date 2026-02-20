# Codex Proactive Bug Hunt — 2026-02-18

**Raw log**: `codex-proactive-bugcheck-20260218.log`
**Token cost**: ~132,000
**Model**: gpt-5.3-codex

## Context

Proactive static audit after live multiplayer test revealed two fixed bugs:
1. `findWindowById` stale pointer (fixed: desktop liveness scan before return)
2. `ipc_command` false-FAIL (`{"success":true}` not recognised as ok, fixed)

Goal: find all remaining bugs of the same class before hitting them live.

## Findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | Critical | Python/C++ | No remote_id → local_id mapping — ID drift breaks update/remove after add |
| 2 | High | C++ | SIGPIPE crash risk: raw `::write` in auth/ack/command paths outside `publish_event` |
| 3 | High | Python | Blocking IPC calls inside async coroutines — stalls event loop on timeout |
| 4 | High | Python | Delta-apply failures logged only, never escalated or resynced |

## Confirmed Safe

- `test_pattern_app.cpp`: no `idToWin`/`winToId` deref outside `findWindowById` — all command handlers go through it (lines 2506, 2521, 2537, 2545).
- `api_ipc.cpp`: `publish_event` fully hardened — `MSG_NOSIGNAL`/`SO_NOSIGPIPE`, EINTR retry, short-write loop, iterator-safe erase (lines 592-629).
- `orchestrator.py`: ttyd → DEVNULL, bridge Popen stored and terminated on stop (lines 114-119, 137-145, 200-217).

## Not Verified

Static audit only. Live fault-injection (slow IPC, mid-write disconnect) not run.

---

## Fix Details

### Fix 1 (Critical): Remote → Local ID mapping

**Problem**: `create_window` IPC assigns a new local ID (w1, w2...) which may differ from the remote ID in the delta. Subsequent `update`/`remove` deltas use the remote ID → `FAIL move_window/close_window`.

**Fix**: Make `create_window` IPC return `{"success":true,"id":"wN"}`. Bridge reads the returned ID, stores `remote_id → local_id`. Delta apply translates IDs before sending IPC commands.

Files: `app/test_pattern_app.cpp` (create_window response), `tools/room/partykit_bridge.py` (id_map), `tools/room/state_diff.py` (apply_delta_to_ipc accepts id_map).

### Fix 2 (High): SIGPIPE-safe write helper

**Problem**: `::write()` at `api_ipc.cpp:187, 244, 328, 572, 577` — peer disconnect before response → SIGPIPE kills TUI process.

**Fix**: Extract `safe_write(fd, data, len)` helper using `send(..., MSG_NOSIGNAL)` on Linux / `SO_NOSIGPIPE` + retry on macOS. Replace all `::write` on client fds.

### Fix 3 (High): asyncio.to_thread for IPC calls

**Problem**: `ipc_get_state`, `ipc_command`, `apply_delta_to_ipc` are sync socket calls invoked directly from `async def` in `partykit_bridge.py` (lines 145, 234, 238, 247, 251, 263). Blocks event loop up to `IPC_TIMEOUT` per call.

**Fix**: Wrap with `await asyncio.to_thread(...)` at each call site.

### Fix 4 (High): FAIL escalation → resync

**Problem**: `apply_delta_to_ipc` returns a list of applied strings; FAIL entries are logged but bridge continues without recovery → permanent divergence.

**Fix**: After `apply_delta_to_ipc`, if any result starts with `FAIL`, increment failure counter. After N consecutive failures, send `{"type":"state_request"}` to PartyKit to trigger a fresh `state_sync`.
