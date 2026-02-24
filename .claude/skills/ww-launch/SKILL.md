---
name: ww-launch
description: Launch WibWob-DOS (TUI + API server), open W&W chat window, self-prompt W&W to confirm it's alive. Wraps scripts/dev-start.sh — the canonical local dev launcher. Use when you need a live instance for debugging, IPC testing, or screenshot verification. Triggers on "launch wwdos", "start wibwob", "open wibwobdos", "ww-launch".
---

# ww-launch

Canonical local dev launcher: TUI + API + chat open + self-prompt.

## Quick start

```bash
# Start everything (instance 1, port 8089)
./scripts/dev-start.sh

# Second instance (port 8090)
WIBWOB_INSTANCE=2 WIBWOB_API_PORT=8090 ./scripts/dev-start.sh

# Then run this to open chat + self-prompt
.agents/skills/ww-launch/scripts/open-chat.sh
```

## Attach to TUI

```bash
tmux attach -t wibwob        # Ctrl-B D to detach
tmux attach -t wibwob-api    # API server log
```

## Opening windwoze (windows) — correct API endpoints

```bash
API=http://127.0.0.1:8089

# Health
curl -s $API/health

# App state — lists all open windows with id, type, focused flag
curl -s $API/state | python3 -m json.tool

# ── Open a window ──────────────────────────────────────────────────────────
# ALWAYS use POST /windows — NOT /menu/command (create_window doesn't exist there)
curl -s $API/windows -X POST -H "Content-Type: application/json" \
  -d '{"type":"wibwob"}'
# Returns {"id":"w1","focused":false,...} — window is NOT focused by default!

# ── Focus the window ────────────────────────────────────────────────────────
# CRITICAL: get_chat_history uses deskTop->current (focused window).
# Always focus after creation or history will return empty.
WIN_ID="w1"
curl -s $API/windows/$WIN_ID/focus -X POST

# ── One-liner: open + focus ─────────────────────────────────────────────────
WIN_ID=$(curl -s $API/windows -X POST -H "Content-Type: application/json" \
  -d '{"type":"wibwob"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s $API/windows/$WIN_ID/focus -X POST

# ── Other window types ──────────────────────────────────────────────────────
curl -s $API/windows -X POST -H "Content-Type: application/json" -d '{"type":"paint"}'
curl -s $API/windows -X POST -H "Content-Type: application/json" -d '{"type":"browser"}'
# Full list: curl -s $API/capabilities | python3 -m json.tool | grep '"type"'

# ── Close a window ──────────────────────────────────────────────────────────
curl -s $API/windows/$WIN_ID/close -X POST

# ── IPC commands (not window creation) ──────────────────────────────────────
# Inject a message into focused W&W chat (fire-and-forget, returns "ok queued")
curl -s $API/menu/command -X POST -H "Content-Type: application/json" \
  -d '{"command":"wibwob_ask","args":{"text":"hello from API test"}}'

# Get chat history of focused W&W window
curl -s $API/menu/command -X POST -H "Content-Type: application/json" \
  -d '{"command":"get_chat_history"}'

# Capabilities — full command list
curl -s $API/commands | python3 -m json.tool
```

## Screen capture — do this first, always

```bash
# Capture full TUI — call this before any IPC/API test to confirm state
tmux capture-pane -t wibwob -p

# Filtered — strip blank/noise lines for readable output
tmux capture-pane -t wibwob -p | grep -v "^▒\+$" | grep -v "^$"

# Send a keypress
tmux send-keys -t wibwob F12

# Full screenshot via API
curl -s http://127.0.0.1:8089/screenshot
```

**Rule**: always run `tmux capture-pane -t wibwob -p` before and after any IPC/API call so you can see what the TUI actually shows. Never assume state — read the screen.

## E014 test flow (get_chat_history + broker)

```bash
.agents/skills/ww-launch/scripts/test-e014.sh
```

## Stop

```bash
./scripts/dev-stop.sh
```
