Report written to `get_chat_history_ipc_diagnosis.md`.

Key conclusions:
- `get_chat_history` is executed synchronously from the app’s `idle()` loop (`app/test_pattern_app.cpp:2883` -> `app/api_ipc.cpp:347` / `:408` -> `app/command_registry.cpp:339`), not marshalled to a background IPC thread.
- `chatHistory_` has no synchronization (`app/wibwob_view.h:80`; no mutex/lock usage in `wibwob_view.*`).
- `addMessage()` and streaming paths do populate `chatHistory_` (`app/wibwob_view.cpp:109`, `:184`, `:199`, `:216`), so the recording path looks correct.
- Most likely root cause: `api_get_chat_history()` reads the first `TWibWobWindow` found on the desktop, not the focused/visible one (`app/test_pattern_app.cpp:3080`-`:3084`), so it can return the wrong (empty) chat instance.

Minimal fix recommended in the report:
- Make `get_chat_history` target the focused Wib&Wob window (or accept an optional `window_id`), with fallback to first-found for compatibility.

Thread-safety risk flagged:
- Streaming callback appears to run on a non-UI thread and directly mutates `messageView`/`chatHistory_` (`app/wibwob_view.cpp:787` onward), which is a data-race/UI-thread-affinity hazard.

If you want, I can patch the minimal focused-window fix next.