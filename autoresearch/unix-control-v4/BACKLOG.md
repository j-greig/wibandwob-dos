# Unix Control v4 — Multi-Instance Discovery & Targeting

When 2+ WibWob-DOS instances run, the CLI has no way to discover or
target them except manually setting WW_API. This needs to be crisp.

## Design inspiration: tmux

tmux nails this problem. Study its patterns:
- `tmux list-sessions` → discover what's running
- `tmux -t mysession` → target by name  
- `tmux capture-pane -t wibwob:0` → target by session:window
- `tmux send-keys -t wibwob:alt` → target by session:label
- Sessions are named, persistent, discoverable via socket files
- Default target: most recent, or error if ambiguous

The wibwob equivalent:
- `wibwob instances` → list-sessions
- `wibwob -t main state` → target by label (like tmux -t)
- `wibwob -t 0ve state` → target by session ID (like tmux -t by name)
- `wibwob -t :8098 state` → target by port (explicit)
- Default: if 1 instance → use it. If multiple → error + list.

Also: tmux uses Unix sockets (not ports) for IPC. Each tmux server
has a socket at `/tmp/tmux-$UID/default`. WibWob could do the same:
`/tmp/wibwob-main.sock`, `/tmp/wibwob-zuk.sock`. Discovery = list
socket files. No port scanning needed. But HTTP ports stay as the
public API for remote access / agents.

## Current state

- Each instance binds a different port (main=8099, alt=8098, etc.)
- Port is set via CLI flag at launch or env var
- `GET /health` returns `{sessionId, instanceLabel, port}`
- Session ID (3 chars, e.g. `0ve`) shown in TUI top-right status bar
- Instance label (e.g. `main`, `zuk`) set at launch
- CLI uses `WW_API` env var, defaults to `http://127.0.0.1:8099`
- PID written to `scratch/wibwob.pid` (main) or `scratch/wibwob-alt.pid`

## What's unclear / broken

- No discovery: CLI can't find running instances without manual port
- No mapping docs: where is port-to-instance mapping defined?
- PID files inconsistent: main vs alt naming, no standard pattern
- What happens with 3+ instances? Port allocation?
- Session ID is ephemeral (changes on restart) — can't use for stable targeting
- Instance label is stable but not discoverable from outside

---

## Backlog Items

### 1. Instance discovery: `wibwob instances`

List all running WibWob-DOS instances by scanning known ports and/or
PID files.

```
$ wibwob instances
  LABEL    PORT   SESSION   PID    STATUS
  main     8099   0ve       12345  healthy
  zuk      8098   cdk       12346  healthy
```

Scan strategy: check ports 8095-8105, read PID files from scratch/,
hit /health on each. Return JSON for piping.

### 2. Instance targeting: `wibwob --instance <label|session|port>`

```bash
wibwob --instance zuk state        # by label
wibwob --instance 0ve state        # by session ID
wibwob --instance 8098 state       # by port
wibwob -i zuk windows              # short flag
```

Resolution order: try as label first, then session ID, then port number.

### 3. Port allocation registry

Formalise how ports are assigned. Currently ad-hoc:
- main=8099, alt=8098. What about 3rd, 4th, 5th?
- Could use a lock file: `scratch/ports.json` mapping label→port
- Or auto-allocate: scan for free port, register on startup

### 4. PID file convention

Standardise: `scratch/wibwob-<label>.pid` containing `<pid>\n<port>\n<sessionId>`.
All instances use same pattern. Discovery reads these files.

### 5. Documentation: multi-instance operations guide

Clear doc explaining:
- How to start N instances
- How ports are assigned
- How to target from CLI
- How to target from agents (MCP tools, control API)
- How workspace save/load works across instances
- How world chat / PartyKit bridges connect instances

### 6. Default instance selection

When no `--instance` flag and no `WW_API` env var:
- If exactly 1 instance running → use it
- If multiple → error with list, ask user to specify
- Or: prefer instance labelled "main"

### 7. Cross-instance commands

Once targeting works:
- `wibwob --instance zuk screenshot | wibwob --instance main cmd primer.open --filePath -`
- Pipe between instances!
- `wibwob broadcast theme.set --name phosphor` → send to ALL instances

---

## Priority

1. PID file convention (#4) — foundation
2. Instance discovery (#1) — makes everything else possible
3. Instance targeting (#2) — the payoff
4. Default selection (#6) — UX
5. Documentation (#5) — clarity
6. Port allocation (#3) — only matters at scale
7. Cross-instance (#7) — cool but late
