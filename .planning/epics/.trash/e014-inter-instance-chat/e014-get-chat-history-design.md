# E014 — `get_chat_history` design

## What we want to happen

```
Agent calls:  POST /menu/command {"command":"get_chat_history"}
Returns:      {"messages": [{"role":"system","content":"..."},
                             {"role":"user","content":"hiya"},
                             {"role":"assistant","content":"Wob: ..."}]}
```

That's it. Simple read of the chat so an external agent can see what Wib&Wob said.

---

## What actually happens (confirmed by tmux)

The TUI **visibly shows** messages on screen:
```
System: Step into WibWobWorld, human.
User: say hello in 3 words
Wib: Hello, world, friend.
```

But `get_chat_history` returns `{"messages":[]}` — always empty.

---

## Why it's empty — hypothesis

`addMessage()` in `TWibWobMessageView` writes to TWO places:

1. `messages` — the display list (what the TUI renders) ✅ **works**
2. `chatHistory_` — the JSON-exportable history ❌ **always empty**

The most likely reason `chatHistory_` is always empty:

**`recordHistoryMessage()` is being called on a different object instance
than the one `api_get_chat_history()` reads from.**

Specifically: when the window is created via API (`POST /windows`), the C++
`create_window` IPC command creates the window and returns. The API controller
then calls `focus_window` as a second IPC command. Between those two IPC
`poll()` calls, the `windowNumber` counter increments and a second
`TWibWobWindow` may be inserted — leaving `api_get_chat_history` reading
the first (empty) one while messages appear in the second (visible) one.

**Simpler version of the same bug:** there are consistently TWO wibwob windows
open (w1 empty, w2 visible with messages). `api_get_chat_history` finds w1.

---

## How to prove it (one command)

```bash
curl -s http://127.0.0.1:8089/state | python3 -c "
import sys,json
s=json.load(sys.stdin)
for w in s['windows']:
    print(w['id'], w['type'], 'focused='+str(w['focused']))
"
```

If this shows TWO wibwob windows → root cause confirmed.

---

## The right fix (minimal, robust)

### Step 1 — enforce one wibwob window via IPC (not API layer)

In `api_ipc.cpp` or `command_registry.cpp`, when `create_window type=wibwob`
is received: if a `TWibWobWindow` already exists on the desktop, return its
existing ID rather than creating a new one.

This means no matter how many times the API calls `create_window`, there is
always exactly one wibwob window.

### Step 2 — `api_get_chat_history` finds the one window

Simple first-found scan (already correct). No focus tricks needed.

### Step 3 — verify `recordHistoryMessage` is actually called

Add one `fprintf(stderr, "[history] push role=%s\n", e.role.c_str())` to
`recordHistoryMessage()`. Rebuild. Open chat. Send message. Check
`/tmp/wibwob_debug.log`. If we never see the log line → `addMessage` is not
calling `recordHistoryMessage` on the object `api_get_chat_history` reads.

---

## How to test

```bash
# 1. Start fresh
./scripts/dev-stop.sh && ./scripts/dev-start.sh

# 2. Confirm exactly one wibwob window after creation
curl -s http://127.0.0.1:8089/windows -X POST \
  -H "Content-Type: application/json" -d '{"type":"wibwob"}'
curl -s http://127.0.0.1:8089/state | python3 -c "
import sys,json; s=json.load(sys.stdin)
wins=[w for w in s['windows'] if w['type']=='wibwob']
print(f'{len(wins)} wibwob windows (want: 1)')
"

# 3. Inject a message, wait, check history
curl -s http://127.0.0.1:8089/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"wibwob_ask","args":{"text":"say hi in 3 words"}}'
sleep 12

# 4. TUI must show the message
tmux capture-pane -t wibwob -p | grep -v "^▒\+$" | grep -v "^$"

# 5. History must match TUI
curl -s http://127.0.0.1:8089/menu/command -X POST \
  -H "Content-Type: application/json" \
  -d '{"command":"get_chat_history"}' | python3 -m json.tool

# Pass: messages array matches what TUI shows
# Fail: messages array empty while TUI shows content
```

---

## What NOT to do (lessons from going in circles)

- Don't fix focus logic — focus is irrelevant if there's one window
- Don't change `deskTop->current` approach — adds complexity for no gain
- Don't add multiple IPC round-trips in the API layer — race conditions
- Don't assume the build is live — always restart dev-start.sh after rebuilding
- Don't test without checking window count first
