---
name: tmux-launch
description: Launch WibWob-DOS + API server in a tmux session. Kills existing processes, creates fresh socket, starts API. Use when you need to start or restart the app for testing.
---

# tmux-launch

Launch, restart, and manage WibWob-DOS instances inside tmux.

## Session name

The working session is **`wibwob`** (one window per instance).

The old name `wibwob-screenshot` appears in some legacy scripts — ignore it.
`wibwob` is the canonical name for all agent and human use.

## CRITICAL — screenshots need a visible terminal

If using the studio setup with 2 displays, `screencapture -D 2` grabs display 2.
The tmux terminal window must be **visible and fullscreened on display 2**.

At home (single display): `screencapture -D 1` or just `screencapture`.

## Start fresh (no existing session)

```bash
cd /Users/james/Repos/wibandwob-dos

# Kill anything already on 8099
lsof -ti:8099 | xargs kill -9 2>/dev/null; true

# Create session and launch
tmux new-session -d -s wibwob -x 205 -y 55
tmux send-keys -t wibwob 'bun run dev:world' Enter

# Wait for API
sleep 10 && curl -s http://127.0.0.1:8099/health
```

The session window is 205×55 — matches the desktop size the app uses.

## Attach / detach

```bash
tmux attach -t wibwob          # attach
# Ctrl-b d                     # detach (leave app running)
```

## Restart the app (session already exists)

Blessed needs SIGTERM (not SIGKILL) to clean up mouse tracking. Use this pattern:

```bash
# 1. Find the bun PID
APP_PID=$(ps aux | grep "bun run src/app.ts" | grep -v grep | awk '{print $2}')

# 2. SIGTERM it (blessed cleanup runs)
kill $APP_PID 2>/dev/null

# 3. Wait for exit
sleep 3

# 4. Relaunch in the same tmux window
tmux send-keys -t wibwob 'bun run dev:world' Enter

# 5. Wait for API
sleep 10 && curl -s http://127.0.0.1:8099/health
```

If SIGTERM doesn't work (process hangs): `kill -9 $APP_PID` as fallback.
The terminal will be left dirty — run `reset` in the tmux pane to fix.

**Do NOT use `tmux kill-session`** to restart — that destroys the session
entirely and requires recreating it. Keep the session, just kill the process.

## Check running state

```bash
curl -s http://127.0.0.1:8099/health
# → {"ok":true,"port":8099,"instanceLabel":"main","sessionId":"abc"}

ps aux | grep "bun run src/app.ts" | grep -v grep
tmux ls
```

## Dual-instance setup (S04 smoke / IRC relay tests)

Two instances share one IRC server. Each needs:
- Its own **tmux window** (blessed requires a real PTY)
- Its own **CONTROL_API_PORT** (8099 main, 8098 alt)
- Its own **SCRATCH_DIR** so workspaces and state don't collide

```bash
# Window 0 — main (already running on wibwob:0 via dev:world above)

# Window 1 — alt instance
tmux new-window -t wibwob -n "alt"
tmux send-keys -t wibwob:alt 'bun run dev:world:alt' Enter
sleep 10

# Verify both are up
curl -s http://127.0.0.1:8099/health   # main
curl -s http://127.0.0.1:8098/health   # alt
```

The `dev:world:alt` script sets:
  `WIBWOB_INSTANCE_LABEL=zuk  CONTROL_API_PORT=8098  SCRATCH_DIR=scratch/alt`

The alt instance writes its workspace and state to `scratch/alt/` — it will NOT
restore the main instance's workspace (scratch/alt/workspaces/default.json won't
exist on first run; the app falls back to the Scramble default).

## IRC server

Start before launching any IRC-enabled instance:

```bash
nohup bun run scripts/dev-irc-server.ts > scratch/logs/irc-server.log 2>&1 &
tail -f scratch/logs/irc-server.log   # should see "dev-irc listening on 127.0.0.1:6667"
```

Kill and restart IRC server:

```bash
pkill -f dev-irc-server.ts
nohup bun run scripts/dev-irc-server.ts > scratch/logs/irc-server.log 2>&1 &
```

The irc-framework client reconnects automatically (auto_reconnect_max_retries=9999,
5s wait). After ~10s the app should show `connected: true` again.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `CONTROL_API_PORT` | `8099` | HTTP control API port |
| `SCRATCH_DIR` | `scratch` | Base dir for workspaces, state, logs (relative to repo root) |
| `WIBWOB_INSTANCE_LABEL` | unset | IRC nick prefix and API `instanceLabel` |
| `WIBWOB_CHAT_TRANSPORT` | `local` | `local` or `irc` |
| `WIBWOB_CHAT_IRC_HOST` | — | IRC server host (required if transport=irc) |
| `WIBWOB_CHAT_IRC_PORT` | — | IRC server port (required if transport=irc) |

## Convenience scripts

```bash
bun run dev               # basic launch (no IRC)
bun run dev:world         # main instance with IRC (port 8099, label=main)
bun run dev:world:alt     # alt instance with IRC (port 8098, label=zuk, scratch/alt)
bun run dev-irc-server    # start IRC server
```
