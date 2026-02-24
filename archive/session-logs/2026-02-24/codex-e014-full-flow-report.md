Report written to `tmp/wibwob-chat-flow-trace.md`.

What’s in it:
- Full forward path: `POST /menu/command` -> Python controller -> IPC -> command registry -> `api_wibwob_ask` -> `TWibWobWindow` event/timer drain -> `processUserInput()` -> `chatHistory_`
- Full backward path: SDK `sendStreamingQuery()` -> background reader thread -> main-thread `poll()` callback delivery -> streaming message methods -> `chatHistory_`
- Thread map table (`function | thread | reads/writes chatHistory_`)
- Mutex answer: no mutex on `chatHistory_` (streaming path still main-thread for history access)
- Exact bug: window-targeting mismatch between `api_wibwob_ask` and `api_get_chat_history` can return history from a different WibWob window (`[]`)

Minimal fix applied:
- `app/test_pattern_app.cpp:3038` add shared WibWob target selector (prefer focused/current window)
- `app/test_pattern_app.cpp:3089` route `wibwob_ask` event directly to the selected window (instead of global `putEvent`)
- `app/test_pattern_app.cpp:3096` make `get_chat_history` read from the same selected window
- `app/test_pattern_app.cpp:3101` add `[history] read obj=...` logging for pointer comparison

Runtime note:
- `/tmp/wibwob_debug.log` currently has no `[history] push obj=` lines, so the live process likely predates your `recordHistoryMessage()` instrumentation (or a different instance is being inspected). I could not validate tmux/API live from this sandbox.

I did not run a rebuild/test in this pass.