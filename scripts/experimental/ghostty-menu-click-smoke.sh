#!/usr/bin/env bash
# @name    ghostty-menu-click-smoke
# @desc    Smoke-test Ghostty AppleScript mouse click routing against WibWob menu state
#
# Usage:
#   scripts/experimental/ghostty-menu-click-smoke.sh [terminal-index]
#
# Notes:
# - Requires Ghostty 1.3+ with AppleScript mouse commands.
# - Requires WibWob running and visible in the target terminal.
# - If WibWob runs in detached tmux not attached to Ghostty, clicks will no-op.

set -euo pipefail

TERM_INDEX="${1:-1}"
API="http://127.0.0.1:8099"

ui_menu_open() {
  curl -sf "$API/runtime/inspection" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(str(d.get("snapshot",{}).get("ui",{}).get("menu",{}).get("open", False)).lower())'
}

click() {
  local x="$1" y="$2"
  osascript -e "tell application \"Ghostty\" to send mouse position x $x y $y to terminal $TERM_INDEX"
  osascript -e "tell application \"Ghostty\" to send mouse button left button action press to terminal $TERM_INDEX"
  osascript -e "tell application \"Ghostty\" to send mouse button left button action release to terminal $TERM_INDEX"
}

echo "before menu.open=$(ui_menu_open)"

echo "click: File menu (x=20,y=10)"
click 20 10
sleep 0.4
echo "after file click menu.open=$(ui_menu_open)"

echo "click: Applications menu guess (x=125,y=10)"
click 125 10
sleep 0.4
echo "after apps click menu.open=$(ui_menu_open)"

echo "done"
