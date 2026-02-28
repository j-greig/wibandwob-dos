## F02 — Generator Bridge

Status: not-started
GitHub issue: #103
PR: —

### Summary

Manages the lifecycle of the `cli-v3.ts` subprocess. Spawns via `popen`/`posix_spawn`, wires stdout pipe to the view's fd, handles process exit/restart, and provides the "channel" abstraction (theme + primers + turns = one channel config).

### Stories

- [ ] **S05**: `BackroomsBridge` class — spawn subprocess, return stdout fd, track PID
- [ ] **S06**: Process lifecycle — detect exit, report status to view, support restart
- [ ] **S07**: Channel config struct — theme, primers vector, turns count, model name
- [ ] **S08**: Path resolution — `WIBWOB_BACKROOMS_PATH` env var, fallback to `../wibandwob-backrooms`

### Acceptance Criteria

AC-F02-1: Bridge spawns `npx tsx cli-v3.ts` and returns a readable fd.
Test: Spawn with theme "test", read first bytes from fd within 30s.

AC-F02-2: Bridge kills child process on `stop()` call.
Test: Spawn, call `stop()`, verify PID gone via `kill(pid, 0)`.

AC-F02-3: Bridge detects child exit and reports status.
Test: Spawn with `--turns 1`, wait for exit, verify bridge reports `exited` state.

AC-F02-4: Missing backrooms repo path produces clear error, not crash.
Test: Set env var to non-existent path, call `spawn()`, verify error string returned.
