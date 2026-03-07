---
name: wibwobdos
description: Operate WibWob-DOS — a shared terminal desktop with overlapping windows, generative art, a 3D world with chat rooms, and an embedded AI agent. Use to open windows, read desktop state, send messages to the agent chat, capture screenshots, and post to Discord. Triggers on: "open WibWobWorld", "show the desktop", "take a screenshot", "share to Discord", "what's on screen", "open some art", "send a chat message".
compatibility: Requires bash, curl, python3. SSH key required. Run `pip install Pillow` for PNG screenshots.
---

# WibWob-DOS

A live shared terminal desktop shell. Everything is controlled through an HTTP API
on port 8099 — open windows, move them, read their text, send input, check state.

## Connect

```bash
export WIBWOB_SSH_KEY=~/.ssh/your_agent_key   # path to your provisioned key
export WIBWOB_HOST=the.host.or.ip             # or 127.0.0.1 if already on server
export WIBWOB_PORT=2849                        # SSH port (default)

eval "$(bash scripts/connect.sh)"             # tunnel + health check + sets WIBWOB_API
```

If you already have API access (local or tunnel established): `export WIBWOB_API=http://127.0.0.1:8099`

## Core operations

| Goal | Script |
|---|---|
| Desktop layout — windows, sizes, focus | `bash scripts/state.sh` |
| Open a window | `bash scripts/open.sh <command-id>` |
| Send text or a message | `bash scripts/send.sh <window-id> <text>` |
| Read a window's content | `bash scripts/export.sh <window-id>` |
| Text screenshot of full TUI | `bash scripts/screenshot.sh` |
| PNG screenshot | `bash scripts/png.sh [window-id] [out.png]` |
| Share minimap and/or PNG to Discord | `bash scripts/discord.sh [minimap\|png\|both]` |

## Discover what's available

```bash
bash scripts/state.sh           # current windows — get real ids from here
bash scripts/open.sh --list     # every openable command with description
```

## Common windows to open

```
microapp.wibwobworld.open    3D terrain world with chatspots
plasma.open                  generative plasma (moods: void circuit chaos aurora)
contour.open                 contour terrain lab
pattern.open                 animated ASCII patterns
backrooms.run                AI backrooms session
```

Full API, endpoint shapes, and all command ids: `references/api.md`
SSH tunnel options and env vars: `references/connection.md`
