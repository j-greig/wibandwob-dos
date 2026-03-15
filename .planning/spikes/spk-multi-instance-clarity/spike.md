---
title: "Multi-instance clarity — stop agents and humans losing track of which WibWob is which"
status: not-started
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

An agent can't run `wibwob which` to find out which instance it's on —
that's circular (it already had to pick a port to connect). Discovery
must happen **before** the first API call.

## Problem

```
  Agent A                              Agent B
    │                                    │
    │  curl :8099/commands/run ───►  instance "main" (what human sees)
    │                                    │
    │                                    │  curl :8099/commands/run ──?
    │                                    │  port taken? new instance?
    │                                    │  silent fallback to :8098?
    │                                    │
    │  "I opened it" ──► human          │  "I opened it" ──► human
    │                     sees nothing   │                     sees nothing
    │                     (wrong one)    │                     (or right one??)
```

No discovery. No targeting. No way to know before connecting.

## Current /health Response

```json
{
  "ok": true,
  "port": 8099,
  "host": "127.0.0.1",
  "instanceId": "cyg",
  "requestedPort": 8099,
  "scratchBase": "...",
  "capturesDir": "...",
  "workspacesDir": "...",
  "statePath": "..."
}
```

**Missing:** `instanceLabel`, `pid`, `startedAt`, `uptime`, `socketPath`.
The inspection seam doesn't fully describe the instance identity.

## Solution: Two Phases

### Phase 1: Fix /health + socket transport (the real fix)

**1a. Enrich /health** — make the inspection seam fully describe the instance:

```json
{
  "ok": true,
  "instanceId": "cyg",
  "instanceLabel": "main",
  "pid": 12345,
  "startedAt": "2026-03-15T09:00:00Z",
  "uptime": "2h 14m",
  "port": 8099,
  "socketPath": "scratch/instances/main.sock",
  "host": "127.0.0.1"
}
```

Drop the path noise (`scratchBase`, `capturesDir`, etc.) — that's config,
not identity. Move to a `/config` endpoint if anyone needs it.

Then `wibwob health` becomes the identity surface. No `which` needed —
health already answers "who am I talking to?"

**1b. Unix socket transport** — structural fix for discovery + targeting:

```
scratch/instances/
  main.sock              ← Bun.serve({ unix: path })
  zuk.sock               ← second instance
```

Each instance dual-listens:

```
  ┌─────────────────────────────────────────────┐
  │  WibWob-DOS  label:"main"  id:cyg           │
  │                                              │
  │  Bun.serve({ unix: "instances/main.sock" })  │  ← local agents
  │  Bun.serve({ port: 8099 })                  │  ← remote/VPS
  │                                              │
  │  blessed TUI ◄── same process ──► API        │
  └─────────────────────────────────────────────┘
```

**Discovery** (before any API call):

```bash
ls scratch/instances/*.sock    # what exists?
# → main.sock  zuk.sock

# try connect to verify alive:
curl --unix-socket scratch/instances/main.sock http://localhost/health
```

Dead socket = dead instance. `connect()` fails → auto-clean the file.
No registry. No health-check polling. The filesystem IS the registry.

**Targeting:**

```bash
wibwob -t main cmd figlet.open --text HELLO
#       ↑ resolves to main.sock, then uses COAT seams normally

wibwob -t zuk screenshot 3
```

CLI resolution order:
1. `-t label` → `scratch/instances/{label}.sock`
2. `$WIBWOB_INSTANCE` env var → socket
3. `$WIBWOB_API` → HTTP URL (existing, remote)
4. Default: first `.sock` found (or `http://127.0.0.1:8099` fallback)

**Information flow (fixed):**

```
  Agent                    Socket               TUI (blessed)
    │                        │                       │
    │  ls *.sock ──────────► │ (filesystem)          │
    │  found: main.sock      │                       │
    │                        │                       │
    │  connect main.sock ───►│                       │
    │  GET /health           │                       │
    │  ◄── { label:"main",   │── same process ──────►│
    │       id:"cyg", ... }  │                       │
    │                        │                       │
    │  GUARANTEED: this is   │                       │
    │  the "main" instance   │   ← human sees this   │
    │  the human is watching │                       │
```

### Phase 2: Evaluate if `wibwob which` is still needed

After phase 1, `wibwob health` returns full identity including label.
`wibwob -t main health` confirms targeting. `ls *.sock` discovers.

`wibwob which` would just be `wibwob health | pretty-print` — probably
not worth a separate command. If agents need a preamble, it's:

```bash
wibwob health   # already tells you everything
```

**Verdict: probably not needed.** Health IS which.

## Scope

**In:** socket transport, /health enrichment, CLI `-t` flag, socket cleanup on exit
**Out:** remote multi-instance, systemd lifecycle, formal process supervision

## Files Touched

| File | Change |
|------|--------|
| `src/app.ts` | Create socket on startup, clean on exit |
| `src/runtime/runtime-node.ts` | Dual-listen (socket + HTTP), socket path in identity |
| `src/services/control-api.ts` | Enrich `/health` response |
| `src/cli/wibwob.ts` | `-t` flag, socket-first connect, `instances` subcommand |
| `scripts/lib/runtime-env.sh` | Socket discovery before HTTP fallback |

## Test Plan

1. Start main instance → `main.sock` appears
2. Start alt instance → `zuk.sock` appears
3. `wibwob -t main health` → returns main's identity
4. `wibwob -t zuk health` → returns zuk's identity
5. Kill main → `wibwob -t main health` fails → sock auto-cleaned
6. `wibwob instances` → lists live instances
7. Agent connects without `-t` → picks first/only socket → correct
