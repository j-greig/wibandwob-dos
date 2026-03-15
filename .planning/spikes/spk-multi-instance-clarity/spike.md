---
title: "Multi-instance clarity — stop agents and humans losing track of which WibWob is which"
status: not-started
branch: spike/multi-instance-clarity
---

# Spike: Multi-instance Clarity

**Prior session review:** `scratch/devlog-2026-03-15-direct-mode-and-screenshot.md`
— reviewed this spike's option D (hybrid registry file), concluded it's over-engineered.
Recommends unix sockets (`Bun.serve({ unix })` works today) as the structural fix
+ `wibwob which` as the immediate 30-minute fix. See § Revised Recommendation below.

## One-liner

Agents and humans routinely act on the wrong WibWob instance because nothing
enforces or surfaces which instance an API call targets.

## Problem Statement

When multiple pi agents are active, each may launch or connect to a different
WibWob-DOS instance. An agent reports "I opened the window" and confirms via
API — but the human is looking at a *different* instance in their Ghostty
terminal. The API response is truthful but for the wrong audience.

**Symptoms observed:**
- Agent says "done, window is open" → human sees nothing (wrong instance)
- Human says "session 0t6" → agent connects to whatever is on port 8099
- Stale bun processes accumulate (3+ instances, 95%+ CPU each)
- `instanceId` is a random 3-char code — meaningless to humans, never displayed
  prominently, changes every restart
- No discovery: agents can't ask "which instances exist?" — they just try 8099

## Current Architecture

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                        Human's view                             │
 │                                                                 │
 │   Ghostty terminal                                              │
 │   └─ tmux session "wibwob"                                     │
 │      └─ WibWob-DOS (blessed TUI)  ← what the human SEES        │
 │         instanceId: ???                                         │
 │         port: 8099                                              │
 └─────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────┐
 │                      Agent A's view                             │
 │                                                                 │
 │   pi session (headless)                                         │
 │   └─ curl http://127.0.0.1:8099/...  ← what the agent TALKS TO │
 │      └─ maybe the same instance, maybe not                     │
 │         instanceId: checked once via /health, then forgotten    │
 └─────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────┐
 │                      Agent B's view                             │
 │                                                                 │
 │   pi session (headless)                                         │
 │   └─ starts NEW instance (tmux new / bun run dev)              │
 │      └─ port 8099 already taken → silent failure? or steals it? │
 │         OR: uses 8098 → human doesn't know to look there       │
 └─────────────────────────────────────────────────────────────────┘
```

### Identity & Port Model (current)

| Concept | How it works | Problem |
|---------|-------------|---------|
| `instanceId` | Random 3-char (e.g. `2c6`), generated at startup | Meaningless, changes every restart, not memorable |
| `instanceLabel` | Env var `WIBWOB_INSTANCE_LABEL` (e.g. `main`, `zuk`) | Only set in package.json scripts, agents don't use it |
| Port | `CONTROL_API_PORT` env var, default `8099` | Fixed per-process, no auto-discovery of others |
| PID file | `scratch/wibwob.pid` (or `scratch/alt/wibwob.pid`) | Per scratch dir, not queryable cross-instance |
| tmux session | Convention: `wibwob` for main | Agents create ad-hoc sessions, no naming convention |

### Information Flow (current)

```
  Agent                    API                     TUI (blessed)
    │                       │                          │
    │  curl /health  ──────►│                          │
    │  ◄── { instanceId,    │                          │
    │       port, ... }     │                          │
    │                       │                          │
    │  curl /commands/run ─►│──── opens window ───────►│
    │  ◄── { ok: true }    │                          │  ← human may be
    │                       │                          │    looking at a
    │  "I opened it" ──────────────────────────────────│    DIFFERENT instance
    │  (to human)           │                          │
    │                       │                          │

  No feedback loop: agent doesn't know which TUI the human is watching.
  Human doesn't know which port the agent is using.
```

## Questions to Answer

1. **Discovery:** How should an agent find all running WibWob instances?
   - PID files? Unix sockets? Port scan? Registry file?
2. **Targeting:** How should an agent specify *which* instance to talk to?
   - `wibwob --instance main cmd ...`? `WIBWOB_API=:8098`?
3. **Visibility:** How should the human know which instance they're seeing?
   - Instance label in tmux window title? In status bar (already shows id)?
4. **Port conflicts:** What happens when two instances try port 8099?
   - Currently: Bun picks next available, but nothing announces the actual port
5. **Lifecycle:** Who owns starting/stopping instances?
   - Should agents be forbidden from launching? Or must they register?
6. **Staleness:** How to detect and kill orphaned instances?

## Prior Art (from devlog W11)

The devlog already identified the solution direction:

> Unix sockets = primary for local CLI/agent (fast, no port conflicts,
> discovery via `ls *.sock`). HTTP ports = keep for remote access, server
> deployments. CLI should try socket first, fall back to HTTP. Same pattern
> as Docker daemon.

And:

> v4 backlog planned: multi-instance discovery & targeting (tmux-style `-t` flag)

## Candidate Solutions

### A. Socket-based discovery (devlog direction)

```
scratch/
  instances/
    main.sock          ← unix socket, auto-discovered
    main.json          ← { pid, port, instanceId, label, startedAt }
    zuk.sock
    zuk.json
```

- `wibwob --list` → shows all `*.json` in instances/
- `wibwob -t main cmd ...` → connects via `main.sock`
- CLI tries `$WIBWOB_INSTANCE` → default label → first available socket
- Dead sockets detected by failed connect → auto-cleaned

**Pros:** No port conflicts, fast, discoverable, Docker-proven pattern.
**Cons:** Needs socket support in Bun's HTTP server, doesn't help remote.

### B. Registry file (lighter weight)

```
scratch/instances.json
  [{ label: "main", pid: 1234, port: 8099, instanceId: "2c6", startedAt: ... },
   { label: "zuk",  pid: 5678, port: 8098, instanceId: "x9f", startedAt: ... }]
```

- Each instance registers on startup, deregisters on clean exit
- `wibwob --list` reads the file, health-checks each, prunes dead ones
- Simpler than sockets, works today

**Pros:** No new server infrastructure, just a JSON file.
**Cons:** Stale entries if crash (needs health-check pruning).

### C. Agent convention only (no code change)

- Document: "agents MUST NOT launch instances, only connect to existing"
- Document: "agents MUST check /health and log instanceId at session start"
- Add `wibwob which` command that prints instance info prominently

**Pros:** Zero code. **Cons:** Agents will violate conventions.

### D. Hybrid: registry file + CLI targeting + agent guardrails

Combine B + C:
1. Registry file for discovery (auto-register/deregister)
2. CLI `-t` flag for targeting (like tmux)
3. `wibwob which` / `wibwob instances` for visibility
4. Agent session preamble: "I am connected to instance {label} ({id}) on port {port}"
5. Status bar shows label prominently (already shows id, make label primary)

## Recommendation

**Option D (hybrid)** — registry file is the minimum viable change.
Unix sockets (option A) are better long-term but need Bun socket server support
and are a larger change. The registry file solves the immediate pain:

1. Instance registers in `scratch/instances/` on startup
2. `wibwob instances` lists all live instances (health-check prunes dead)
3. `wibwob -t main` targets by label
4. Agent skills document: "always run `wibwob which` at session start"

## Scope

This spike answers: **what's the minimum change to stop instance confusion?**

Not in scope:
- Unix socket transport (future, larger)
- Remote/VPS multi-instance (different auth model)
- Formal instance lifecycle management (systemd-style)

## Revised Recommendation (post-review)

Option D's registry file adds moving parts (register/deregister/prune) to solve
a problem that unix sockets solve structurally. `Bun.serve({ unix })` works today.

**Two-phase plan:**

### Phase 1: Immediate (30 min, no architecture)
- `wibwob which` command — prints label, port, instanceId, PID prominently
- Agent preamble convention in ww-ops skill: "run `wibwob which` at session start"
- Make `instanceLabel` primary in TUI status bar (currently shows id)

### Phase 2: Unix sockets (structural fix)

```
scratch/instances/
  main.sock              ← Bun.serve({ unix: path })
  zuk.sock               ← second instance

  wibwob -t main ...     ← connects via main.sock
  wibwob instances       ← ls *.sock, try connect, show live ones
```

```
  Agent                     Socket                    TUI
    │                         │                         │
    │  connect main.sock ────►│                         │
    │  ◄── guaranteed this ───│── same process ────────►│
    │      is "main"          │                         │
    │                         │                         │
    No port guessing. No registry. Dead socket = dead instance.
```

**Why sockets > registry:**
- Port conflicts impossible — each instance has its own socket path
- Discovery is `ls *.sock` — no health-check pruning needed
- Dead sockets detected by failed connect → auto-clean
- `wibwob -t main` resolves to `scratch/instances/main.sock` — no port lookup
- HTTP stays available for remote/VPS (dual-listen: socket + port)

**Why not sockets alone:**
- Remote agents (VPS, Docker) still need HTTP ports
- Both listeners in same Bun process — one `Bun.serve()` each

### Architecture (phase 2)

```
  ┌──────────────────────────────────────────────────────┐
  │  WibWob-DOS instance (label: "main", id: 2c6)       │
  │                                                      │
  │  Bun.serve({ unix: "scratch/instances/main.sock" })  │
  │  Bun.serve({ port: 8099 })                          │
  │                                                      │
  │  blessed TUI ◄──── same process ────► API handlers   │
  └──────────────────────────────────────────────────────┘
        ▲                                    ▲
        │                                    │
   human sees                          agents connect
   (Ghostty/tmux)                      (socket or HTTP)

  ┌──────────────────────────────────────────────────────┐
  │  WibWob-DOS instance (label: "zuk", id: x9f)        │
  │                                                      │
  │  Bun.serve({ unix: "scratch/instances/zuk.sock" })   │
  │  Bun.serve({ port: 8098 })                          │
  └──────────────────────────────────────────────────────┘
```

## Files Likely Touched

### Phase 1
- `src/cli/wibwob.ts` — `which` subcommand
- `.agents/skills/ww-ops/SKILL.md` — agent preamble convention

### Phase 2
- `src/app.ts` — create socket in instances dir, clean up on exit
- `src/runtime/runtime-node.ts` — dual-listen (socket + HTTP)
- `src/cli/wibwob.ts` — `instances` subcommand, `-t` flag, socket-first connect
- `scripts/lib/runtime-env.sh` — discover via socket before HTTP fallback
- `~/.wibwob` — aliases
