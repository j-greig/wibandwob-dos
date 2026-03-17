---
title: "Instance targeting v2 — fix resolution, skip the rebrand"
status: open
prior_art: spk-multi-instance-clarity (done), wibmux prototype
branch: TBD
---

# Instance Targeting v2

## The problem in one sentence

The CLI defaults to port 8099. If your instance isn't on 8099, commands
silently go to the wrong place (or a dead process) and return `ok: true`.

## What actually happened (2026-03-17)

`dev:world` launched a daemonized instance via `script -q /dev/null`. It got
a 0×0 PTY (macOS `script` inherits calling terminal's winsize; daemonized =
no terminal = 0×0). This ghost registered as `main.sock` on port 8099. The
user's real instance (`bk7`) landed on port 8100 with no label.

`bun run wibwob cmd microapp.wibwob.journal.open` → hit the ghost → `ok:true`
→ Journal opened on a 1×1 screen nobody could see → user stared at blank TUI
for 15 minutes.

Also: 14 stale sockets from previous sessions in `scratch/instances/`.

## Root causes (not symptoms)

1. **Resolution defaults to port, not sockets.** `resolveBase()` skips
   straight to `http://127.0.0.1:8099` when no flag/env is set. The
   socket registry exists but isn't the default path.

2. **Broken instances advertise themselves as healthy.** A 0×0 screen
   instance creates a socket, responds to `/health` with `ok:true`, and
   accepts commands. Nothing in the system says "this instance is useless."

3. **Dead sockets accumulate.** No cleanup on startup or periodic probe.
   `scratch/instances/` fills with ghosts from crashed processes.

4. **`bun run dev` doesn't set a label.** Only `dev:world` sets
   `WIBWOB_INSTANCE_LABEL=main`. A bare `bun run dev` instance gets a
   random 3-char ID and no `main.sock` symlink.

## Vocabulary: keep "instance"

The v1 spike proposed renaming "instance" to "desktop." Don't.

- "Instance" is universally understood (Docker, cloud, systemd, databases).
  Agents and humans already know what it means.
- "Desktop" implies persistence and GUI. WibWob instances are ephemeral
  processes that die when you kill them.
- "Session" is overloaded (pi sessions, tmux sessions, agent sessions).
- The rename would touch every doc, script, agent prompt, and API response
  for zero functional gain.

Keep `--instance`, `WIBWOB_INSTANCE`, `instanceId`, `instanceLabel`.
Rename nothing.

## The fix: three things, in order

### 1. Refuse to register broken instances (~5 lines)

On startup, before creating a socket, check screen dimensions. If the
screen is 0×0 or 1×1, log a warning and skip socket registration. A
broken instance should not participate in discovery.

```typescript
// In control-api.ts, before socket creation
if (screen.width <= 1 || screen.height <= 1) {
  logger.warn(`Screen is ${screen.width}×${screen.height} — skipping socket registration`);
  // Still bind HTTP port for debugging, but no socket = invisible to CLI
  return;
}
```

This alone would have prevented the March 17 bug. The ghost instance
would never have created `main.sock`. The CLI would have found only
`bk7.sock` and used it.

### 2. Socket-first resolution with dead-socket cleanup (~40 lines)

Change `resolveBase()` to scan sockets before falling back to port:

```
1. --instance <label> or -i <label>  → scratch/instances/<label>.sock
2. $WIBWOB_INSTANCE env var          → scratch/instances/<label>.sock
3. Scan all sockets in scratch/instances/
   - Probe each with a health check, delete dead ones
   - If exactly 1 alive: use it
   - If multiple alive: error with list, require --instance
   - If 0 alive: fall back to port 8099 (backward compat)
```

Three levels, not five. No `.wibwob-instance` file (machine-local state
pretending to be project config — see "What not to build" below). No
walk-up-directory magic.

The "sole alive" heuristic covers the 90% case (one instance running).
The "multiple alive" error forces explicit targeting when it matters.
Port fallback preserves backward compat for scripts.

### 3. Health warns on multi-instance + screen size (~10 lines)

```bash
$ wibwob health
instance: bk7
pid: 60177
port: 8100
screen: 269×66
uptime: 12m
⚠ 2 instances running:
  main    pid=58593  screen=1×1   ← HEADLESS (screen too small)
  bk7     pid=60177  screen=269×66
```

Show screen dimensions. Flag headless instances. When there are multiple,
show all so the user can target explicitly.

## CLI flag: `--instance` / `-i`

Keep the existing `--instance` flag. Add `-i` as shorthand. No clash
with any existing flag in the CLI.

```bash
wibwob -i cinema health
wibwob --instance cinema health
WIBWOB_INSTANCE=cinema wibwob health
```

All three resolve the same way: look up `scratch/instances/cinema.sock`.

## Remote instances: SSH, not custom protocol

Don't build remote targeting into the CLI. SSH already solves it:

```bash
# Single command
ssh root@vps wibwob health
ssh root@vps wibwob -i gallery windows

# Pipe composition (text in, text out — the COAT thesis)
ssh root@vps wibwob read 3 | grep "pattern"
cat poem.txt | ssh root@vps wibwob write 5
wibwob read 3 | ssh root@vps wibwob write 7

# Multi-command with ControlMaster (one SSH handshake, many commands)
# ~/.ssh/config:
#   Host vps
#     ControlMaster auto
#     ControlPath /tmp/ssh-%r@%h:%p
ssh vps wibwob -i gallery cmd plasma.open --mood aurora
ssh vps wibwob -i gallery cmd desktop.tile
ssh vps wibwob -i cinema cmd theme.set --name phosphor
```

This works TODAY with zero code changes. SSH handles auth, encryption,
transport. `wibwob` on the remote machine handles local socket discovery.
ControlMaster handles connection reuse for multi-command scripts.

The Unix composition model (pipes, stdin/stdout) crosses the SSH boundary
transparently. `wibwob read` outputs text to stdout. `wibwob write` reads
stdin. SSH tunnels both. Nothing special needed.

### When SSH isn't enough

If latency becomes a problem (VJ show with 50 cues over SSH), the answer
is: run the choreography script ON the VPS, not over SSH. `scp` the
script, `ssh vps bash show.sh`. Same as you'd do with any other remote
automation. Don't build a custom RPC protocol for a problem `scp + ssh`
already solves.

If you genuinely need a persistent remote connection with event streaming
(live tail of window content, real-time state sync), that's a different
problem (WebSocket relay, not SSH). Design it when the need is real, not
before.

## What not to build

### No `.wibwob-instance` sticky file

The v1 spike proposed a `.nvmrc`-style file in the project root. Problems:

- **Machine-local state as project config.** `main` on my machine is not
  `main` on yours. If gitignored, it's invisible. If committed, it's
  wrong on every other machine.
- **Stale silently.** You `wibwob use cinema` three weeks ago, forgot.
  Every command now goes to an instance that may not exist. The error
  message says "cinema not found" and you have no idea why.
- **Worktree confusion.** Git worktrees share some files and not others.
  Does each worktree get its own file? Where does it live? The edge
  cases multiply.
- **Solves a problem that doesn't exist.** The env var
  (`WIBWOB_INSTANCE=cinema`) already works per-terminal-tab. Agent
  launchers can set it. No file needed.

### No @ syntax

The v1 spike proposed `wibwob @main health`. Cute, but:

- **Adds a second syntax for the same thing.** `--instance main` already
  works. Two ways to target = two code paths to maintain, two things to
  document, two things agents can get wrong.
- **Ambiguity with future extensions.** If you ever want `@user` mentions
  in chat, `@tag` references, or any other `@`-prefixed feature, the
  CLI parser has a conflict.
- **Remote `@host:instance` is premature.** The colon syntax was designed
  for a remote use case that SSH already handles. Don't bake transport
  routing into the CLI's argument parser.

`--instance` / `-i` is explicit, unambiguous, and follows every CLI
convention in existence. Use it.

### No resolution chain longer than 3

The v1 spike had 5 levels of fallback. Each level is a place where
debugging goes wrong. Three is the max:

1. Explicit flag or env var
2. Socket scan (sole alive)
3. Port fallback

If the user has to think about which level resolved their target, the
system is too clever.

## Implementation

### Files to change

| File | Change | Lines |
|------|--------|-------|
| `src/services/control-api.ts` | Skip socket registration if screen ≤1×1 | ~5 |
| `src/services/control-api.ts` | Clean dead sockets on startup | ~10 |
| `src/cli/wibwob.ts` (`resolveBase`) | Socket-first scan, probe-and-clean | ~30 |
| `src/cli/wibwob.ts` | Add `-i` alias for `--instance` | ~3 |
| `src/cli/wibwob.ts` | Health output: show screen size, multi-instance warning | ~10 |

Total: ~60 lines of functional code. One PR. Half a day.

### What to verify after shipping

1. **Zero instances alive:** CLI falls back to port 8099, prints
   connection error. Same as today.
2. **One instance alive:** CLI auto-detects via socket. No flag needed.
3. **Multiple instances alive:** CLI prints list, requires `-i <label>`.
4. **One alive + one headless (0×0):** Headless has no socket. CLI finds
   only the real one. Auto-detects correctly.
5. **Stale sockets from crashes:** Cleaned on CLI invocation (probe fails,
   socket deleted). Cleaned on instance startup.
6. **`bun run dev` (no label):** Instance registers with its random ID.
   Socket scan finds it. Works for the sole-instance case. For multi-
   instance, user must use `-i <id>` (the random 3-char). Suggest: make
   `dev` also set a label (e.g., `WIBWOB_INSTANCE_LABEL=dev`).

### Agent doc updates

- `AGENTS.md` Operating section: add `wibwob -i <label>` to examples
- `.pi/skills/ww-ops/SKILL.md`: add "check `wibwob instances` before
  first command if unsure which instance is targeted"
- `.agents/guides/shell/control-api.md`: document socket-first resolution

## Future (park, don't design)

- **Named instance groups** — `wibwob -i cinema,gallery cmd theme.set`
  targeting multiple instances. Only if there's a real use case.
- **Instance health metadata in socket** — embed screen size, PID, uptime
  in the socket file or a sidecar `.json` so CLI can filter without
  HTTP probes. Only if probe latency becomes a problem.
- **`wibwob instances --remote vps`** — SSH-based remote discovery.
  `ssh vps wibwob instances` already works. Only build a wrapper if
  the SSH invocation pattern proves too verbose.

---

## Compared to v1

| v1 spike | v3 | Why |
|----------|-----|-----|
| Rename instance → desktop | Keep "instance" | Known term, zero churn |
| @ prefix syntax | `--instance` / `-i` | One syntax, no ambiguity |
| `.wibwob-desktop` sticky file | Env var only | No machine-local config-as-code |
| 5-level resolution chain | 3 levels | Debuggable |
| `remotes.json` + SSH tunnel helper | `ssh host wibwob` | SSH already works |
| LEXICON entries for "desktop" | No vocabulary changes | Nothing to rename |
| Phase 1 + 2 + 3 roadmap | One PR, ~60 lines | Ship the janitor, defer the architect |
