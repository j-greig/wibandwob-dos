---
name: tmux-launch
description: Launch WibWob-DOS + API server in a tmux session. Kills existing processes, creates fresh socket, starts API. Use when you need to start or restart the app for testing.
---

# tmux-launch

Launch WibWob-DOS (TypeScript/blessed, bun runtime) in a tmux session.

## CRITICAL — screenshots need a visible terminal

if using the studio setup with 2 displays, `screencapture -D 2` grabs display 2 pixel-for-pixel. If the tmux terminal
window is not VISIBLE and POSITIONED on display 2, every screenshot will be
identical garbage (whatever else is on that display). at home zilla only has 1 display (most of the time) but ask him if not sure.

**Before running any smoke test or VJ capture:**
1. Open a terminal window
2. `tmux attach -t wibwob-screenshot`
3. Drag that terminal window to the external monitor (display 2)
4. Make it as large as possible — fullscreen is ideal
5. Only then run the smoke test

## Start the app (fresh)

```bash
cd /Users/james/Repos/wibandwob-dos

# Kill anything on port 8099 first
lsof -ti:8099 | xargs kill -9 2>/dev/null; true

# Start in tmux
tmux new-session -d -s wibwob-screenshot -x 281 -y 81
tmux send-keys -t wibwob-screenshot "CONTROL_API_PORT=8099 bun run dev" Enter

# Wait for API
sleep 6 && curl -s http://127.0.0.1:8099/health
```

## Attach to running session

```bash
tmux attach -t wibwob-screenshot
```

Then move the terminal window to the external monitor. Fullscreen it.

## Check if running

```bash
curl -s http://127.0.0.1:8099/health   # → {"ok":true,"port":8099,"sessionId":"abc"}
tmux ls                                 # → wibwob-screenshot: 1 windows
```

## Session name / port

| Var | Value |
|-----|-------|
| tmux session | `wibwob-screenshot` |
| API port | `8099` |
| screencapture display | `2` (external monitor) |
| desktop size | 281×81 |

Override port: `CONTROL_API_PORT=8098 bun run dev`
Override display: `DISPLAY_NUM=1 ./tests/timeline-smoke/run.sh ...`

## Kill / restart

```bash
# Kill session (clean)
tmux kill-session -t wibwob-screenshot

# Kill port
lsof -ti:8099 | xargs kill -9 2>/dev/null; true
```

Never `kill -9` the bun process directly — tmux kill-session lets blessed
clean up mouse tracking and terminal state properly.
