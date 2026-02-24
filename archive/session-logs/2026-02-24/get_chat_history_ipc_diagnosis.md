# `get_chat_history` IPC Diagnosis

## Executive Summary

The C++ IPC `get_chat_history` path is **not marshalled to a background thread**; it runs during the app's main `idle()` loop and dispatches synchronously into `api_get_chat_history()`.

The most likely code-level root cause for `{"messages":[]}` while a chat window visibly shows messages is **window selection**, not message recording:

- `api_get_chat_history()` returns the history from the **first** `TWibWobWindow` found on the desktop iteration, not the focused/visible/targeted chat window.
- If more than one Wib&Wob chat window exists, it can read an empty instance even while another visible one has messages.

Separately, there is a real thread-safety risk in Wib&Wob streaming: a provider callback (explicitly noted as a streaming thread) directly mutates `messageView` and `chatHistory_` without synchronization.

## Answers To Specific Questions

### 1) Is `api_get_chat_history()` called directly from the IPC background thread, or marshalled to the main UI thread?

### Finding

For the C++ Unix-socket IPC path, `api_get_chat_history()` is effectively executed on the **main UI thread** (inside the app's `idle()` loop), not a dedicated IPC worker thread.

### Evidence

- `TTestPatternApp::idle()` polls the IPC server from the UI loop: `app/test_pattern_app.cpp:2878`, `app/test_pattern_app.cpp:2883`
- `ApiIpcServer::poll()` accepts and dispatches commands synchronously: `app/api_ipc.cpp:347`, `app/api_ipc.cpp:402`, `app/api_ipc.cpp:408`
- Registry dispatch calls `api_get_chat_history(app)` directly: `app/command_registry.cpp:338`, `app/command_registry.cpp:339`
- `api_get_chat_history()` itself is a direct synchronous read: `app/test_pattern_app.cpp:3076`

### Conclusion

`get_chat_history` is **not** being marshalled via `putEvent()` like `wibwob_ask`; it is a direct synchronous read during `idle()`. So the “IPC background thread sees empty state” theory is not supported by this code path.

## 2) Is there a mutex or any synchronisation protecting `chatHistory_`?

### Finding

No. `chatHistory_` has **no mutex/lock protection**.

### Evidence

- Declaration is a plain vector: `app/wibwob_view.h:80`
- Reads/writes occur directly:
  - add message path pushes history: `app/wibwob_view.cpp:109`, `app/wibwob_view.cpp:250`, `app/wibwob_view.cpp:254`
  - streaming path mutates history: `app/wibwob_view.cpp:184`, `app/wibwob_view.cpp:199`, `app/wibwob_view.cpp:216`, `app/wibwob_view.cpp:231`
  - IPC read serializes history: `app/wibwob_view.cpp:257`, `app/wibwob_view.cpp:260`
- No `mutex`/`lock_guard` usage in `app/wibwob_view.h` or `app/wibwob_view.cpp` (searched).

## 3) Could `chatHistory_` on the `TWibWobMessageView` returned by `getMessageView()` differ from the one `addMessage()` writes to? (e.g. two different object instances)

### Within a single `TWibWobWindow`: No

`getMessageView()` returns the window member pointer, and `TWibWobWindow` message paths use that same member.

### Evidence

- `getMessageView()` returns `messageView`: `app/wibwob_view.h:159`
- `api_get_chat_history()` uses `chatWin->getMessageView()`: `app/test_pattern_app.cpp:3090`
- `TWibWobWindow` uses its `messageView` member for user/system/assistant display operations, including `addMessage(...)`: e.g. `app/wibwob_view.cpp:742`, `app/wibwob_view.cpp:825`, `app/wibwob_view.cpp:871`

### Across multiple `TWibWobWindow` instances: Yes (this is the likely bug)

`api_get_chat_history()` selects the **first** `TWibWobWindow` found during desktop iteration and returns that window's history, regardless of focus/visibility/which chat the user is looking at.

### Evidence

- Iterates desktop views and breaks on the first `TWibWobWindow`: `app/test_pattern_app.cpp:3080`, `app/test_pattern_app.cpp:3083`, `app/test_pattern_app.cpp:3084`
- No focus check, no window ID parameter, no attempt to choose the active chat window: `app/test_pattern_app.cpp:3076`

### Likely symptom match

If an empty Wib&Wob chat window exists (for example from layout restore, manual extra chat creation, or another session flow), `get_chat_history` can consistently return `[]` while another visible Wib&Wob window contains messages.

## 4) Is there any code path where `chatHistory_` gets cleared after messages are added?

### Finding

Yes, but only explicitly via `TWibWobMessageView::clear()` (e.g. `/clear`). I did not find an automatic clear path specific to IPC history reads.

### Evidence

- `clear()` clears `chatHistory_`: `app/wibwob_view.cpp:115`, `app/wibwob_view.cpp:118`
- `/clear` command invokes `messageView->clear()`: `app/wibwob_view.cpp:699`, `app/wibwob_view.cpp:700`
- No other `messageView->clear()` call sites found in the searched code.

## Root Cause (with file:line evidence)

### Primary root cause (code bug)

`get_chat_history` is not keyed to a specific chat window and instead returns history from the **first** `TWibWobWindow` encountered on the desktop.

- Selection bug: `app/test_pattern_app.cpp:3077`, `app/test_pattern_app.cpp:3080`, `app/test_pattern_app.cpp:3084`
- Read of selected window history: `app/test_pattern_app.cpp:3090`, `app/test_pattern_app.cpp:3092`

### Why this is more likely than a history-recording bug

The message view code clearly records history whenever messages are displayed:

- Normal messages: `addMessage()` records history immediately after pushing to `messages`: `app/wibwob_view.cpp:95`, `app/wibwob_view.cpp:108`, `app/wibwob_view.cpp:109`
- Streaming assistant messages: history placeholder + incremental updates + final sync are all present: `app/wibwob_view.cpp:180`, `app/wibwob_view.cpp:184`, `app/wibwob_view.cpp:199`, `app/wibwob_view.cpp:216`

## Minimal Fix

### Recommended minimal change

Make `api_get_chat_history()` prefer the **focused** `TWibWobWindow` (or accept an explicit `window_id`) instead of the first one in desktop iteration.

### Smallest behavior-preserving improvement

- Scan all `TWibWobWindow`s.
- Prefer the focused/selected chat window.
- Fallback to first found for backward compatibility.

### Better API fix (slightly larger, more robust)

Add optional `window_id` to `get_chat_history` registry command, so callers can request the exact chat window.

## Thread-Safety Risks To Flag

### 1) Unsynchronised access to `chatHistory_` (data race risk)

`chatHistory_` is a plain vector with no locking, and it is read/written from code paths that may run on different threads.

### 2) Streaming callback appears to run off the UI thread and mutates UI directly

The code comment explicitly says the streaming thread may still be running, and the callback directly calls `messageView`/`inputView` methods and mutates history transitively.

- Streaming-thread comment and callback: `app/wibwob_view.cpp:787`, `app/wibwob_view.cpp:789`
- Direct UI mutations from callback: `app/wibwob_view.cpp:808`, `app/wibwob_view.cpp:815`, `app/wibwob_view.cpp:824`, `app/wibwob_view.cpp:825`

This is a broader UI-thread-affinity problem (not just `chatHistory_`), and can produce intermittent crashes or corrupted state.

### Recommended follow-up hardening

- Marshal streaming chunks onto the UI thread (similar in spirit to `wibwob_ask` using `putEvent()`), then update `messageView` there.
- If cross-thread reads must remain, protect `chatHistory_` (and likely `messages`) with a mutex and avoid UI drawing calls off-thread.

## Suggested Debug Confirmation (fast)

To confirm the primary root cause in your current repro, add temporary logging in `api_get_chat_history()` to print:

- number of `TWibWobWindow`s found
- each window title / pointer
- focused flag (if available)
- `msgView->getMessages().size()` and `msgView->getHistoryJson().size()`

If you see multiple Wib&Wob windows and the first one is empty, this diagnosis is confirmed.
