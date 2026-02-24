# WibWob-DOS Chat Message Flow

> How a message gets in, how a reply gets out, where logs live.

## Forward path (message in)

```mermaid
sequenceDiagram
    participant A as Agent / API caller
    participant PY as FastAPI :8089<br/>(tools/api_server/)
    participant IPC as Unix socket<br/>/tmp/wibwob_1.sock
    participant REG as command_registry.cpp
    participant APP as test_pattern_app.cpp<br/>api_wibwob_ask()
    participant TV as Turbo Vision<br/>main UI thread
    participant WIN as TWibWobWindow<br/>handleEvent()
    participant MV as TWibWobMessageView<br/>chatHistory_

    A->>PY: POST /menu/command<br/>{command: wibwob_ask, text: "hi"}
    PY->>IPC: send_cmd("exec_command",<br/>name=wibwob_ask text=hi)
    Note over IPC: polled by TTestPatternApp::idle()<br/>— always main UI thread
    IPC->>REG: exec_registry_command()
    REG->>APP: api_wibwob_ask(app, "hi")
    APP->>APP: findTargetWibWobWindow()<br/>(prefers deskTop->current)
    APP->>WIN: message(chatWin, evBroadcast, 0xF0F0, &text)
    WIN->>WIN: pendingAsk_ = text<br/>ensureEngineInitialized()
    Note over WIN: on next cmTimerExpired tick<br/>(every 50ms)
    WIN->>WIN: processUserInput("hi")
    WIN->>MV: addMessage("User", "hi")
    MV->>MV: recordHistoryMessage()<br/>chatHistory_.push_back()
    WIN->>MV: startStreamingMessage("")<br/>chatHistory_.push_back(placeholder)
```

## Backward path (LLM reply out)

```mermaid
sequenceDiagram
    participant WIN as TWibWobWindow
    participant SDK as ClaudeCodeSDKProvider
    participant BG as Background reader thread<br/>(processStreamingThread)
    participant Q as streamQueue<br/>(mutex protected)
    participant POLL as SDK poll()<br/>main UI thread
    participant MV as TWibWobMessageView<br/>chatHistory_
    participant LOG as logs/chat_*.log<br/>~/.claude/debug/latest

    WIN->>SDK: sendStreamingQuery(input, streamCallback)
    SDK->>BG: std::thread processStreamingThread()
    BG->>BG: reads Node.js bridge stdout<br/>(claude CLI / SDK)
    BG->>Q: enqueue StreamChunks<br/>(under queueMutex)
    Note over BG: NEVER calls streamCallback directly
    loop every engine->poll() on timer tick
        POLL->>Q: dequeue chunks (under queueMutex)
        POLL->>WIN: streamCallback(chunk) — main thread
    end
    WIN->>MV: appendToStreamingMessage(chunk.content)<br/>chatHistory_.back().content += chunk
    WIN->>MV: finishStreamingMessage()<br/>chatHistory_.back().content = final
    WIN->>LOG: logMessage() → logs/chat_*.log
    Note over LOG: ~/.claude/debug/latest<br/>has raw SDK events + errors
```

## Reading history back out

```mermaid
sequenceDiagram
    participant A as Agent
    participant PY as FastAPI :8089
    participant IPC as Unix socket
    participant APP as api_get_chat_history()
    participant MV as TWibWobMessageView<br/>chatHistory_

    A->>PY: POST /menu/command<br/>{command: get_chat_history}
    PY->>IPC: send_cmd("exec_command",<br/>name=get_chat_history)
    Note over IPC: main UI thread via idle()
    IPC->>APP: api_get_chat_history(app)
    APP->>APP: findTargetWibWobWindow()<br/>(same selector as wibwob_ask)
    APP->>MV: getHistoryJson()
    MV-->>APP: [{role,content}, ...]
    APP-->>IPC: {"messages":[...]}
    IPC-->>PY: JSON string
    PY-->>A: {"messages":[...]}
```

## Thread map

| Code location | Thread | chatHistory_ access |
|---|---|---|
| FastAPI handler | Uvicorn worker | none |
| `send_cmd()` in controller.py | Uvicorn worker | none |
| `ApiIpcServer::poll()` | **Main UI thread** | none |
| `api_wibwob_ask()` | **Main UI thread** | none |
| `TWibWobWindow::handleEvent()` | **Main UI thread** | none |
| `processUserInput()` | **Main UI thread** | indirect |
| `addMessage()` → `recordHistoryMessage()` | **Main UI thread** | **write** |
| `startStreamingMessage()` | **Main UI thread** | **write** (placeholder) |
| `processStreamingThread()` (SDK) | Background thread | **none** (queue only) |
| `ClaudeCodeSDKProvider::poll()` → streamCallback | **Main UI thread** | indirect |
| `appendToStreamingMessage()` | **Main UI thread** | **write** |
| `finishStreamingMessage()` | **Main UI thread** | **write** |
| `api_get_chat_history()` → `getHistoryJson()` | **Main UI thread** | **read** |

**No mutex on `chatHistory_`** — safe only because all access is on the main UI thread.

## Log files

| Log | What's in it | Path |
|---|---|---|
| Chat session log | Every message, stream chunk, timing | `logs/chat_YYYYMMDD_HHMMSS_ID.log` |
| Claude SDK debug | Raw SDK events, 403s, session writes | `~/.claude/debug/latest` |
| App stderr | IPC calls, wibwob_ask, history reads | `/tmp/wibwob_debug.log` |
| API server log | HTTP requests, IPC round-trips | `/tmp/wibwob_api.log` |
| tmux TUI pane | Visual screen state | `tmux capture-pane -t wibwob -p` |
