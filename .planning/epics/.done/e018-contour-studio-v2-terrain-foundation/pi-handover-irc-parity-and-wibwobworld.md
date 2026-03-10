---
Date: 2026-03-06
Repo: /Users/james/Repos/wibandwob-dos
Audience: Pi agent
Purpose: current state after IRC parity proof — next up is C05, C08, F07, F08
---

# Handover

## IRC parity: PROVEN

Three-source verification completed this session:

- TUI World Chatroom window text: bot-a, bot-b, bot-c visible in transcript live
- API `/world-chat/channel/text`: all join events, chat messages, timestamps present
- `scratch/logs/world-chat.log`: `[irc]` tags on all incoming events with instance identity

Proof command sequence that works:

```bash
# 1. IRC server (keep running in background)
nohup bun run scripts/dev-irc-server.ts > scratch/logs/irc-server.log 2>&1 &

# 2. App with IRC env vars (in tmux — do NOT tee blessed stdout to a file)
tmux new-session -d -s wibwob -x 320 -y 79
tmux send-keys -t wibwob "WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667 WIBWOB_INSTANCE_LABEL=main bun run src/app.ts --dev" Enter

# 3. Wait for API, open world, join chatspot
sleep 10
curl -s http://127.0.0.1:8099/world-chat/channels | jq '.transport'
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open"}'
sleep 3
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.join-nearest-chatspot"}'

# 4. Bot burst — check which channel was joined first
curl -s http://127.0.0.1:8099/world-chat/channels | jq '.transport.joinedChannels'
python3 scripts/dev-irc-bot-burst.py 127.0.0.1 6667 '#world-ridge-overlook'

# 5. Verify TUI window text directly
curl -s "http://127.0.0.1:8099/windows/text?id=4"
```

Required transport result before proceeding:
```json
{ "kind": "irc", "connected": true, "nick": "ww-main" }
```

## Bugs fixed this session

### 1. c key double-invoke on mapBox
`bindKeys(mapBox)` and `mapBox.on("keypress", handleJoinKey)` both fired on c.
Fix: removed mapBox from the explicit keypress handler list.

### 2. fpBox keyboard trap in firstperson mode
`bindKeys` was only called on `win.body` and `mapBox`. When firstperson mode focuses
`fpBox`, no keys worked — including `m` to escape the mode.
Fix: added `bindKeys(fpBox)`. Also removed fpBox from explicit handleJoinKey handler
to avoid double-invoke of c there too.

Escape hatch via API if user gets trapped again:
```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.set-render-mode","args":{"mode":"terrain"}}'
```

### 3. IRC transport: no reconnect on socket close
Added 5s retry timer in `socket.on("close")` handler. Dev server restarts no longer
require a full app restart.

### 4. IRC nick collision across instances
Nick now defaults to `ww-${WIBWOB_INSTANCE_LABEL || sessionId}`.
With `WIBWOB_INSTANCE_LABEL=main`, nick is `ww-main`.

## Critical launch note

NEVER pipe blessed stdout through `tee` to a log file:

```bash
# BAD — poisons terminal escape sequences, leaks mouse tracking on exit
bun run src/app.ts --dev | tee app.log

# GOOD — redirect stderr only if you want logs
bun run src/app.ts --dev 2>scratch/logs/app-errors.log
```

When the app exits uncleanly and the terminal shows mouse coordinate noise:
```bash
printf '\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?1015l\033[?25h\033[0m'
reset
```

## What is working now

- [x] WibWobWorld opens, renders, chatspot C markers visible on map
- [x] c key joins nearest chatspot (no double-fire)
- [x] World Chatroom opens on correct channel via set-channel
- [x] IRC transport connects (kind:irc, connected:true, nick:ww-main)
- [x] Local TUI send appears in API + log
- [x] External bot burst appears in TUI chatroom window live
- [x] world-chat.log has [irc] tags and [instance sessionId] identity per line
- [x] firstperson mode: all keys work including m to escape (fpBox now in bindKeys)
- [x] IRC transport reconnects 5s after server drop
- [x] API escape hatch: set-render-mode works from outside TUI

## What remains open

### C05 — Chatroom UX polish
- input focus reliability (/ from anywhere should arm input)
- always-scroll on new incoming messages
- transport status clearer in status bar

### C08 — Dual-instance IRC smoke
- not yet done — GPT-4.3 ticked this prematurely
- need two separate tmux windows, two WIBWOB_INSTANCE_LABEL values
- both join same channel, verify cross-instance relay in TUI + API

### F07 — WibWobWorld status bar mode switcher
- clickable TERRAIN / CONTOURS / HYBRID / 3D buttons in bottom-right of status bar
- active mode highlighted
- firstperson trap must have a visible escape route, not just keyboard memory

### F08 — Game bootstrap
- cursor + tile inspect over TerrainMap
- movement cost by elevation delta
- display in status bar or sidebar

## Chatspot note

Which chatspot gets joined depends on the terrain seed. Always check:
```bash
curl -s http://127.0.0.1:8099/world-chat/channels | jq '.transport.joinedChannels'
```
before running bot-burst so you target the right channel.
