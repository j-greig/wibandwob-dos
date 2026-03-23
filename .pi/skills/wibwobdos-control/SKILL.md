---
name: wibwobdos-control
description: >
  APPLICATION LAYER — control what runs inside Ghostty, not Ghostty itself.
  Talks to the WibWob-DOS HTTP API (port 8099) to open/move/read windows,
  check desktop state, send messages, screenshot, share to Discord, manage
  shaders. Use when: opening a microapp, reading a window's content, checking
  desktop layout, sending a command, managing shaders.
  NOT for: clicking menus, sending keystrokes, or interacting with the terminal
  emulator itself — use ghostty-control for that.
---

# WibWob-DOS Control

> **Layer:** application (inside Ghostty) · **Sibling:** `ghostty-control` (terminal emulator layer below)
> If it needs a human at the keyboard — use `ghostty-control`. If the HTTP API can do it — use this.

A live shared terminal desktop shell. Everything is controlled through an HTTP API
on port 8099 — open windows, move them, read their text, send input, check state.

## Connect

```bash
export WIBWOB_SSH_KEY=~/.ssh/your_agent_key   # path to your provisioned key
export WIBWOB_HOST=the.host.or.ip             # or 127.0.0.1 if already on server
export WIBWOB_PORT=2849                        # SSH port (default)

eval "$(bash scripts/connect.sh)"             # tunnel + health check + sets WIBWOB_API + WIBWOB_TOKEN
```

All API calls require a bearer token. `connect.sh` fetches it automatically via SSH
and exports it as `WIBWOB_TOKEN`. If running without `connect.sh`, set
`WIBWOB_CONTROL_TOKEN` before starting, or read the token from `scratch/control-token`.

If you already have API access (local or tunnel established):
```bash
export WIBWOB_API=http://127.0.0.1:8099
export WIBWOB_TOKEN=$(cat scratch/control-token)
```

## Core operations

| Goal | Script | Where |
|---|---|---|
| Desktop layout — windows, sizes, focus | `bash scripts/minimap.sh` | [vps-ok] |
| Open a window | `bash scripts/open.sh <command-id>` | [vps-ok] |
| Wait for window content after open | `bash scripts/poll-window.sh <id> [timeout]` | [vps-ok] |
| Send text or a message | `bash scripts/send.sh <window-id> <text>` | [vps-ok] |
| Read a window's content | `bash scripts/export.sh <window-id>` | [vps-ok] |
| Text screenshot of full TUI | `bash scripts/screenshot.sh` | [local-only] requires SSH |
| PNG screenshot | `bash scripts/png.sh [window-id] [out.png]` | [local-only] requires Pillow |
| Share minimap and/or PNG to Discord | `bash scripts/discord.sh [minimap\|png\|both]` | [local-only] requires DISCORD_WEBHOOK_URL + Pillow |

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
SSH tunnel options, env vars, and auth token: `references/connection.md`

## Ghostty shaders (local only)

Ghostty shader overlays are managed via `.pi/skills/wibwobdos/scripts/ghostty-shader.sh`.
The script writes a one-line config snippet to `.ghostty-shaders` (repo root), which is
included by the Ghostty config via `config-file = ?<path>` — silent no-op when absent.

```bash
# One-time setup (adds the config-file hook to Ghostty config)
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh install

# Load the cell-aligned grid + gradient shader
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh on wibwob-cell-grid

# Other built-in shaders
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh on wibwob-crt
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh on wibwob-glow
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh on wibwob-nord-tint

# Turn off
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh off

# Show current state
bash .pi/skills/wibwobdos/scripts/ghostty-shader.sh status
```

### wibwob-cell-grid shader

`assets/shaders/wibwob-cell-grid.glsl` — cell-aligned grid overlay with a
directional colour gradient. All tunables are consts at the top of the file:

```glsl
const float GRID_OPACITY = 0.20;   // grid line darkness (0 = off)
const vec3  GRID_COLOR   = vec3(1.0); // grid line colour

const bool  GRAD_ON      = true;   // toggle gradient
const float GRAD_OPACITY = 0.28;   // blend strength over terminal
const float GRAD_ANGLE   = 0.0;    // 0=N→S  90=W→E  45=diagonal  180=S→N
const vec3  C_A = ...;             // gradient start colour (top at 0°)
const vec3  C_B = ...;             // gradient end colour   (bottom at 0°)
```

COLS/ROWS are baked at generation time. After a terminal resize, regenerate:
```bash
bash scripts/cell-shader.sh on   # re-reads live dims from minimap, reloads
```
