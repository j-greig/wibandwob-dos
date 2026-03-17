---
name: ww-room-chat
description: Launch and test the WibWob-DOS multi-instance PartyKit room chat. Spins up two TUI instances (wibwob1 + wibwob2), two API servers (8089 + 8090), two PartyKit bridges sharing one fresh room, and opens a RoomChatView on both. Use when you want to test room chat, check presence strip, verify bidirectional relay, inject test messages, or do a full E008 smoke test. Triggers on "room chat", "ww-room-chat", "test room chat", "start partykit", "wibwob1 wibwob2", "multi chat", "two instances".
---

# ww-room-chat

Launch two WibWob-DOS instances sharing a PartyKit room and smoke-test bidirectional chat.

## Start / Stop

```bash
.claude/skills/ww-room-chat/scripts/start.sh              # fresh room (rchat-HHMMSS)
.claude/skills/ww-room-chat/scripts/start.sh rchat-myroom # named room
.claude/skills/ww-room-chat/scripts/stop.sh               # kill everything
```

## Attach

```bash
tmux attach -t wibwob1   # TUI 1 — your adjective-animal, labelled (me)
tmux attach -t wibwob2   # TUI 2 — the other participant
# Ctrl-B D to detach without killing
```

## Expected initial state

Both TUIs should show:
- Sidebar: two `• adjective-animal` entries, one `(me)`
- Footer: `2 in room`
- `[HH:MM] system — Room chat connected. Say hello!`

## Agent actions once running

### Capture both screens
```bash
for s in wibwob1 wibwob2; do
  echo "=== $s ==="
  tmux capture-pane -t $s -p | sed 's/\x1b\[[0-9;]*m//g' \
    | grep -E "║.*•|║.*\]|║.*in room|╟"
done
```

### Inject a message (direct IPC — no PartyKit round-trip)
```bash
# Into TUI 1
curl -s http://127.0.0.1:8089/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"room_chat_receive","args":{"sender":"test-bot","text":"hello","ts":"12:00"}}'

# Into TUI 2
curl -s http://127.0.0.1:8090/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"room_chat_receive","args":{"sender":"test-bot","text":"hello","ts":"12:00"}}'
```

### Push a presence update
```bash
curl -s http://127.0.0.1:8089/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"room_presence","args":{"participants":["dark-jay","grim-gnu","swift-fox"],"count":3}}'
```

### Watch bridge logs
```bash
tail -f /tmp/b1.log   # bridge → instance 1
tail -f /tmp/b2.log   # bridge → instance 2
```

### Full smoke test (agent-driven sequence)
1. Capture both TUIs — confirm `2 in room` + two names
2. Inject msg into TUI 1, wait 1s, confirm it appears
3. Wait ~500ms bridge poll, capture TUI 2 — confirm relay arrived
4. Repeat from TUI 2 → TUI 1
5. Report pass/fail

## Key details

| Thing | Value |
|-------|-------|
| TUI sessions | `wibwob1`, `wibwob2` |
| APIs | `http://127.0.0.1:8089` (1), `http://127.0.0.1:8090` (2) |
| Bridge logs | `/tmp/b1.log`, `/tmp/b2.log` |
| PartyKit server | `wibwob-rooms.j-greig.partykit.dev` |
| Room naming | `rchat-HHMMSS` — always fresh to avoid stale DO state |
| IPC commands | `room_chat_receive`, `room_presence`, `room_chat_pending` |
| Self colour | `TColorRGB(120,220,140)` — soft green, reserved for `(me)` entries |
