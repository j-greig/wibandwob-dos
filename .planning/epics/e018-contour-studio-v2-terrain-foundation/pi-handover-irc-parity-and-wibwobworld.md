---
Date: 2026-03-06
Repo: /Users/james/Repos/wibandwob-dos
Audience: Pi agent
Purpose: take over IRC-backed World Chat parity + remaining WibWobWorld bugs
---

# Handover

## Current goal

Make the `World Chatroom` inside WibWob-DOS reflect real IRC traffic, not just local in-memory chat state.

Target bar:
- `WibWobWorld` joins a chatspot with `c`
- `World Chatroom` opens on the correct channel
- local typing in the TUI room is sent through IRC
- IRC bot messages appear back in the same TUI room live
- `/world-chat/channel/text` matches what the TUI room shows

## Important current facts

### Repo / runtime
- Canonical repo: `/Users/james/Repos/wibwob-dos`
- Runtime: Bun
- Local API default: `http://127.0.0.1:8099`

### The big source of confusion
Do not assume `8099` is always the freshest or correct instance.

Before any API claim, check:

```bash
curl -s http://127.0.0.1:8099/health
curl -s http://127.0.0.1:8099/state | jq '.app'
curl -s http://127.0.0.1:8099/world-chat/channels | jq .transport
```

The app now exposes:
- `instanceLabel`
- `sessionId`

The toolbar top-right also shows the 3-char session id.

### Verified current behavior

These parts are working:

1. `WibWobWorld` can join the nearest chatspot with `c`
2. joining auto-opens `World Chatroom`
3. local TUI send works
4. `GET /world-chat/channel/text?id=...` reflects local room messages
5. `world-chat.log` exists and is useful outside the TUI

Concrete proof from the live app:

```text
North Ruin  #world-north-ruin
participants: wibwob-player

[16:36] North Ruin is live.
[16:36] wibwob-player joined North Ruin.
[16:37] <wibwob-player> yes
[16:37] wibwob-player said: yes
```

### What is not yet proven in the current visible instance

The visible `8099` app was still `local`, not `irc`, at the last check:

```json
{
  "kind": "local",
  "connected": true,
  "joinedChannels": []
}
```

So the last successful parity proof was local/TUI/API parity, not IRC parity.

That matters because the whole point now is:
- IRC under the hood
- TUI room and IRC reflecting each other

## Files already changed for this area

### Chat service / IRC transport
- `src/services/world-chat-service.ts`
- `src/services/world-chat-transport.ts`
- `src/services/control-api.ts`

What exists:
- local transport
- IRC transport seam
- `/world-chat/*` API
- shared log

### Chatroom frontend
- `modules-private/world-chatroom/index.ts`

What exists:
- transcript left
- game log right
- bottom input bar
- local typing with Enter
- subscription-based rerender path was added so IRC events can repaint the room

### WibWobWorld integration
- `modules-private/wibwobworld/index.ts`

What exists:
- `c` joins nearest chatspot
- auto-open/retarget room via `microapp.world-chatroom.set-channel`
- extra key binding on world widgets so `c` works even when focus is on an inner Blessed node

## Important recent bug fixes

### 1. Wrong room opened on `c`
Bug:
- pressing `c` joined a channel but focused a stale/empty `World Chatroom`

Cause:
- world code was calling `microapp.world-chatroom.open`
- `open` could focus an existing room without applying the new `channelId`

Fix:
- `WibWobWorld` now calls:

```text
microapp.world-chatroom.set-channel
```

instead of `open`

This should retarget an existing room or open one if none exists.

### 2. Chatroom was not live-updating on incoming transport events
Bug:
- room rerendered on local actions, but not reliably on incoming IRC events

Fix shape:
- `world-chat-service.ts` now has a tiny subscribe/unsubscribe seam
- emits on:
  - channel updates
  - world reset
  - transport status changes
- `world-chatroom/index.ts` subscribes and rerenders when:
  - current channel changes
  - transport changes
  - world resets

This was added specifically to make IRC messages repaint the visible room.

## WibWobWorld restore bug status

This is separate from IRC, but still important.

Known bad path:
- restoring a saved workspace directly into `WibWobWorld renderMode:"firstperson"`

Symptom:
- startup hang
- runaway RAM / fan spin
- earlier instrumentation showed hang around Blessed `setContent(...)`

Pragmatic mitigation currently in place:
- restored `WibWobWorld` falls back to `contours`
- manual post-boot switch to `firstperson` still works

This mitigation is acceptable for now. Do not burn time re-fixing this before IRC parity is done.

## Immediate blocker observed right before handover

Trying to start the local dev IRC backend from this environment failed:

```text
error: Failed to listen at 127.0.0.1
```

Command used:

```bash
bun run dev-irc-server
```

Interpretation:
- the dev IRC server was not successfully listening on `127.0.0.1:6667`
- therefore no live IRC parity test can pass until that backend is actually up

This is the first thing to fix/verify.

## Existing operator tools

Scripts already in repo:

```bash
bun run dev-irc-server
bun run dev-irc-bot-burst
./scripts/world-chat-tail.sh
./scripts/world-chat-log-tail.sh
```

Relevant files:
- `scripts/dev-irc-server.ts`
- `scripts/dev-irc-bot-burst.py`

Note:
- keep ports explicit
- avoid relying on defaults mentally

## Concrete next steps for Pi

### Step 1: get the dev IRC backend actually running

Prove one working IRC server process first.

Suggested checks:

```bash
lsof -iTCP -sTCP:LISTEN -n -P | grep 6667
bun run dev-irc-server
```

If `127.0.0.1` bind fails again:
- inspect whether another process is already using the port
- or whether this environment needs a different host/port

### Step 2: run exactly one IRC-backed WibWob-DOS instance

Launch with explicit env:

```bash
WIBWOB_CHAT_TRANSPORT=irc \
WIBWOB_CHAT_IRC_HOST=127.0.0.1 \
WIBWOB_CHAT_IRC_PORT=6667 \
WIBWOB_INSTANCE_LABEL=main \
bun run start
```

Then prove:

```bash
curl -s http://127.0.0.1:8099/world-chat/channels | jq .transport
```

Required result:

```json
{
  "kind": "irc",
  "connected": true
}
```

Do not proceed until this is true.

### Step 3: open / join a real room in the IRC-backed app

In TUI:
- open `WibWobWorld`
- press `c`
- confirm `World Chatroom` opens on the actual nearest channel

Or via API if useful:

```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.join-nearest-chatspot"}'
```

### Step 4: test local send -> IRC-backed room

Type in the room.

Then verify outside TUI:

```bash
curl -s --get --data-urlencode 'id=#world-north-ruin' \
  http://127.0.0.1:8099/world-chat/channel/text
```

### Step 5: inject raw IRC bot traffic

Use:

```bash
python3 scripts/dev-irc-bot-burst.py 127.0.0.1 6667 '#world-north-ruin'
```

Success condition:
- messages appear in the visible `World Chatroom` without manual nudges
- same messages appear via `/world-chat/channel/text`
- same messages appear in `scratch/logs/world-chat.log`

### Step 6: if one direction still fails, narrow it

If TUI local send appears locally but not from IRC:
- transport send path issue

If IRC bot messages appear in API/log but not the room:
- room subscription/rerender issue still incomplete

If transport status stays `local`:
- wrong app instance or wrong env launch

If transport status is `irc` but `connected:false`:
- backend not reachable

## Most likely remaining issue

The highest-probability remaining failure is not the chatroom widget itself.
It is:
- dev IRC backend not actually running
- or app not really launched with IRC env vars

The room/UI path has already been fixed enough that the next hard proof should come from getting a genuinely IRC-backed instance alive.

## What not to spend time on right now

- do not re-open the firstperson restore bug
- do not redesign the chatroom UI
- do not add new docs
- do not add new abstractions until IRC parity is actually proven live

The next bar is simple:
- one IRC backend
- one IRC-backed app
- one world room
- one raw bot burst
- visible TUI/API/log parity
