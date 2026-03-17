---
id: E039
title: Instance Lifecycle
status: done
issue: ~
pr: ~
depends_on: []
---

# E039 — Instance Lifecycle

Make WibWob-DOS instances survivable: clean birth, clean death, resurrection
after crash. Follow the tmux model — session state outlives the terminal.

---

## Problem

Five interconnected failures discovered during the multi-instance clarity
spike (`spk-multi-instance-clarity`):

1. **Orphan instances** — terminal dies, process survives headless. Socket
   and port stay bound. Human thinks app is gone; `wibwob health` disagrees.
   No SIGHUP handler. No cleanup on crash paths.

2. **No auto-save on disconnect** — when the terminal closes, state is lost.
   No SIGHUP → save workspace → exit flow. If the orphan is later killed,
   everything is gone.

3. **Microapp snapshot gap** — `/workspace/load` uses the snapshot registry.
   Most microapps (figlet, runtime-inspector, contour, plasma) don't have
   `registerSnapshot()` handlers. Workspace save captures 1/4 windows.
   The full state IS available via `/state` API, but restore can't use it.

4. **Boot overwrites rescue** — `restoreDefaultWorkspace()` runs on startup,
   loading `default.json`. Even if we save the orphan's state, starting a
   new instance loads the default first. No way to say "boot into this
   workspace instead."

5. **No reattach flow** — no `wibwob attach` that detects an orphan's saved
   workspace, starts a new instance, and loads it. The pieces exist (save,
   start, load) but aren't wired together.

```
  What happens now:                    What should happen:

  Terminal dies                        Terminal dies
      │                                    │
      │  process orphaned                  │  SIGHUP caught
      │  socket alive                      │  auto-save workspace
      │  no save                           │  clean exit
      │  state = lost on kill              │  socket removed
      │                                    │
  Human restarts                       Human types: wibwob attach
      │                                    │
      │  empty desktop                     │  detects orphan workspace
      │  "where did my                     │  starts new instance
      │   windows go?"                     │  loads saved state
      │                                    │  "everything is back"
```

---

## Canon: `wibwob` is the command surface

`wibwob` is the single CLI — the COAT command seam exposed to shell.
Shell aliases (`ww-start`, `ww-clear`, etc. in `~/.wibwob`) are
**anti-pattern** — they fragment the command surface across two places
and hide semantics in dotfiles agents can't discover.

**Rule:** if an operation is worth doing from shell, it's worth being
a `wibwob` subcommand. Scripts (`scripts/*.sh`) are for multi-step
orchestration only — not thin wrappers around one API call.

| Anti-pattern | Fix |
|-------------|-----|
| `ww-start` (alias → `ensure-running.sh`) | `wibwob start` |
| `ww-restart` (alias → `restart.sh`) | `wibwob restart` |
| `ww-attach` (alias → `attach.sh`) | `wibwob attach` |
| `ww-clear` (alias → `wibwob cmd desktop.clear-all`) | already `wibwob desktop.clear-all` |
| `ww-state` (alias → `wibwob state \| jq`) | already `wibwob state` |
| `ww-shot` (alias → `wibwob screenshot`) | already `wibwob screenshot` |

F4 (`wibwob attach`) is a CLI subcommand, not a script alias.
F3 (`--workspace`) is a CLI flag, not an env var hack.

**Cleanup story:** Remove `ww-*` aliases from `~/.wibwob` once the
`wibwob` subcommands they wrap exist. Keep `~/.wibwob` for env vars
and `source`-able config only.

---

## What shipped in the spike (already committed)

| What | Status | Commit |
|------|--------|--------|
| `/health` enriched (label, pid, uptime, socketPath) | ✅ | control-api.ts |
| `/config` endpoint (paths moved out of /health) | ✅ | control-api.ts |
| Unix socket dual-listen (`scratch/instances/<label>.sock`) | ✅ | control-api.ts |
| Socket cleanup on `stop()` | ✅ | control-api.ts |
| `wibwob --instance <label>` CLI targeting | ✅ | wibwob.ts |
| `wibwob instances` — list via socket discovery | ✅ | wibwob.ts |
| `wibwob minimap` / `wibwob map` — spatial HUD | ✅ | wibwob.ts |
| `desktop-save.sh` — full state capture from API | ✅ | scripts/experimental/ |

---

## Features

### F1: Clean Death

**Goal:** Every exit path (SIGTERM, SIGHUP, crash, Ctrl-Q) saves state and
cleans up resources.

- [ ] S1: SIGHUP handler — catch terminal disconnect, trigger save + exit
- [ ] S2: Socket cleanup on all exit paths — `process.on('exit')`, SIGTERM,
      SIGHUP, uncaught exception
- [ ] S3: PID file cleanup on all exit paths
- [ ] S4: Auto-save workspace on SIGHUP (save to `orphan-<label>.json`)
- [ ] S5: Verify: kill terminal → socket gone, PID file gone, workspace saved

### F2: Microapp Snapshot Parity

**Goal:** All Core 7 microapps survive workspace save/restore.

- [ ] S1: `registerSnapshot()` for figlet-banner (serialize: text+font,
      restore: re-open with args)
- [ ] S2: `registerSnapshot()` for runtime-inspector (serialize: activeTab,
      restore: re-open)
- [ ] S3: `registerSnapshot()` for contour-studio (serialize: seed+config,
      restore: re-open)
- [ ] S4: Audit remaining Core 7 — which already have handlers?
      (command-lab ✅, world ✅, chatroom ✅, terminal ?)
- [ ] S5: Verify: save workspace with all 7 → load → all 7 restored

### F3: Boot Workspace Selection

**Goal:** An instance can start with a specific workspace, not just default.

- [ ] S1: CLI flag `--workspace <name>` or env `WIBWOB_WORKSPACE`
- [ ] S2: Startup sequence: if flag set, load that instead of default.json
- [ ] S3: If orphan workspace exists and no flag given, prompt or auto-load
- [ ] S4: Verify: `bun run dev:world --workspace orphan-main` → restores

### F4: `wibwob attach`

**Goal:** One command to resurrect from an orphan's saved state.

- [ ] S1: Detect orphan workspace file (`orphan-<label>.json`)
- [ ] S2: Detect stale socket (connect fails → orphan is truly dead)
- [ ] S3: Kill orphan process if still alive (stale PID file)
- [ ] S4: Start new instance with `--workspace orphan-<label>`
- [ ] S5: Clean up orphan artifacts (socket, PID, workspace file renamed
      to default)
- [ ] S6: Start via `wibwob start` (not shell alias, not script)
- [ ] S7: Verify: kill terminal → `wibwob attach` → everything back

### F5: `wibwob write` — Text Pipe Into Windows

→ **See [e039-f05-write.md](e039-f05-write.md)** for full spec.

Push text into a live window from stdin via the existing command seam.
`echo "HELLO" | wibwob write 3`. No new endpoint, no new SDK method —
COAT: just a command convention + CLI sugar. Plan 9 Rio inspired (#127).

### F6: `wibwob plumb` — Inter-Window Nervous System

→ **See [e039-f06-plumb.md](e039-f06-plumb.md)** for full spec.

Route data between windows. Plan 9's plumber for the symbient desktop.
Depends on F5 (write). Port registry, rules engine, `wibwob plumb`/`wire` CLI.

### F7: Self-Maintaining CLI Help

→ **See [e039-f07-cli-help.md](e039-f07-cli-help.md)** for full spec.

Replace hardcoded `usage()` + `switch` with single `CLI_COMMANDS` table.
Help auto-generates from the same array that drives dispatch. `completions`
already missing from help — proves the drift problem is real.

---

## Out of Scope

- **True reattach** (blessed reconnects to new TTY) — architecturally hard,
  blessed assumes one TTY for life. Would need server/renderer split.
  Park for future.
- **Remote/VPS multi-instance** — different auth model, different epic.
- **Process supervision** (systemd/launchd) — overkill for dev tool.

## Dependencies

- Socket transport (spike, already shipped)
- `desktop-save.sh` (experimental, already shipped)

## Risks

- blessed may not clean up escape codes on SIGHUP (terminal already dead)
- `registerSnapshot()` for some microapps may need SDK additions (e.g.
  restore args not currently supported for all window types)
- Workspace files can grow large if microapp state is verbose (journal
  payload is ~3KB alone)

## Key Files

| File | Role | Features |
|------|------|----------|
| `src/app.ts` | Signal handlers, PID lifecycle | F1 ✅ |
| `src/services/control-api.ts` | Socket create/cleanup, /health | F1 ✅ |
| `src/core/app-controller.ts` | Startup workspace restore, orphan detect | F3 ✅ |
| `src/core/cli.ts` | `--workspace` flag | F3 ✅ |
| `src/core/snapshot-registry.ts` | Per-type save/restore, legacy remaps | F2 ✅ |
| `src/core/types.ts` | PersistableAppType/TransientAppType cleanup | F2 ✅ |
| `src/cli/wibwob.ts` | `attach`, future `write` subcommand | F4 ✅, F5 |
| `microapps/figlet-banner/index.ts` | registerSnapshot, future `write` cmd | F2 ✅, F5 |
| `microapps/runtime-inspector/index.ts` | registerSnapshot | F2 ✅ |
| `microapps/contour-studio/index.ts` | registerSnapshot | F2 ✅ |
| `microapps/terminal/index.ts` | Future `write` command | F5 |
