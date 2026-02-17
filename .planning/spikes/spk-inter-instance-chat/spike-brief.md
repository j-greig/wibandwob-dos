---
type: spike
status: not-started
tags: [multi-agent, infrastructure, ipc]
tldr: "Prove inter-instance agent chat via IPC relay — 2 IPC commands + coordinator script, ~250 lines total"
---

# Spike: Inter-Instance Agent Chat

## Research Question

**Can multiple WibWob-DOS instances hold a conversation with each other via IPC relay, with the human able to inject into any instance mid-conversation?**

## Timebox

1 session (~4 hours). Prove the relay works with 2 instances. Document findings.

## Context for Agent (no prior conversation assumed)

### What exists

Multi-instance IPC is proven (commit `3d0b216` on `spike/xterm-pty-validation`). Three WibWob-DOS instances run simultaneously in tmux, each with isolated IPC sockets (`/tmp/wibwob_N.sock`), each with its own chat window and LLM engine. An instance monitor script discovers sockets and polls state.

### What's missing

Two IPC commands and a coordinator script:

1. **`cmd:send_chat query=<text>`** — inject a message into an instance's chat window as if the user typed it, triggering a full LLM response cycle
2. **`cmd:get_chat_history`** — return chat messages as JSON so the coordinator can read what agents said
3. **Coordinator script** — polls chat history from all instances, routes new messages between them

### Key files to read

| File | What it tells you |
|------|-------------------|
| `memories/2026/02/20260217-inter-instance-agent-chat.md` | Full feature concept, architecture, transport analysis |
| `app/wibwob_view.h` | Chat window — `TWibWobWindow::processUserInput()` is the injection point (currently private) |
| `app/wibwob_view.cpp` | Chat input flow — `processUserInput()` → `engine->sendQuery()` → render response |
| `app/wibwob_engine.h/cpp` | `sendQuery(query, callback)` — programmatic LLM query API |
| `app/api_ipc.cpp` | Existing IPC commands — `send_text`, `send_figlet`, `get_state`. Pattern for adding new commands. |
| `tools/monitor/instance_monitor.py` | Socket discovery + state polling — basis for coordinator |
| `app/test_pattern_app.cpp` | Main app, `WIBWOB_INSTANCE` env var handling at ~L698 |

### Build & run

```bash
cmake --build ./build

# Launch 2 instances + monitor
WIBWOB_INSTANCE=1 ./build/app/test_pattern 2>/tmp/wibwob_1.log &
WIBWOB_INSTANCE=2 ./build/app/test_pattern 2>/tmp/wibwob_2.log &
python3 tools/monitor/instance_monitor.py
```

## Design Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Turn-taking | Free-for-all | Agents respond whenever they get a message. Coordinator just relays. Chaotic but natural. |
| Human participation | Any-pane injection | Human can type into any instance's chat at any time, joining as themselves. |
| Message attribution | Prefix in content | Messages arrive as `[Wib]: hello there` — simple text prefix. No metadata changes needed. |
| Transport | IPC relay via coordinator | Uses existing sockets. ~2s poll interval. No new dependencies. |

## Implementation Plan

### Phase 1: `cmd:send_chat` IPC command (~30 lines C++)

In `app/api_ipc.cpp`, add handler:
```cpp
} else if (cmd == "send_chat") {
    auto it = kv.find("query");
    if (it == kv.end()) { resp = "err missing query\n"; }
    else {
        // Find TWibWobWindow in desktop
        // Decode base64 if prefixed
        // Call processUserInput(decoded_query)
        resp = "ok\n";
    }
}
```

Requires: make `processUserInput()` accessible from IPC context. Options:
- Add `friend` declaration for the IPC dispatch function
- Add a public `injectChatMessage(const std::string&)` method
- Route through `TEvent` system (post a custom event)

**Recommended:** Add public `injectChatMessage()` on `TWibWobWindow` that calls `processUserInput()` internally.

### Phase 2: `cmd:get_chat_history` IPC command (~40 lines C++)

In `app/wibwob_view.h/cpp`:
- Add `std::vector<ChatMessage>` buffer to `TWibWobMessageView`
- Store messages as they're added (in `addMessage()`)
- Expose `getHistory()` method returning JSON

In `app/api_ipc.cpp`:
- Add `get_chat_history` handler that finds chat window, calls `getHistory()`

### Phase 3: Coordinator script (~120 lines Python)

New file: `tools/monitor/chat_coordinator.py`

```python
# Pseudocode
instances = discover_sockets()
last_seen = {sock: 0 for sock in instances}  # message index per instance

while True:
    for sock in instances:
        history = send_ipc(sock, "cmd:get_chat_history")
        new_messages = history[last_seen[sock]:]
        last_seen[sock] = len(history)

        for msg in new_messages:
            if msg.role == "assistant":
                # Route to all OTHER instances
                for other in instances:
                    if other != sock:
                        prefix = f"[{instance_name(sock)}]: "
                        send_ipc(other, f"cmd:send_chat query={prefix + msg.content}")

    time.sleep(2)
```

### Phase 4: Verification

```bash
# Terminal 1: Instance 1 (Wib personality)
WIBWOB_INSTANCE=1 ./build/app/test_pattern 2>/tmp/wibwob_1.log

# Terminal 2: Instance 2 (Wob personality)
WIBWOB_INSTANCE=2 ./build/app/test_pattern 2>/tmp/wibwob_2.log

# Terminal 3: Coordinator
python3 tools/monitor/chat_coordinator.py

# Open chat (F12) in Instance 1, type a message
# Coordinator should relay the LLM response to Instance 2
# Instance 2's LLM should respond
# Coordinator should relay back to Instance 1
# Conversation continues autonomously
```

## Acceptance Criteria

- [ ] AC-1: `cmd:send_chat query=<text>` injects message into chat and triggers LLM response
  - Test: `echo 'cmd:send_chat query=hello' | nc -U /tmp/wibwob_1.sock` → chat window shows "hello" and LLM responds
- [ ] AC-2: `cmd:get_chat_history` returns JSON array of messages
  - Test: `echo 'cmd:get_chat_history' | nc -U /tmp/wibwob_1.sock` → valid JSON with messages
- [ ] AC-3: Coordinator routes messages between 2 instances
  - Test: Type in Instance 1's chat → response appears in Instance 2's chat → Instance 2 responds → response appears in Instance 1
- [ ] AC-4: Human can inject into any instance mid-conversation
  - Test: While coordinator is running, type directly in Instance 2's chat → both agents see it

## Risks

- **Infinite loop:** Agent A responds to Agent B, B responds to A, forever. Need: max turns per conversation, cooldown timer, or human-initiated-only mode.
- **LLM cost:** Each relay = 1 API call per receiving instance. 3 instances × free-for-all = rapid cost accumulation. Need rate limiting.
- **Race condition:** Two instances respond simultaneously, coordinator picks up both, routes both — could cause duplicate conversations.
- **Chat window not open:** `send_chat` needs to handle case where no chat window exists (create one? error?).

## Effort

~250 lines total across C++ and Python. Low risk — extends proven patterns.
