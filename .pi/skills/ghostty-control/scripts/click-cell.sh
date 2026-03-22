#!/usr/bin/env bash
# @desc  Click a TUI cell by col/row coordinates. Double-clicks by default.
# Usage: bash click-cell.sh <col> <row> [--single]
set -euo pipefail

COL="${1:?usage: click-cell.sh <col> <row> [--single]}"
ROW="${2:?usage: click-cell.sh <col> <row>}"
shift 2

SINGLE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --single) SINGLE=true; shift ;;
    *)        echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
eval "$("${SCRIPT_DIR}/calibrate.sh")"

if $SINGLE; then
  osascript <<EOF
tell application "Ghostty"
  activate
  delay 0.3
  set t to focused terminal of selected tab of front window
  send mouse position x (${COL}.0 * ${CELL_W} + ${CELL_W} / 2.0) y (${ROW}.0 * ${CELL_H} + ${CELL_H} / 2.0) to t
  delay 0.1
  send mouse button left button action press to t
  delay 0.05
  send mouse button left button action release to t
end tell
EOF
else
  osascript <<EOF
tell application "Ghostty"
  activate
  delay 0.3
  set t to focused terminal of selected tab of front window
  set px to (${COL}.0 * ${CELL_W} + ${CELL_W} / 2.0)
  set py to (${ROW}.0 * ${CELL_H} + ${CELL_H} / 2.0)
  send mouse position x px y py to t
  delay 0.1
  send mouse button left button action press to t
  delay 0.05
  send mouse button left button action release to t
  delay 0.2
  send mouse position x px y py to t
  delay 0.1
  send mouse button left button action press to t
  delay 0.05
  send mouse button left button action release to t
end tell
EOF
fi
