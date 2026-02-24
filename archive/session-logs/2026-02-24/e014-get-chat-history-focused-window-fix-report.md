# E014 `get_chat_history` Focused Window Fix Report

## Summary

- Fixed `api_get_chat_history()` to prefer the focused `TWibWobWindow` (`deskTop->current`) before scanning for the first chat window.
- This addresses the reported bug where multiple chat windows exist and the API can return history from a non-visible/empty window due to z-order iteration.

## Change

- File: `app/test_pattern_app.cpp:3076`
- Updated logic in `api_get_chat_history()`:
  - First try `dynamic_cast<TWibWobWindow*>(app.deskTop->current)`
  - Fallback to existing desktop iteration for the first `TWibWobWindow` if no focused chat window is present

## Patch Evidence

- Changed lines are in `app/test_pattern_app.cpp` around `3078-3082`:
  - Added focused-window lookup via `app.deskTop->current`
  - Guarded fallback scan with `if (!chatWin && v)`

## Tests

### Build

- Command: `cmake --build build --target test_pattern -j4`
- Result: ✅ Passed (`[100%] Built target test_pattern`)

### Restart Stack

- Command: `./scripts/dev-stop.sh && sleep 1 && ./scripts/dev-start.sh`
- Result: ❌ Blocked by sandbox `tmux` access
- Error: `error connecting to /private/tmp/tmux-501/default (Operation not permitted)`

### E014 Acceptance Test

- Command: `.agents/skills/ww-launch/scripts/test-e014.sh`
- Result: ❌ Could not run acceptance flow (preflight failed)
- Output summary: `API not running` on `http://127.0.0.1:8089`

### TUI Capture Excerpt

- Command: `tmux capture-pane -t wibwob -p | grep -v '^▒\\+$' | grep -v '^$'`
- Result: ❌ Blocked by sandbox `tmux` access
- Error: `error connecting to /private/tmp/tmux-501/default (Operation not permitted)`

## Notes

- The code fix is minimal and preserves prior fallback behavior when no focused chat window exists.
- Runtime validation should be re-run in a shell with access to the local tmux server.
