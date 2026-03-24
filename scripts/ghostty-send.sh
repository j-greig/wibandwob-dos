#!/usr/bin/env bash
# ghostty-send.sh — send a shell command to a Ghostty terminal by wibwob port or label
#
# Usage:
#   bash scripts/ghostty-send.sh --port 8100 "bun run dev"
#   bash scripts/ghostty-send.sh --label 17d  "wibwob state"
#   bash scripts/ghostty-send.sh --pid 80952  "ls"
#
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── config ────────────────────────────────────────────────────
CLEAR_FIRST=true   # Ctrl-C + Ctrl-U before command (set false with --no-clear)

MATCH_FLAG=""
MATCH_VALUE=""
CMD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port|--label|--pid) MATCH_FLAG="$1"; MATCH_VALUE="$2"; shift 2 ;;
    --no-clear) CLEAR_FIRST=false; shift ;;
    *) CMD="$1"; shift ;;
  esac
done

if [[ -z "$MATCH_FLAG" || -z "$CMD" ]]; then
  echo "Usage: $0 --port <n> | --label <str> | --pid <n>  [--no-clear]  \"<command>\"" >&2
  exit 1
fi

# Get the CGWindowID, then derive window title for AppleScript lookup
WIN_CGI=$(bash "$SCRIPT_DIR/ghostty-window-id.sh" "$MATCH_FLAG" "$MATCH_VALUE")

WIN_TITLE=$(python3 - "$WIN_CGI" << 'PYEOF'
import sys
from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID
target = int(sys.argv[1])
windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)
for w in windows:
    if w.get('kCGWindowNumber', 0) == target:
        print(w.get('kCGWindowName', ''))
        sys.exit(0)
sys.exit(1)
PYEOF
)

echo "→ window: $WIN_TITLE (cgid=$WIN_CGI)"
echo "→ command: $CMD"

CLEAR_BLOCK=""
if $CLEAR_FIRST; then
  CLEAR_BLOCK='send key "c" modifiers "control" to t
    delay 0.05
    send key "u" modifiers "control" to t
    delay 0.05'
fi

osascript << ASEOF
tell application "Ghostty"
  repeat with w in windows
    repeat with tb in tabs of w
      set t to focused terminal of tb
      if name of t is "$WIN_TITLE" then
        $CLEAR_BLOCK
        input text "$CMD" to t
        send key "enter" to t
        return
      end if
    end repeat
  end repeat
end tell
ASEOF

echo "✓ sent"
