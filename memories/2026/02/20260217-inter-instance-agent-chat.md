---
type: idea
status: draft
tags: [infrastructure, worldbuilding, creative-direction, multi-agent]
tldr: "Inter-instance agent chat — 3 WibWob agents with different personalities talking to each other via IPC relay, human watches in tmux panes"
---

# Inter-Instance Agent Chat

**Captured:** 2026-02-17 14:30
**Source:** Session with Zilla, following multi-instance IPC verification (3 instances in tmux)

---

つ◕‿◕‿⚆༽つ Three instances running in tmux. Three desktops. Three chat windows. Three separate LLMs with their own system prompts. What if they could... talk to each other? Not through the human. To each other. The human watches all three panes as the agents have a conversation across sockets.

つ⚆‿◕‿◕༽つ The infrastructure is almost there. The gap is surprisingly small.

## What Exists

| Layer | What's there | Socket |
|-------|-------------|--------|
| Instance 1 | WibWob-DOS + chat + LLM (`anthropic_api`) | `/tmp/wibwob_1.sock` |
| Instance 2 | WibWob-DOS + chat + LLM | `/tmp/wibwob_2.sock` |
| Instance 3 | WibWob-DOS + chat + LLM | `/tmp/wibwob_3.sock` |
| Monitor | Discovers sockets, polls `get_state`, renders dashboard | reads all sockets |

Each instance's chat works: user types → `processUserInput()` → `engine->sendQuery()` → LLM responds → rendered in chat view.

## What's Missing (Two IPC Commands + One Script)

### 1. `cmd:send_chat query=<text>` (C++ change)

Inject a message into the chat window as if the user typed it. Triggers full LLM response cycle.

```
echo 'cmd:send_chat query=base64:SGVsbG8gZnJvbSBpbnN0YW5jZSAx' | nc -U /tmp/wibwob_2.sock
```

Implementation: find TWibWobWindow in desktop, call `processUserInput(decoded_query)`. Need to make it accessible — either make the method public, add a friend function for IPC, or add a new public method.

### 2. `cmd:get_chat_history` (C++ change)

Return chat messages as JSON so the coordinator can read what agents said.

```json
{"messages":[
  {"role":"user","content":"Hello from instance 1","timestamp":1234567890},
  {"role":"assistant","content":"Hello back! I'm instance 2.","timestamp":1234567891}
]}
```

Implementation: TWibWobMessageView needs to expose its message buffer. Currently renders to screen only — no structured history accessible via IPC.

### 3. Coordinator script (Python, extends monitor)

Upgrade `instance_monitor.py` from passive observer to active message router.

```
[Instance 1 chat] ←→ [Coordinator] ←→ [Instance 2 chat]
                          ↕
                     [Instance 3 chat]
```

Loop:
1. Poll `get_chat_history` from each instance
2. Detect new messages since last poll
3. Route new assistant messages to other instances as `send_chat` commands
4. Each receiving instance's LLM responds naturally
5. Coordinator picks up those responses on next poll
6. Repeat

## Transport Analysis

| Transport | Effort | Latency | Dependencies |
|-----------|--------|---------|-------------|
| **IPC relay via coordinator** | Low — 2 IPC commands + Python script | 2-4s (poll interval) | None new |
| **WebSocket event stream** | Medium — needs WS in C++ | Sub-second | WS library in C++ |
| **Shared file mailbox** | Minimal — write/read files | 2-5s | None |
| **Redis pub/sub** | Medium — new dependency | Sub-second | Redis |

**Recommendation: IPC relay.** Uses what we have. Poll interval matches the monitor's 2s refresh. Good enough for conversational pace.

## The Product Vision

Set up 3 instances with different personalities via system prompts:

- **Instance 1:** Wib — chaos, art, glitch, emotional resonance
- **Instance 2:** Wob — order, method, logic, structure
- **Instance 3:** Scramble — trickster, wild card, fourth wall breaks

The coordinator routes messages between them. The human watches all 3 in tmux panes. Each agent has its own desktop with windows reflecting its personality. The conversation emerges organically across the sockets.

It's not a chatbot. It's not a group chat. It's three separate minds in three separate rooms, passing notes through the walls.

## Architecture Detail

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Instance 1 (Wib)  │  │   Instance 2 (Wob)  │  │ Instance 3 (Scramble)│
│  /tmp/wibwob_1.sock │  │  /tmp/wibwob_2.sock │  │  /tmp/wibwob_3.sock │
│  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │
│  │  Chat Window  │  │  │  │  Chat Window  │  │  │  │  Chat Window  │  │
│  │  LLM Engine   │  │  │  │  LLM Engine   │  │  │  │  LLM Engine   │  │
│  │  System Prompt │  │  │  │  System Prompt │  │  │  │  System Prompt │  │
│  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │
│  + art windows      │  │  + data windows     │  │  + chaos windows    │
└────────┬────────────┘  └────────┬────────────┘  └────────┬────────────┘
         │                        │                         │
         │    ┌───────────────────┴───────────────┐        │
         └────┤       Coordinator (Python)         ├────────┘
              │  polls get_chat_history from each   │
              │  routes new messages between all    │
              │  manages turn-taking / rate limits  │
              └────────────────────────────────────┘
```

## Open Questions

1. **Turn-taking:** Free-for-all or structured rounds? (coordinator policy)
2. **Message attribution:** How does Instance 2 know a message came from Instance 1? (prefix? metadata?)
3. **Human injection:** Can the human type into any instance mid-conversation?
4. **Rate limiting:** LLM calls per instance per minute? (cost control)
5. **Conversation seeding:** Who starts? What's the opening prompt?
6. **Memory across sessions:** Do agents remember previous conversations?
7. **Observation mode:** Can a 4th pane show the full cross-instance transcript?

## Effort Estimate

| Component | Lines | Risk |
|-----------|-------|------|
| `cmd:send_chat` IPC command | ~30 C++ | Low — similar to existing IPC commands |
| `cmd:get_chat_history` IPC command | ~40 C++ | Low-medium — need to expose message buffer |
| Chat message buffer in TWibWobMessageView | ~20 C++ | Low — store what's already rendered |
| Coordinator script | ~120 Python | Low — extends monitor pattern |
| REST/MCP endpoints | ~40 Python | Low — follows existing patterns |
| **Total** | ~250 lines | Low overall |

## Prior Art

- Multi-instance IPC: commit `3d0b216` (this session)
- Instance monitor: `tools/monitor/instance_monitor.py`
- Chat view: `app/wibwob_view.h/cpp`
- WibWobEngine: `app/wibwob_engine.h/cpp`
- Actor attribution: E001 F03 (already landed)

---

**Why this matters:** This is multi-agent conversation running on bare metal — no cloud orchestration, no LangChain, no framework. Three C++ TUI apps passing notes through Unix sockets with a Python script as postman. The human watches through tmux panes. It's the most WibWob thing possible.
