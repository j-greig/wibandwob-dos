---
name: ww-launch
description: Launch WibWob-DOS (TUI + API server), open W&W chat window, self-prompt W&W to confirm it's alive. Open a 4-pane tmux monitor (TUI + chat log + debug log + command pane). Wraps scripts/dev-start.sh — the canonical local dev launcher. Use when you need a live instance for debugging, IPC testing, or screenshot verification. Triggers on "launch wwdos", "start wibwob", "open wibwobdos", "ww-launch", "4-pane monitor", "open monitor", "tmux monitor".
---

# ww-launch

Canonical local dev launcher: TUI + API + chat open + self-prompt.

## Quick start

```bash
# 1. Start everything (instance 1, port 8089)
./scripts/dev-start.sh

# 2. Attach to TUI once so canvas locks to your terminal size, then Ctrl-B D
tmux attach -t wibwob

# 3. Open the 4-pane monitor (TUI + logs + command pane), then attach
.agents/skills/ww-launch/scripts/monitor.sh
```

## 4-pane tmux monitor

Opens a split view inside the existing `wibwob` tmux session:

```
┌─────────────────────┬──────────────────┐
│                     │  CHAT LOG tail   │
│   TUI (live)        ├──────────────────┤
│                     │  APP DEBUG tail  │
│                     ├──────────────────┤
│                     │  COMMANDS        │
└─────────────────────┴──────────────────┘
```

```bash
.agents/skills/ww-launch/scripts/monitor.sh            # builds layout + attaches
.agents/skills/ww-launch/scripts/monitor.sh --no-attach  # build only
```

Pane navigation once attached:
- `Ctrl-B ←→` — move between panes  
- `Ctrl-B 0` — jump to TUI window if on a different window

## Attach to TUI only

```bash
tmux attach -t wibwob        # Ctrl-B D to detach
tmux attach -t wibwob-api    # API server log
```

## ⚠️ API response envelope — read this before parsing anything

`POST /menu/command` wraps the raw C++ IPC result in a Python envelope:

```json
{
  "command": "get_chat_history",
  "ok": true,
  "actor": "api",
  "result": "{\"messages\":[{\"role\":\"system\",\"content\":\"...\"}]}"
}
```

**`result` is a JSON string, not an object.** Always double-parse:

```python
import json, subprocess, sys

def menu_cmd(command, args=None, port=8089):
    """Call /menu/command and return the parsed inner result."""
    payload = {"command": command}
    if args:
        payload["args"] = args
    raw = subprocess.check_output([
        "curl", "-s", f"http://127.0.0.1:{port}/menu/command",
        "-X", "POST", "-H", "Content-Type: application/json",
        "-d", json.dumps(payload)
    ])
    outer = json.loads(raw)
    if not outer.get("ok"):
        raise RuntimeError(outer.get("error", outer))
    result = outer["result"]
    # result may be plain "ok", or a JSON string
    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return result   # plain string like "ok queued"

# Usage:
history = menu_cmd("get_chat_history")   # returns {"messages":[...]}
msgs    = history["messages"]            # ✅ correct
```

One-liner in bash:
```bash
curl -s http://127.0.0.1:8089/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"get_chat_history"}' \
  | python3 -c "
import sys,json
outer=json.load(sys.stdin)
msgs=json.loads(outer['result'])['messages']
for m in msgs: print(m['role'], '|', m['content'][:60])
"
```

**Common wrong pattern** (causes silent empty results):
```python
obj = json.loads(raw)
msgs = obj.get('messages', [])   # ❌ always [] — messages are inside result
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
