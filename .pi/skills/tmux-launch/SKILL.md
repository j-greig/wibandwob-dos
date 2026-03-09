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

James uses a MacBook Air with an external display (iMac or studio monitor).
The TUI terminal (Ghostty) runs on the **laptop built-in screen**.
Zed and other apps typically live on the **external display**.

**Always detect which display number is built-in before screencapture:**

```bash
# List displays — Built-In Retina LCD is the laptop screen
system_profiler SPDisplaysDataType | grep -n "Display Type"
# Display 1 = first listed, Display 2 = second listed

# Quick check — built-in is always smaller resolution
# External (iMac/Studio): 5120x2880 or similar
# Laptop built-in: 2560x1600

# Capture laptop screen (built-in — usually display 2 when ext is connected):
screencapture -x -D 2 /tmp/shot.png

# Capture external display (usually display 1):
screencapture -x -D 1 /tmp/shot.png

# If unsure, capture both and check which has the TUI:
screencapture -x -D 1 /tmp/shot1.png && screencapture -x -D 2 /tmp/shot2.png
```

Rule of thumb: when an external display is connected, built-in = D2, external = D1.
When laptop only: just `screencapture -x /tmp/shot.png` (no -D needed).

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
- Its own **tmux window** (blessed requires a real PTY — no backgrounding, no pipes)
- Its own **CONTROL_API_PORT** (8099 main, 8098 alt)
- Its own **SCRATCH_DIR** so workspaces and state don't collide

**Use the script — do not try to inline this:**

```bash
bash scripts/start-alt-instance.sh
# → opens a new tmux window, launches, polls /health, prints window index
```

The script handles: stale port cleanup, `tmux new-window -P -F '#{window_index}'`
(the only reliable way to get the new window index), readiness polling.

**Why `-n "alt"` does not work:** `-n` names the window, it does not target it.
`tmux send-keys -t wibwob:alt` then fails with "can't find window: alt".
Always capture the index with `-P -F '#{window_index}'`.

```bash
# Correct pattern if doing it manually:
WIN=$(tmux new-window -t wibwob -P -F '#{window_index}')
tmux send-keys -t wibwob:$WIN 'bun run dev:world:alt' Enter
```

Verify both up:
```bash
curl -s http://127.0.0.1:8099/health   # main
curl -s http://127.0.0.1:8098/health   # alt
```

The `dev:world:alt` script sets:
  `WIBWOB_INSTANCE_LABEL=zuk  CONTROL_API_PORT=8098  SCRATCH_DIR=scratch/alt`

The alt instance writes its workspace and state to `scratch/alt/` — it will NOT
restore the main instance's workspace (scratch/alt/workspaces/default.json won't
exist on first run; the app falls back to the Scramble default).

Scratch dirs are created automatically on first launch (workspace-service and
state-service both use `mkdirSync(..., { recursive: true })`).

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

## Mouse and window naming

Enable mouse (click status bar tabs to switch windows) and rename windows to
meaningful labels based on what's running in each pane:

```bash
bash scripts/tmux-setup.sh          # default session: wibwob
bash scripts/tmux-setup.sh wibwob   # explicit session name
```

Safe to re-run. Does not kill or restart anything. Output:

```
mouse on
window 0 → wibwob-app
window 1 → wibwob-shell
Done. Use PREFIX w or click the status bar tabs to switch.
```

View current window state without running the script:

```bash
tmux list-windows -t wibwob -F "#{window_index}: #{window_name} [#{pane_current_command}]"
tmux show-option -t wibwob mouse   # → mouse on / off
```

## Convenience scripts

```bash
bun run dev               # basic launch (no IRC)
bun run dev:world         # main instance with IRC (port 8099, label=main)
bun run dev:world:alt     # alt instance with IRC (port 8098, label=zuk, scratch/alt)
bun run dev-irc-server    # start IRC server
```

## Human attach

```bash
wwdos    # alias → bash scripts/attach.sh — shows sessionId, attaches to wibwob tmux
         # Ctrl-b d to detach, Ctrl-b 0/1 to switch windows
```

## Related skills for testing

Once the app is running, these skills cover common testing workflows:

| Skill | When to use |
|-------|-------------|
| `wibwobdos` | API-based window control, screenshots, state inspection via HTTP |
| `ww-screenshot` | Targeted plain-text crop of a single window — cheaper than full state dump |
| `tui-smoke-test` | Write and run headless integration tests for the TUI |
| `discord-tui-share` | Share a TUI screenshot or minimap to Discord |
| `timeline-smoke` | End-to-end smoke test a VJ timeline with screencapture evidence |

## asciinema recording

To record a session for documentation:

```bash
# Do NOT use wwdos inside asciinema — tmux creates a PTY layer asciinema can't see.
# Run the app directly inside the asciinema shell:

kill $(lsof -ti:8099) 2>/dev/null   # stop any existing instance
asciinema rec /tmp/demo.cast --cols 180 --rows 47
# inside the recording:
cd ~/Repos/wibandwob-dos && bun run dev:world
# Ctrl-C to stop app, Ctrl-D to end recording

# Convert to mp4:
agg /tmp/demo.cast /tmp/demo.gif
ffmpeg -y -i /tmp/demo.gif -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -movflags faststart -pix_fmt yuv420p /tmp/demo.mp4
```
