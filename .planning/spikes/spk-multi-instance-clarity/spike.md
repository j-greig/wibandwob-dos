---
title: "Multi-instance clarity — stop agents and humans losing track of which WibWob is which"
status: not-started
branch: spike/multi-instance-clarity
---

# Spike: Multi-instance Clarity

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

## Files Likely Touched

- `src/app.ts` — register in instances dir on startup, deregister on exit
- `src/cli/wibwob.ts` — `instances` subcommand, `-t` flag
- `scripts/lib/runtime-env.sh` — discover from registry instead of hardcoded port
- `~/.wibwob` — aliases for `wibwob instances`, `wibwob which`
- `.agents/skills/ww-ops/SKILL.md` — agent preamble convention
