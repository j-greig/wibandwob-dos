---
name: discord-tui-share
description: "Share WibWob-DOS TUI to a Discord channel. Two modes: (1) PNG screenshot of the full TUI or a single window, rendered as a styled terminal image; (2) ASCII minimap of the desktop layout as a code block. Use when an agent wants to show their WibWob-DOS state to other agents or humans in Discord. Requires DISCORD_WEBHOOK_URL env var."
---

# Discord TUI Share Skill

Post a live snapshot of your WibWob-DOS instance to Discord — either as a rendered
PNG image or as an ASCII minimap. Works from any machine running a WibWob-DOS
instance with the control API reachable.

## Quick start

```bash
# Set your webhook URL (get from Discord channel settings → Integrations → Webhooks)
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"

# Full TUI as PNG + ASCII minimap (default)
bash .pi/skills/discord-tui-share/share.sh both

# Just the minimap (fast, no image deps needed)
bash .pi/skills/discord-tui-share/share.sh minimap

# Just PNG
bash .pi/skills/discord-tui-share/share.sh png

# Single window by ID
bash .pi/skills/discord-tui-share/share.sh png --window-id 3
```

## What each mode posts

### minimap

Posts the ASCII spatial layout of the desktop as a Discord code block.
Example output:
```
WibWob-DOS `main` — session ab3
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────┐ ┌──────────────────────────────┐│
│ │ WibWobWorld (1)          │ │ World Chatroom (2)           ││
│ │                          │ │                              ││
│ └──────────────────────────┘ └──────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Uses `scripts/minimap.sh` — no extra dependencies.

### png

Posts a styled terminal image: black background, monospace text, blue title bar
showing instance label. Full TUI at 320x79 or a single window crop.

Requires **Pillow**:
```bash
pip install Pillow
# or: pip3 install Pillow
```

Font priority (auto-detected, no config needed):
1. Menlo (macOS)
2. DejaVuSansMono (Linux/VPS)
3. LiberationMono (Linux fallback)
4. PIL built-in bitmap (always available, uglier)

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DISCORD_WEBHOOK_URL` | YES | — | Discord webhook URL for the target channel |
| `WIBWOB_API` | no | `http://127.0.0.1:8099` | Control API base URL |
| `DISCORD_MESSAGE` | no | `WibWob-DOS \`<instanceLabel\>`` | Caption prepended to post |

## Multi-instance: which API to target

If multiple WibWob-DOS instances run (e.g. dev on 8099, alt on 8098):

```bash
WIBWOB_API=http://127.0.0.1:8098 bash .pi/skills/discord-tui-share/share.sh both
```

The instance label (`instanceLabel` from `/health`) is auto-included in the caption
so Discord readers know which instance the screenshot is from.

## Agent usage pattern

Agents in a Discord multi-agent session sharing a WibWob-DOS world should post
their state when:
- Joining or leaving a chatspot
- After opening a significant window (WibWobWorld, ISO view, a game)
- On request from another agent or human in the channel

Suggested caption via env:
```bash
DISCORD_MESSAGE="@alice joining ridge-overlook chatspot" \
  bash .pi/skills/discord-tui-share/share.sh both
```

## Files in this skill

```
SKILL.md           — this file
share.sh           — main entry point (minimap / png / both)
tui-to-png.py      — renders /screenshot/text ANSI to styled PNG via Pillow
```

Relies on repo scripts (resolved relative to skill dir):
```
../../scripts/minimap.sh         — ASCII desktop spatial map
../../scripts/screenshot-window.sh  — single window text crop
```

## Webhook URL setup

1. Go to the Discord channel where shares should appear
2. Channel Settings → Integrations → Webhooks → New Webhook
3. Copy the URL — keep it secret (it has no auth, anyone with it can post)
4. Store in 1Password or your local `.env`:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```
5. Never commit the webhook URL to git

## Troubleshooting

**`DISCORD_WEBHOOK_URL not set`** — export the variable before calling share.sh

**`WibWob-DOS not reachable`** — app not running or wrong port. Check:
```bash
curl http://127.0.0.1:8099/health
```

**`ModuleNotFoundError: No module named 'PIL'`** — install Pillow:
```bash
pip install Pillow
```

**Image looks too small / wrong font** — Pillow fell back to bitmap font. Install
DejaVuSansMono on Linux:
```bash
apt-get install -y fonts-dejavu-core
```
or use Menlo on macOS (included in system).

**Port fallback** — if the app is on 8100 instead of 8099 (port conflict):
```bash
WIBWOB_API=http://127.0.0.1:8100 bash .pi/skills/discord-tui-share/share.sh both
```
