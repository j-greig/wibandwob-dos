---
title: "Instance targeting v2 — fix resolution, skip the rebrand"
status: open
prior_art: spk-multi-instance-clarity (done), wibmux prototype
branch: TBD
changelog:
  - v3.0 (2026-03-17): Initial bullshit-free rewrite. Killed desktop rename,
    @ syntax, sticky file, 5-level resolution chain, remote protocol.
    Reduced to ~60 lines — socket-first resolution, dead socket cleanup,
    screen size guard, -i flag.
  - v3.1 (2026-03-17): Folded ops review findings. Fixed screen check
    location (app-controller, not control-api). Replaced probe-and-delete
    with PID-based cleanup to avoid startup race. Killed port 8099 fallback
    (it IS the bug). Added probe timeout spec. Fixed line estimates. Added
    internal caller migration (buildLocalControlApiBaseUrl). Added minimum
    screen threshold. Added post-startup deregistration. Added worktree
    isolation note.
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

5. **Internal callers hardcode port 8099.** `buildLocalControlApiBaseUrl()`
   in `scramble-brain.ts`, `wibwob-agent-session.ts`, `agent-slash-commands.ts`,
   and `sdk/runtime-client.ts` always resolves to port 8099 regardless of
   which port the instance actually got. The agent session can silently
   send commands to the wrong instance (or a dead one).

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

### 1. Refuse to register broken instances

On startup, before creating a socket, check screen dimensions. If the
screen is below minimum usable size, log a warning and skip socket
registration. A broken instance should not participate in discovery.

**Minimum usable screen: 40×10.** Below this, no window can render
meaningfully (menubar + statusbar + chrome + 1 line of content needs
~10 rows; shortest useful line needs ~40 cols). This is deliberately
conservative — a 41×11 screen is still cramped but functional.

**Where the check goes:** `app-controller.ts`, gating the
`this.controlApi.start()` call. NOT in `control-api.ts` — that service
has no reference to the blessed screen. Pass dimensions in or check
before calling start:

```typescript
// In app-controller.ts, before controlApi.start()
const w = this.screen.width;
const h = this.screen.height;
if (w < 40 || h < 10) {
  logger.warn(`Screen ${w}×${h} below minimum 40×10 — socket registration skipped`);
  // HTTP port still binds for debugging, but no socket = invisible to CLI
} else {
  this.controlApi.start();
}
```

**Post-startup resize:** If the screen resizes below threshold after
startup (terminal minimized, tmux pane detached), deregister the socket:

```typescript
// In screen resize handler
if (this.screen.width < 40 || this.screen.height < 10) {
  this.controlApi.deregisterSocket();
} else if (!this.controlApi.hasSocket()) {
  this.controlApi.registerSocket();
}
```

This prevents an instance that was healthy at boot from becoming an
invisible ghost after a terminal resize.

### 2. Socket-first resolution with PID-based cleanup

Change `resolveBase()` to scan sockets before falling back. **No port
fallback** — port 8099 default is the bug, not backward compat.

```
1. --instance <label> or -i <label>  → scratch/instances/<label>.sock
2. $WIBWOB_INSTANCE env var          → scratch/instances/<label>.sock
3. Scan all sockets in scratch/instances/
   - For each socket, read the sidecar .pid file
   - Check if PID is alive: kill(pid, 0) — instantaneous, no network
   - Dead PID → delete socket + sidecar (safe, process is gone)
   - Alive PID but probe fails → skip (may be mid-startup), do NOT delete
   - If exactly 1 alive: use it
   - If multiple alive: error with list, require -i <label>
   - If 0 alive: error "no instances running" (NOT port fallback)
```

**Why PID-based, not probe-based:**
- `kill(pid, 0)` is a syscall, ~0ms. No network, no timeout needed.
- Avoids the startup race: socket exists, server not yet listening,
  probe fails, socket deleted, instance invisible forever.
- A socket whose PID is dead is DEFINITELY stale — safe to delete.
- A socket whose PID is alive but not responding is probably booting —
  safe to skip.

**Sidecar PID file:** On socket creation, also write
`scratch/instances/<label>.pid` containing the PID. One extra line in
`controlApi.start()`. The CLI reads this file instead of probing HTTP.

**Probe timeout (for health display only):** When the CLI does need to
probe for health info (screen size, uptime — for the multi-instance
table), use `AbortSignal.timeout(200)`. A hung instance returns
"unresponsive" in the table instead of blocking the CLI forever.

**Why no port 8099 fallback:**
The port fallback is exactly what caused the original bug. Keeping it
means the old broken path is always there as a silent safety net.
Internal callers (`buildLocalControlApiBaseUrl`) would continue to
silently use port 8099 even after the CLI is fixed. Kill the fallback.
If no sockets are alive and no explicit target is set, the correct
behavior is an error, not "guess port 8099."

### 3. Health shows screen size + multi-instance warning

```bash
$ wibwob health
instance: bk7
pid: 60177
port: 8100
screen: 269×66
uptime: 12m
⚠ 2 instances running:
  main    pid=58593  screen=1×1   ← HEADLESS (below 40×10 minimum)
  bk7     pid=60177  screen=269×66  ← you are here
```

Requires: add `screen: { width, height }` to `/health` response (new
field, ~3 lines in control-api.ts). CLI scans all sockets for the
multi-instance table (reuses the scan from resolveBase).

## CLI flag: `--instance` / `-i`

Keep the existing `--instance` flag. Add `-i` as shorthand. No clash
with any existing flag in the CLI.

```bash
wibwob -i cinema health
wibwob --instance cinema health
WIBWOB_INSTANCE=cinema wibwob health
```

All three resolve the same way: look up `scratch/instances/cinema.sock`.

**Implementation note:** The current `findFlag()` only checks one name.
Needs to check both `--instance` and `-i`. The `filteredArgs` loop in
`main()` must strip both forms, including `-i=cinema` (non-standard but
defensive). ~15 lines, not 3.

## Internal callers: migrate off port 8099

`buildLocalControlApiBaseUrl()` is used by:
- `scramble-brain.ts` — agent brain talks to control API
- `wibwob-agent-session.ts` — agent session setup
- `agent-slash-commands.ts` — slash command execution
- `sdk/runtime-client.ts` — SDK runtime bridge

These all resolve to `http://127.0.0.1:8099` at module scope. They need
to use the socket instead. Since these run INSIDE the instance process,
they can read the socket path from config (they already know their own
instance label). Change `buildLocalControlApiBaseUrl()` to return a
unix socket URL when available, HTTP port as fallback for tests.

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

Three levels max:

1. Explicit flag or env var
2. Socket scan (sole alive via PID check)
3. Error — no silent fallback

If the user has to think about which level resolved their target, the
system is too clever. Two levels of implicit resolution is the maximum.

## Worktree isolation

Socket scan is per-worktree by design. Each worktree has its own
`scratch/instances/` directory (`SCRATCH_BASE` is relative to repo root
via `config.ts`). Running `wibwob` from worktree A only finds instances
started from worktree A. This is correct — each worktree is a separate
project context with separate state.

Consequence: an agent in worktree A cannot talk to an instance in
worktree B via socket scan. They must use `-i` with a socket path
or know the port. This is intentional isolation, not a bug.

## Implementation

### Files to change

| File | Change | Est. lines |
|------|--------|------------|
| `src/core/app-controller.ts` | Screen size guard before controlApi.start() | ~8 |
| `src/core/app-controller.ts` | Deregister socket on resize below threshold | ~10 |
| `src/services/control-api.ts` | Write .pid sidecar on socket creation | ~5 |
| `src/services/control-api.ts` | Add screen dimensions to /health response | ~3 |
| `src/services/control-api.ts` | Add deregisterSocket() / registerSocket() methods | ~15 |
| `src/cli/wibwob.ts` (resolveBase) | Socket-first scan with PID-based cleanup | ~50 |
| `src/cli/wibwob.ts` | Add `-i` alias + strip both forms from args | ~15 |
| `src/cli/wibwob.ts` | Health output: screen size, multi-instance table | ~30 |
| `src/services/control-api-url.ts` | `buildLocalControlApiBaseUrl` → prefer socket | ~15 |
| Internal callers (4 files) | Verify they use updated URL builder | ~5 each |

Total: ~170 lines of functional code. One PR. 1–2 days.

### What to verify after shipping

1. **Zero instances alive:** CLI prints "no instances running — start
   with `bun run dev`". Clean error, no silent fallback.
2. **One instance alive:** CLI auto-detects via PID-checked socket.
   No flag needed.
3. **Multiple instances alive:** CLI prints list with screen sizes,
   requires `-i <label>`.
4. **One alive + one headless (0×0):** Headless skipped socket
   registration at startup. CLI finds only the real one.
5. **Stale sockets from crashes:** PID check finds dead process,
   socket + sidecar deleted. Instant, no network probe needed.
6. **Instance mid-startup:** PID alive, probe would fail. CLI sees
   alive PID, attempts connection, gets ECONNREFUSED. Reports
   "instance <label> starting up, retry in a moment." Does NOT
   delete the socket.
7. **Terminal resize to 0×0:** Socket deregistered. CLI no longer
   finds it. Re-registered on resize back above threshold.
8. **`bun run dev` (no label):** Instance registers with random ID.
   Socket scan finds it. Suggest: make `dev` set a default label.
9. **Internal callers (agent session, scramble-brain):** Use socket
   path from config, not port 8099. Verify agent can run commands
   on non-8099 instances.

### Agent doc updates

- `AGENTS.md` Operating section: add `wibwob -i <label>` examples
- `.pi/skills/ww-ops/SKILL.md`: add "run `wibwob instances` before
  first command if unsure which instance is targeted"
- `.agents/guides/shell/control-api.md`: document socket-first resolution

## All lifecycle in TypeScript, not bash

The app creates sockets, the app cleans them up. No libraries needed —
just `fs`, `process.pid`, `process.kill()`, `process.on()`. These are
OS-level primitives available in every runtime. ~30 lines total.

Bash is ONLY the launcher (`bun run dev`). Everything else is TypeScript
owning its own lifecycle.

### Startup: scan and clean (app-controller.ts)

```typescript
// Before creating own socket, clean dead siblings
for (const file of fs.readdirSync('scratch/instances/')) {
  if (!file.endsWith('.pid')) continue;
  const pid = Number(fs.readFileSync(`scratch/instances/${file}`, 'utf8'));
  try { process.kill(pid, 0); }  // alive? leave it
  catch {                         // dead → clean up
    fs.unlinkSync(`scratch/instances/${file}`);
    const sock = file.replace('.pid', '.sock');
    try { fs.unlinkSync(`scratch/instances/${sock}`); } catch {}
  }
}
```

`process.kill(pid, 0)` doesn't kill anything — signal 0 just asks
"does this process exist?" Throws ESRCH if not. Instantaneous syscall,
no network, no timeout.

### Socket + PID creation (control-api.ts)

```typescript
// On socket creation, write sidecar PID file
fs.writeFileSync(`scratch/instances/${label}.pid`, String(process.pid));
```

One line. The socket file is created by `Bun.serve({ unix: path })`.
The PID file is our addition — it lets the CLI check liveness without
connecting.

### Clean shutdown (control-api.ts)

```typescript
for (const sig of ['SIGTERM', 'SIGINT', 'exit'] as const) {
  process.on(sig, () => {
    try { fs.unlinkSync(`scratch/instances/${label}.sock`); } catch {}
    try { fs.unlinkSync(`scratch/instances/${label}.pid`); } catch {}
  });
}
```

Covers normal shutdown (SIGTERM), Ctrl-C (SIGINT), and process.exit().
If the process is kill -9'd or the machine loses power, cleanup doesn't
run — the startup scan on next boot handles it.

### CLI: PID-based socket scan (wibwob.ts)

```typescript
function findAliveInstances(): Array<{ label: string; socketPath: string }> {
  const dir = 'scratch/instances';
  const alive: Array<{ label: string; socketPath: string }> = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.pid')) continue;
    const label = file.replace('.pid', '');
    const pid = Number(fs.readFileSync(`${dir}/${file}`, 'utf8'));
    try {
      process.kill(pid, 0);  // alive
      alive.push({ label, socketPath: `${dir}/${label}.sock` });
    } catch {                 // dead — clean up
      try { fs.unlinkSync(`${dir}/${file}`); } catch {}
      try { fs.unlinkSync(`${dir}/${label}.sock`); } catch {}
    }
  }
  return alive;
}
```

No HTTP probes, no timeouts, no race conditions. The entire scan
takes microseconds even with 100 stale sockets.

## Future (park, don't design)

- **Named instance groups** — `wibwob -i cinema,gallery cmd theme.set`
  targeting multiple instances. Only if there's a real use case.
- **Instance health metadata in sidecar** — embed screen size, uptime
  in the `.pid` sidecar (make it `.json`) so CLI can filter without
  HTTP probes. Only if probe latency becomes a problem.
- **`wibwob instances --remote vps`** — SSH-based remote discovery.
  `ssh vps wibwob instances` already works. Only build a wrapper if
  the SSH invocation pattern proves too verbose.
- **PID + instance ID in TUI chrome** — show `bk7 (60177)` in the
  top-right status area so screenshots and text dumps immediately
  identify which process you're looking at. Tiny change, big debug
  value. (Sidecar question sent to wwdos1.)

---

## Compared to v1

| v1 spike | v3.1 | Why |
|----------|------|-----|
| Rename instance → desktop | Keep "instance" | Known term, zero churn |
| @ prefix syntax | `--instance` / `-i` | One syntax, no ambiguity |
| `.wibwob-desktop` sticky file | Env var only | No machine-local config-as-code |
| 5-level resolution chain | 3 levels (no silent fallback) | Debuggable |
| Probe-and-delete sockets | PID-check-and-delete | No startup race condition |
| Port 8099 fallback | Error on no instances | Fallback IS the bug |
| `remotes.json` + SSH tunnel helper | `ssh host wibwob` | SSH already works |
| LEXICON entries for "desktop" | No vocabulary changes | Nothing to rename |
| Phase 1 + 2 + 3 roadmap | One PR, ~170 lines, 1–2 days | Honest estimate |
| Screen check in control-api.ts | Screen check in app-controller.ts | Correct file |
| No internal caller migration | Migrate buildLocalControlApiBaseUrl | Fix the hidden port-8099 refs |
