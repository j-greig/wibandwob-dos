#!/usr/bin/env bash
# @desc  List all Ghostty windows with index, name, size, and terminal cwd.
# Usage: bash ghostty-windows.sh
set -euo pipefail

osascript <<'EOF'
tell application "Ghostty"
  set winCount to count of windows
  repeat with i from 1 to winCount
    set w to window i
    set wName to name of w
    tell application "System Events" to tell process "Ghostty" to set wSize to size of window i
    set wW to item 1 of wSize
    set wH to item 2 of wSize
    log "window " & i & "  " & wW & "×" & wH & "  " & wName
    repeat with t in terminals of w
      log "  terminal cwd=" & working directory of t & "  name=" & name of t
    end repeat
  end repeat
end tell
EOF
