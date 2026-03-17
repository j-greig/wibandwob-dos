---
id: E052
title: "Instance Lifecycle: Bulletproof Process Management for WibWob-DOS"
status: not-started
issue: ~
pr: ~
depends_on: [E048]
---

# E052 — Instance Lifecycle: Bulletproof Process Management

## Problem

Agents keep killing the human's visible TUI, targeting invisible zombie
instances, and leaving orphan processes. This has happened in at least 5
documented sessions (W12 devlog). Every workaround gets forgotten by the
next agent session because the footguns are in the default path:

- `restart.sh` spawns a headless daemon via `script -q /dev/null` — kills
  the Ghostty TUI, replaces it with an invisible 1×1 screen process
- `WIBWOB_API=http://127.0.0.1:8099` env var persists across shell sessions
  and silently routes commands to a dead/wrong instance
- `microapps.reload` doesn't invalidate Bun's module cache for deep imports —
  agents call `restart.sh` when reload "doesn't work"
- No process cleanup on startup — stale sockets accumulate, zombie instances
  linger, agents pick the wrong one
- Multiple instances have no clear "which one is the real TUI" signal

The pattern repeats because each fix is local (a doc update, a warning, a
new script) but the **default paths remain dangerous**.

## Goal

A single session should never be able to accidentally destroy another
session's TUI. Process discovery should be deterministic. Orphans should
be impossible to create silently.

## Principles

1. **Safe by default** — the obvious command does the safe thing
2. **Visible beats headless** — if there's ambiguity, prefer the instance
   with a real screen
3. **Explicit over ambient** — env vars should not override socket discovery
4. **Clean up after yourself** — processes register on start, deregister on exit
5. **Agents are not special** — same rules apply to human and agent callers

## Evidence trail

All from `.agents/reflections/2026-W12.md`:

- "Agent killed user's TUI by calling restart.sh — AGAIN" (line ~780)
- "Ghost instance targets invisible zombie" (line ~850)
- "Multi-instance targeting is still brutally hard for agents" (line ~768)
- "986 stale sockets need UX work" (line ~320)
- "WIBWOB_API env var poisoning" (line ~764)

## Scope

### F01 — Socket-first resolution (LANDED)

Socket scan wins over `WIBWOB_API` env var in `wibwob` CLI.

- [x] `src/cli/wibwob.ts` `resolveBase()` — socket scan at priority 3,
      env vars at priority 4
- [x] `scripts/lib/runtime-env.sh` — already socket-first

### F02 — Orphan cleanup command (LANDED)

`wibwob clean` — dry run, `--kill` with confirmation, healthy/orphan separation.

- [x] `src/cli/wibwob.ts` `cmdClean()` + `discoverCleanTargets()`
- [x] `scripts/clean-instances.sh`
- [x] Catches `script -q /dev/null` wrapper processes
- [x] Cross-platform (macOS + Linux/Alpine)

### F03 — Startup self-cleanup

On app boot, prune dead PID/socket files from `scratch/instances/`.
Prevents stale socket accumulation across restarts.

- [ ] `src/core/app-controller.ts` or entry point — scan and prune on init
- [ ] Remove sockets where PID file exists but process is dead
- [ ] Log pruned entries to startup output

### F04 — Graceful deregistration on exit

On SIGTERM/SIGINT, remove own PID + socket file before exiting.
Prevents orphan sockets from clean shutdowns.

- [ ] `src/app.ts` signal handlers — `fs.unlinkSync` PID + socket
- [ ] Handle crash case: `process.on('exit')` as safety net

### F05 — Prefer visible instances

When multiple instances exist and no `-i` flag is given, prefer the one
with a real screen (width × height > 1×1) over headless daemons.

- [ ] `src/cli/wibwob.ts` `findAliveInstances()` — probe each socket's
      `/health` endpoint, check screen dimensions
- [ ] If exactly one has screen > 1×1, auto-select it
- [ ] If multiple visible, still require `-i`
- [ ] `wibwob instances` output should show screen size + mark headless

### F06 — restart.sh safety gate

`restart.sh` should refuse to run if it detects a visible TUI instance
that it would kill. Require `--headless` flag to explicitly spawn a daemon.

- [ ] Check screen dimensions of running instance before killing
- [ ] If screen > 1×1: "This will kill a visible TUI. Use ghostty-launch.sh
      to restart the visible instance, or pass --headless."
- [ ] Default mode becomes "refuse if visible" not "kill and replace"

### F07 — Agent-safe restart path

Document and enforce the correct restart pattern for agents:

- Changed `index.ts` only → `wibwob cmd microapps.reload` or
  `bash scripts/reload-microapp.sh <id>`
- Changed deep imports → tell human to restart, or `ghostty-launch.sh`
- Changed `src/core/*` → tell human to restart
- **Never** `restart.sh` from agent context

- [ ] AGENTS.md — already updated (this session)
- [ ] `.agents/guides/shell/` — update if restart advice exists there
- [ ] Add `wibwob restart` CLI command that does the right thing
      (detects visible TUI, refuses or delegates to ghostty-launch)

## Key files

| File | Role |
|------|------|
| `src/cli/wibwob.ts` | CLI — resolution, clean, instances |
| `src/app.ts` | Entry point — signal handlers, startup |
| `src/core/app-controller.ts` | App lifecycle, socket creation |
| `scripts/restart.sh` | Dangerous restart (needs safety gate) |
| `scripts/ensure-running.sh` | Idempotent start |
| `scripts/ghostty-launch.sh` | Safe visible TUI restart |
| `scripts/clean-instances.sh` | Shell cleanup script |
| `scripts/lib/process-manager.sh` | Process lifecycle helpers |
| `scripts/lib/runtime-env.sh` | Socket discovery for shell scripts |
| `AGENTS.md` | Operating section — lifecycle rules |
| `.agents/reflections/2026-W12.md` | Pain evidence trail |

## Out of scope

- Remote instance management (Fly.io, SSH tunnels) — separate concern
- Terminal subsystem swap (xterm/headless) — E048 territory
- Multi-user / multi-machine — future

## Acceptance criteria

1. `restart.sh` refuses to kill a visible TUI without `--headless`
2. Startup cleans stale sockets — `scratch/instances/` never has dead entries
3. Clean shutdown removes own PID + socket — no orphan sockets from normal exits
4. `wibwob` auto-selects the visible instance when headless + visible coexist
5. An agent session that changes `src/core/*` cannot accidentally destroy
   the human's TUI — the default path is safe
