# Multi-Instance IPC Debug Notes

tl;dr: Monitor works but user couldn't verify 3 instances because env var wasn't propagated. Root causes: silent IPC bind failure, no startup logging, stale sockets from previous runs. Fixes applied: stderr logging at startup. Remaining concerns below.

---

## What was observed

1. User launched 3 TUI instances in tmux panes
2. Monitor only showed 2 sockets: `test_pattern_app.sock` (legacy) + `wibwob_1.sock`
3. All 3 TUIs rendered fine visually — windows, art engines, browser all working
4. Logs (`/tmp/wibwob_*.log`) were completely empty — no way to tell what went wrong

## Root cause analysis

### Problem 1: Silent IPC bind failure

`ApiIpcServer::start()` returns `false` on bind failure but the caller (`TTestPatternApp` constructor) ignores the return value:

```cpp
ipcServer->start(sockPath);  // return value discarded
```

If two instances both try to bind `/tmp/test_pattern_app.sock`:
- Instance A succeeds (unlinks stale, binds fresh)
- Instance B calls `unlink()` (kills A's socket!), then `bind()` succeeds too
- Now B owns the socket, A's IPC is dead — but A's TUI keeps running fine

This is actually worse than a simple "second bind fails" — the `unlink()` at line 109 of `api_ipc.cpp` is a race: each new instance **deletes the previous instance's socket** before binding its own. Last writer wins, all others lose IPC silently.

### Problem 2: No startup logging

The TUI app wrote nothing to stderr on normal startup. No indication of:
- Which binary version is running (pre or post env var change)
- Which socket path was chosen
- Whether IPC bind succeeded or failed

**Fix applied:** Added `fprintf(stderr, ...)` at socket path derivation + IPC server start.

### Problem 3: Stale socket files

`/tmp/test_pattern_app.sock` and `/tmp/wibwob_1.sock` can persist after process death (crash, kill -9). The `unlink()` before `bind()` handles this, but it means `discover_sockets()` in the monitor can find sockets with no listener — it correctly reports these as DEAD, but they clutter the display.

### Problem 4: User confusion about env var

Without visible confirmation that `WIBWOB_INSTANCE` was read, it's unclear if:
- The env var was set before the binary launched
- The binary is the new build (with env var support) vs old build
- The tmux pane inherited the env var correctly

## Remaining concerns

### The unlink race is a real bug

Two instances sharing a socket path will **silently steal each other's IPC**. The fix is either:

1. **Don't unlink if socket is live** — check with `connect()` before `unlink()`, refuse to start if another instance is listening
2. **Lock file** — write a PID lockfile alongside the socket, check before starting
3. **Require WIBWOB_INSTANCE** in multi-instance mode — but legacy single-instance still has the race if user runs two without env var

Option 1 is simplest and most correct:

```cpp
bool ApiIpcServer::start(const std::string& path) {
    // Check if socket is already in use
    int probe = ::socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un probe_addr;
    std::memset(&probe_addr, 0, sizeof(probe_addr));
    probe_addr.sun_family = AF_UNIX;
    std::snprintf(probe_addr.sun_path, sizeof(probe_addr.sun_path), "%s", path.c_str());
    if (::connect(probe, (struct sockaddr*)&probe_addr, sizeof(probe_addr)) == 0) {
        // Socket is live — another instance owns it
        ::close(probe);
        fprintf(stderr, "[wibwob] IPC socket %s already in use\n", path.c_str());
        return false;
    }
    ::close(probe);
    // Safe to unlink stale socket and bind
    ...
}
```

### Monitor could show more context

- Instance ID (from socket name)
- Window titles (already done)
- Whether instance was reached by IPC or just found as a stale file
- Colour coding: green=LIVE, red=DEAD, yellow=TIMEOUT

### Log verbosity

Now that we have stderr logging, consider:
- Log window creation/destruction events
- Log IPC commands received (for debugging multi-instance routing)
- Use a consistent prefix: `[wibwob:N]` where N is instance ID

---

## Status

- [x] Startup stderr logging added (instance ID + socket path + IPC start)
- [ ] Unlink race fix (not yet — deferred, needs discussion)
- [ ] Window creation/destruction logging
- [ ] `start()` return value checking in constructor
