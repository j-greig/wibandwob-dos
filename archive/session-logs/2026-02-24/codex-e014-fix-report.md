Implemented the minimal fix in `app/test_pattern_app.cpp:3076` to prefer the focused chat window for `get_chat_history`.

- Change: `api_get_chat_history()` now tries `dynamic_cast<TWibWWindow*>(app.deskTop->current)` first, then falls back to scanning the desktop (`app/test_pattern_app.cpp:3080`, `app/test_pattern_app.cpp:3082`).
- This preserves prior behavior when no focused `TWibWobWindow` exists, while fixing the wrong-window selection when multiple chat windows are open.

Validation results:

- Build: `cmake --build build --target test_pattern -j4` ✅ passed
- Restart stack: `./scripts/dev-stop.sh && sleep 1 && ./scripts/dev-start.sh` ❌ blocked by sandbox (`tmux` socket access denied)
- E014 test: `.agents/skills/ww-launch/scripts/test-e014.sh` ❌ preflight failed (`API not running`)
- TUI capture: `tmux capture-pane -t wibwob -p ...` ❌ blocked by sandbox (`tmux` socket access denied)

TUI screenshot excerpt:

- Unavailable in this run due `tmux` sandbox restriction (`error connecting to /private/tmp/tmux-501/default (Operation not permitted)`).

Structured markdown findings were written to:

- `e014-get-chat-history-focused-window-fix-report.md`

If you want, I can also prepare a tiny unit/integration test around this selection behavior so it doesn’t regress.