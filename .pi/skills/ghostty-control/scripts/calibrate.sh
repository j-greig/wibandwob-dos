#!/usr/bin/env bash
# @desc  Output Ghostty window + cell dimensions as shell-sourceable vars.
# Finds the correct Ghostty window by matching terminal working directory.
# Usage: eval $(bash calibrate.sh)
#
# Outputs: PORT WIN_W WIN_H COLS ROWS CELL_W CELL_H TITLE_BAR GHOSTTY_WIN_INDEX
set -euo pipefail

# Auto-detect port from wibwob health (canonical instance)
PORT=$(wibwob health 2>&1 | awk '/^port:/{print $2}')
if [[ -z "$PORT" ]]; then
  echo "ERROR: no running wibwob instance found" >&2
  exit 1
fi

# Find which Ghostty window contains a terminal with wibandwob-dos cwd
GHOSTTY_WIN_INDEX=$(osascript <<'AS'
tell application "Ghostty"
  set winCount to count of windows
  repeat with i from 1 to winCount
    repeat with t in terminals of window i
      if working directory of t contains "wibandwob-dos" then return i
    end repeat
  end repeat
  return 1
end tell
AS
)

# Window size from that specific window
read -r WIN_W WIN_H < <(
  osascript -e "tell application \"System Events\" to tell process \"Ghostty\" to size of window ${GHOSTTY_WIN_INDEX}" \
  | tr -d ',' | awk '{print $1, $2}'
)

# Screen dimensions from wibwob API
read -r COLS ROWS < <(
  curl -sf "http://127.0.0.1:${PORT}/health" \
  | jq -r '.screen | "\(.width) \(.height)"'
)

TITLE_BAR=28
read -r CELL_W CELL_H < <(
  awk "BEGIN { printf \"%.6f %.6f\n\", ${WIN_W}/${COLS}, (${WIN_H}-${TITLE_BAR})/${ROWS} }"
)

echo "PORT=${PORT}"
echo "GHOSTTY_WIN_INDEX=${GHOSTTY_WIN_INDEX}"
echo "WIN_W=${WIN_W} WIN_H=${WIN_H}"
echo "COLS=${COLS} ROWS=${ROWS}"
echo "CELL_W=${CELL_W} CELL_H=${CELL_H}"
echo "TITLE_BAR=${TITLE_BAR}"
