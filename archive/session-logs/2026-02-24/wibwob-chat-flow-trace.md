# W&W Chat Message Flow Trace (Forward + Backward)

Date: 2026-02-24
Repo: `wibandwob-dos`

## Executive Summary

`chatHistory_` is populated in the Wib&Wob message view on the Turbo Vision (main/UI) thread, including streaming replies.

The observed `get_chat_history -> []` bug is most likely a window-targeting mismatch, not a `chatHistory_` write failure:

- `api_wibwob_ask()` previously found a WibWob window but then posted a global event (`putEvent(ev)`), not a targeted event.
- `api_get_chat_history()` independently read from the first `TWibWobWindow` it found.
- If those resolve to different WibWob windows, history can come back empty even though a visible W&W window exchanged messages.

I applied a minimal fix in `app/test_pattern_app.cpp` so both paths use the same target-selection helper (prefer focused/current WibWob window), and `wibwob_ask` now sends the event directly to that window.

## 1) Forward Path (user message in)

### HTTP/API -> IPC -> C++ dispatch

1. `POST /menu/command` enters FastAPI handler `menu_command()` in `tools/api_server/main.py:332` and calls `Controller.exec_command(...)` at `tools/api_server/main.py:334`.
2. `Controller.exec_command()` builds payload and calls `send_cmd("exec_command", payload)` in `tools/api_server/controller.py:555` and `tools/api_server/controller.py:562`.
3. C++ IPC server accepts and handles commands in `ApiIpcServer::poll()` at `app/api_ipc.cpp:347`.
4. `ApiIpcServer::poll()` dispatches `exec_command` via `exec_registry_command(*app_, ...)` (see `app/api_ipc.cpp:402`-`app/api_ipc.cpp:409`).
5. Command registry routes `wibwob_ask` to `api_wibwob_ask(...)` (`app/command_registry.cpp:341`-`app/command_registry.cpp:345`).

### C++ command -> WibWob window event -> queued ask

6. `api_wibwob_ask()` is implemented in `app/test_pattern_app.cpp:3059`.
7. It now resolves a target window with `findTargetWibWobWindow(...)` (`app/test_pattern_app.cpp:3038`) and sends a directed event:
   - `message(chatWin, evBroadcast, 0xF0F0, &pendingAsk)` at `app/test_pattern_app.cpp:3089`.
   - Previously this was a global `TProgram::application->putEvent(ev)` (root cause of cross-window drift).
8. `TWibWobWindow::handleEvent()` receives the `0xF0F0` event at `app/wibwob_view.cpp:569` / `app/wibwob_view.cpp:599`.
9. It sets `pendingAsk_ = *text` and calls `ensureEngineInitialized()` (`app/wibwob_view.cpp:602`-`app/wibwob_view.cpp:605`).

### Timer drain -> processUserInput -> history writes

10. On timer ticks, `TWibWobWindow::handleEvent()` handles `cmTimerExpired` at `app/wibwob_view.cpp:585`.
11. It calls `engine->poll()`, then drains `pendingAsk_` when idle and invokes `processUserInput(msg)` (`app/wibwob_view.cpp:587`-`app/wibwob_view.cpp:593`).
12. `TWibWobWindow::processUserInput()` starts at `app/wibwob_view.cpp:683`.
13. User message is added via `messageView->addMessage("User", input)` at `app/wibwob_view.cpp:744`.
14. `TWibWobMessageView::addMessage()` calls `recordHistoryMessage(...)` at `app/wibwob_view.cpp:109`.
15. `recordHistoryMessage()` pushes into `chatHistory_` at `app/wibwob_view.cpp:250`-`app/wibwob_view.cpp:256`.

Answer to question:
- `messageView->addMessage('User', text)` **does call** `recordHistoryMessage()` (`app/wibwob_view.cpp:109`).

### Streaming start -> placeholder history entry

16. `processUserInput()` starts streaming UI with `messageView->startStreamingMessage("")` at `app/wibwob_view.cpp:843`.
17. `TWibWobMessageView::startStreamingMessage()` pushes a placeholder assistant history entry directly with `chatHistory_.push_back(he)` at `app/wibwob_view.cpp:184`.

Answer to question:
- `startStreamingMessage()` **does write to `chatHistory_`** (placeholder assistant entry), but **does not** call `recordHistoryMessage()`.

## 2) Backward Path (LLM response out)

### sendStreamingQuery -> background reader thread -> main-thread callback delivery

1. `processUserInput()` calls `sdkProvider->sendStreamingQuery(input, streamCallback, ...)` at `app/wibwob_view.cpp:845`.
2. `ClaudeCodeSDKProvider::sendStreamingQuery(...)` is at `app/llm/providers/claude_code_sdk_provider.cpp:351`.
3. It starts `processingThread` (`std::thread`) running `processStreamingThread()` at `app/llm/providers/claude_code_sdk_provider.cpp:403`.
4. `processStreamingThread()` (`app/llm/providers/claude_code_sdk_provider.cpp:408`) reads Node bridge output and enqueues `StreamChunk`s under `queueMutex` (`app/llm/providers/claude_code_sdk_provider.cpp:439`).
5. Critical comment confirms threading contract: it must **not** call `activeStreamCallback` from that thread (`app/llm/providers/claude_code_sdk_provider.cpp:436`).
6. `ClaudeCodeSDKProvider::poll()` at `app/llm/providers/claude_code_sdk_provider.cpp:487` dequeues chunks and delivers them on the main thread (`app/llm/providers/claude_code_sdk_provider.cpp:549`-`app/llm/providers/claude_code_sdk_provider.cpp:560`).

Answer to question:
- `streamCallback` fires on the **Turbo Vision main/UI thread** (via provider `poll()`), not the provider background thread.

### streamCallback -> message view streaming methods -> chatHistory_

7. `streamCallback` in `TWibWobWindow::processUserInput()` handles chunks (`app/wibwob_view.cpp:782` onward, chunk handlers visible at `app/wibwob_view.cpp:809`-`app/wibwob_view.cpp:817`).
8. For deltas, it calls `messageView->appendToStreamingMessage(chunk.content)` at `app/wibwob_view.cpp:810`.
9. `appendToStreamingMessage()` appends to `chatHistory_.back().content` at `app/wibwob_view.cpp:199`.
10. On completion, it calls `messageView->finishStreamingMessage()` at `app/wibwob_view.cpp:817`.
11. `finishStreamingMessage()` finalizes `chatHistory_.back().content` at `app/wibwob_view.cpp:216`-`app/wibwob_view.cpp:217`.

Answer to question:
- `appendToStreamingMessage()` / `finishStreamingMessage()` **do write `chatHistory_`**.
- In the streaming path, those writes occur on the **Turbo Vision main/UI thread** (because callback delivery is marshalled via `ClaudeCodeSDKProvider::poll()`).

### get_chat_history -> read side

12. `get_chat_history` registry dispatch calls `api_get_chat_history(...)` from `app/command_registry.cpp:338`-`app/command_registry.cpp:339`.
13. `api_get_chat_history()` reads `msgView->getHistoryJson()` in `app/test_pattern_app.cpp:3093`-`app/test_pattern_app.cpp:3102`.
14. `TWibWobMessageView::getHistoryJson()` iterates `chatHistory_` at `app/wibwob_view.cpp:259`-`app/wibwob_view.cpp:266`.

Answer to question:
- `get_chat_history` reads `chatHistory_` on the **Turbo Vision main/UI thread** (through `ApiIpcServer::poll()` in `TTestPatternApp::idle()`).
- `chatHistory_` has **no mutex** protecting it.
- In the SDK streaming path, that is currently okay because reads/writes are all on the main thread.

## 3) The Exact Bug (`get_chat_history` returns `[]`)

### Runtime log check (`/tmp/wibwob_debug.log`)

Observed runtime log state during this trace:
- `/tmp/wibwob_debug.log` exists but has only 5 lines (startup/auth/IPC init) and **no** `[history] push obj=` entries.
- Therefore I could **not** compare runtime `recordHistoryMessage` pointer vs `api_get_chat_history` pointer from that log.

Interpretation:
- If the app binary had your new `recordHistoryMessage` instrumentation and the displayed exchange happened in that same process, there should be `[history] push obj=...` lines for at least system/user messages.
- Their absence means one of:
  - the running TUI binary does not include the new instrumentation yet (not rebuilt/restarted), or
  - the observed chat exchange came from a different running instance/process than the one writing `/tmp/wibwob_debug.log`.

### Root cause in code (reproducible by inspection)

The code had a **window selection mismatch** between write and read paths:

- `api_wibwob_ask()` found a WibWob window but previously posted a **global** `putEvent(ev)` (not tied to that pointer).
- `api_get_chat_history()` independently returned the history from the **first** `TWibWobWindow` it found.

If multiple WibWob windows exist, those can diverge, producing `[]` (or stale/wrong history) from `get_chat_history` even when another WibWob window visibly has the conversation.

Exact bug locations (pre-fix behaviour, now patched in same functions):
- `app/test_pattern_app.cpp` in `api_wibwob_ask(...)` (event posting path; now line `3089` sends targeted window event).
- `app/test_pattern_app.cpp` in `api_get_chat_history(...)` (window selection path; now line `3096` uses shared target helper).
- `app/wibwob_view.cpp:599` handles the injected `0xF0F0` event in each WibWob window that receives it.

### Minimal fix (applied)

Implemented in `app/test_pattern_app.cpp`:

- Added `findTargetWibWobWindow(...)` (`app/test_pattern_app.cpp:3038`) to prefer `deskTop->current` when it is a `TWibWobWindow`, else fallback to first found.
- Updated `api_wibwob_ask(...)` to use that same selection and send the event directly to the chosen window (`app/test_pattern_app.cpp:3089`).
- Updated `api_get_chat_history(...)` to use the same selector (`app/test_pattern_app.cpp:3096`).
- Added read-side pointer debug logging (`[history] read obj=...`) in `api_get_chat_history(...)` (`app/test_pattern_app.cpp:3101`) to compare with `[history] push obj=...` from `recordHistoryMessage()` (`app/wibwob_view.cpp:255`).

## 4) Thread Map

| Function / Hop | Thread | `chatHistory_` access |
|---|---|---|
| `POST /menu/command` (`tools/api_server/main.py:332`) | FastAPI/Uvicorn worker thread | No |
| `Controller.exec_command()` (`tools/api_server/controller.py:555`) | FastAPI/Uvicorn worker thread | No |
| `send_cmd("exec_command", ...)` (`tools/api_server/controller.py:562`) | FastAPI/Uvicorn worker thread | No |
| `ApiIpcServer::poll()` (`app/api_ipc.cpp:347`) | Turbo Vision main/UI thread | No direct access |
| `exec_registry_command(...)` -> `api_wibwob_ask(...)` | Turbo Vision main/UI thread | No direct access |
| `TWibWobWindow::handleEvent(0xF0F0)` (`app/wibwob_view.cpp:599`) | Turbo Vision main/UI thread | No (`pendingAsk_` only) |
| `TWibWobWindow::handleEvent(cmTimerExpired)` (`app/wibwob_view.cpp:585`) | Turbo Vision main/UI thread | No direct access |
| `TWibWobWindow::processUserInput()` (`app/wibwob_view.cpp:683`) | Turbo Vision main/UI thread | Indirect write via message view |
| `TWibWobMessageView::addMessage()` (`app/wibwob_view.cpp:96`) | Turbo Vision main/UI thread | Write (via `recordHistoryMessage`) |
| `TWibWobMessageView::recordHistoryMessage()` (`app/wibwob_view.cpp:250`) | Turbo Vision main/UI thread | **Write** (`push_back`) |
| `TWibWobMessageView::startStreamingMessage()` (`app/wibwob_view.cpp:156`) | Turbo Vision main/UI thread | **Write** (assistant placeholder `push_back`) |
| `ClaudeCodeSDKProvider::sendStreamingQuery()` (`app/llm/providers/claude_code_sdk_provider.cpp:351`) | Turbo Vision main/UI thread | No |
| `ClaudeCodeSDKProvider::processStreamingThread()` (`app/llm/providers/claude_code_sdk_provider.cpp:408`) | Background `std::thread` | No (`streamQueue` only, under `queueMutex`) |
| `ClaudeCodeSDKProvider::poll()` (`app/llm/providers/claude_code_sdk_provider.cpp:487`) | Turbo Vision main/UI thread | No direct `chatHistory_`; delivers callback |
| `streamCallback` (lambda in `processUserInput`) | Turbo Vision main/UI thread | Indirect write via message view |
| `TWibWobMessageView::appendToStreamingMessage()` (`app/wibwob_view.cpp:190`) | Turbo Vision main/UI thread | **Write** (`chatHistory_.back().content += ...`) |
| `TWibWobMessageView::finishStreamingMessage()` (`app/wibwob_view.cpp:207`) | Turbo Vision main/UI thread | **Write** (final sync to `chatHistory_.back()`) |
| `api_get_chat_history()` (`app/test_pattern_app.cpp:3093`) | Turbo Vision main/UI thread | Read via `getHistoryJson()` |
| `TWibWobMessageView::getHistoryJson()` (`app/wibwob_view.cpp:259`) | Turbo Vision main/UI thread | **Read** |

### Mutex answer

- `chatHistory_`: **No mutex**.
- Streaming provider queue: **Yes**, `queueMutex` protects `streamQueue` in `ClaudeCodeSDKProvider`, not `chatHistory_`.
- In the SDK streaming path traced here, `chatHistory_` is read/written on one thread (Turbo Vision main thread), so no current cross-thread race was found for `chatHistory_`.

## Verification Notes / Gaps

- I could not query the live FastAPI/tmux sessions from the sandboxed shell in this environment.
- I could inspect source + local logs, and the chat session log confirms a real streaming exchange (`logs/chat_20260224_120842_949385.log`).
- `/tmp/wibwob_debug.log` did not contain your newly added `[history] push obj=` lines during this trace, so pointer comparison required an app rebuild/restart (or wrong instance was inspected).

## Next Check (after rebuild/restart)

1. Trigger one API ask.
2. Call `get_chat_history`.
3. Compare:
   - `[history] push obj=...` (from `recordHistoryMessage`) in `/tmp/wibwob_debug.log`
   - `[history] read obj=...` (from `api_get_chat_history`) in `/tmp/wibwob_debug.log`
4. They should now match for the targeted/current WibWob window.

