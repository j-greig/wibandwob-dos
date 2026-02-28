---
name: tmux-launch
description: Launch WibWob-DOS + API server in a tmux session. Kills existing processes, creates fresh socket, starts API. Use when you need to start or restart the app for testing.
---

# tmux-launch

Clean launch of wwdos TUI + API server in tmux. One command, handles everything.

## Usage

```bash
./scripts/tmux-launch.sh [session-name]
```

Default session name: `wibwob`. Socket becomes `/tmp/wibwob_<session>.sock`, API on port 8090.

Override API port with `WIBWOB_PORT=8091 ./scripts/tmux-launch.sh test2`.

## What it does

1. Kills any existing API on the port
2. Kills existing tmux session with that name
3. Removes stale socket
4. Creates tmux session 200x55
5. Launches `./build/app/wwdos` with `WIBWOB_INSTANCE=<session>`
6. Waits for socket (up to 15s)
7. Starts API server in background
8. Verifies API responds

## After launch

- Human attaches: `tmux attach -t wibwob`
- Agent uses API: `curl http://127.0.0.1:8090/state`
- Debug log: `/tmp/wibwob_debug_<session>.log`
- API log: `/tmp/api_<session>.log`

## CRITICAL

- NEVER kill the wwdos process directly with kill -9. Use this script to do clean restarts.
- The script sends tmux kill-session which lets wwdos clean up mouse tracking.
- If you just need to restart the API (stateless), kill uvicorn and relaunch — don't touch the TUI.
