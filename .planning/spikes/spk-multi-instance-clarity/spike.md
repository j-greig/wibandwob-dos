---
title: "Multi-instance clarity — stop agents and humans losing track of which WibWob is which"
status: done
branch: spike/multi-instance-clarity
---

# Spike: Multi-instance Clarity

**Prior art:** `scratch/devlog-2026-03-15-direct-mode-and-screenshot.md`

## One-liner

Agents hit the wrong WibWob instance because the transport layer has no
discovery or targeting — fix the transport, not the commands.

## The COAT Framing

COAT seams (command, inspection, window, workspace) are instance-agnostic.
The same commands work on any instance. The problem is **below** the seams:

```
  Transport layer (BROKEN)        COAT seams (fine as-is)
  ────────────────────────        ──────────────────────
  which socket/port?          →   /commands/run
  how to discover instances?  →   /state (inspection)
  how to target one?          →   /windows/batch
                                  /workspace/save
```

Discovery must happen **before** the first API call.

## Spike Answers

### Phase 1a: /health enrichment ✅ SHIPPED

```json
{
  "ok": true,
  "instanceId": "qgx",
  "instanceLabel": "main",
  "pid": 59849,
  "startedAt": "2026-03-15T09:57:34.798Z",
  "uptime": "8m",
  "port": 8099,
  "host": "127.0.0.1",
  "socketPath": "scratch/instances/main.sock"
}
```

Path config moved to `/config` endpoint. Health IS which.

### Phase 1b: Unix socket transport ✅ SHIPPED

- `Bun.serve({ unix })` works — dual-listen (socket + HTTP) in same process
- Socket created at `scratch/instances/<label>.sock` on startup
- Cleaned on `stop()` — but NOT on crash (see problems below)

### CLI targeting ✅ SHIPPED

- `wibwob --instance main health` — connects via socket
- `wibwob instances` — lists running instances via `ls *.sock` + health check
- `wibwob minimap` / `wibwob map` — spatial desktop HUD
- `WIBWOB_INSTANCE` env var — same as `--instance`
- Resolution: `--instance` > env vars > default HTTP

### Bun flag eating ⚠️ GOTCHA

Bun intercepts `-t`, `--instance`, and most `--` flags before the script
sees them. Only works reliably when:
- Run via shebang (`#!/usr/bin/env bun` → `./wibwob.ts --instance main`)
- Or via `bun run script.ts --instance main`

`bun script.ts --instance main` silently eats the flag. This is a Bun bug/design
choice. Workaround: the alias `wibwob='.../wibwob.ts'` uses shebang execution.

## Problems Discovered During Implementation

### 1. Orphan instances survive terminal death

When the terminal closes or crashes, the blessed TUI dies but the Bun process
often survives. The socket stays alive, the port stays bound. `wibwob health`
still responds but nobody can see the TUI.

**Root cause:** No `SIGHUP` handler. No `process.on('exit')` socket cleanup
that covers all crash paths.

### 2. Workspace restore doesn't cover microapps

`/workspace/load` uses the snapshot registry (`snapshot-registry.ts`). Only
window types with `registerSnapshot()` handlers are restored. Most microapps
(figlet, runtime-inspector, contour, plasma) don't have them.

The `desktop-save.sh` script captures full state from `/state` API (including
microapp details), but `workspace/load` can't replay it because it goes through
the snapshot registry path, not the command path.

**The gap:** Saved state has `{ appType: "wibwob.figlet", inputText: "JIM", font: "larry3d" }`
but restore needs either a snapshot handler or a command dispatch path.

### 3. Default workspace loaded on boot overwrites rescue

On startup, the app calls `restoreDefaultWorkspace()` which loads
`scratch/workspaces/default.json`. If we save an orphan's state to a named
workspace and then start a new instance, the default workspace loads first,
overwriting whatever was there. Loading the rescue workspace requires a
separate `/workspace/load` call after boot.

### 4. No auto-save on disconnect

When the terminal dies (SIGHUP), there's no auto-save. The orphan's state
is only preserved while it's running — once killed, it's gone unless
someone saved it first.

### 5. `default.json` gets wiped

The default workspace file sometimes gets cleared/deleted during restarts,
leaving `{ windows: [] }` or missing entirely. This means restarts always
start with an empty desktop.

## Reattach Vision (tmux model)

The dream: WibWob-DOS as a server, TUI as a detachable client.

```
  Terminal dies          Server keeps running       New terminal
      │                        │                        │
      │  SIGHUP ──────────►   │  auto-save workspace   │
      │  TUI detaches         │  socket stays alive    │
      │                       │                        │
      │                       │  ◄───── wibwob attach  │
      │                       │         reconnect TUI  │
      │                       │         restore render  │
```

**Why it's hard:** blessed assumes one TTY for life. `process.stdout` is
bound at process start. You can't redirect blessed to a new terminal without
either:
- Restarting blessed with a new TTY fd (invasive)
- Running blessed in a PTY that survives (tmux-inside-tmux)
- Separating the server (state + API) from the renderer (blessed) into
  two processes connected by IPC

**Pragmatic alternative (what can ship now):**

```
  Terminal dies          Orphan auto-saves          wibwob attach
      │                        │                        │
      │  SIGHUP ──────►  save workspace              │
      │                  to orphan-<id>.json          │
      │                  then exit cleanly            │
      │                                               │
      │                                    detect orphan workspace
      │                                    start new instance
      │                                    load orphan workspace
      │                                    clean up
```

This is achievable without architectural changes. It's the tmux
"session restore" model, not the tmux "reattach" model.

## Recommendation: Promote to Epic

This spike answered its questions but revealed 5 interconnected problems
that need coordinated work:

1. **Orphan cleanup** — SIGHUP handler, socket cleanup on all exit paths
2. **Microapp snapshot parity** — all Core 7 microapps need `registerSnapshot()`
3. **Auto-save on disconnect** — SIGHUP → save workspace → clean exit
4. **Workspace boot sequence** — support loading a named workspace on startup
5. **`wibwob attach`** — detect orphan workspace, start new instance, load it

These form a natural epic: **"Instance Lifecycle"** — from birth to death
to resurrection.
