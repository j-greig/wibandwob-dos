# F05: IPC Safety (Socket Unlink Race)

## Parent

- Epic: `e007-browser-hosted-deployment`
- Epic brief: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`

## Objective

Fix the socket unlink race where two instances sharing a path silently steal each other's IPC. Probe before unlink, check `start()` return value, fail loudly on bind conflict.

## Context

From spike debug notes (`.planning/spikes/spk-xterm-pty-validation/multi-instance-debug.md`): when a new instance starts with the same socket path as a running one, `unlink()` removes the live socket and the new instance binds. The old instance silently loses IPC. This is silent data loss in multi-room deployment.

## Scope

**In:**
- Probe socket before unlink (connect attempt — if it responds, abort with error)
- Check `start()` return value, propagate bind failures
- Stderr logging on bind conflict with actionable message
- Stale socket cleanup (probe fails = safe to unlink)

**Out:**
- Socket locking/flock (overkill for this)
- PID file management

## Stories

- [x] `s09-probe-before-unlink` — connect-probe socket before unlink, abort if live
- [x] `s10-bind-failure-propagation` — check start() return, log and exit on bind failure

## Acceptance Criteria

- [x] **AC-1:** Starting instance B on same socket as running instance A fails with clear error
  - Test: start two instances with same WIBWOB_INSTANCE, second exits with error message
- [x] **AC-2:** Stale socket (no listener) is cleaned up and new instance binds successfully
  - Test: create orphan socket file, start instance, it cleans up and binds
- [x] **AC-3:** start() return value checked — bind failure does not silently continue
  - Test: inspect stderr output on deliberate bind failure

## Status

Status: done
GitHub issue: #57
PR: —
