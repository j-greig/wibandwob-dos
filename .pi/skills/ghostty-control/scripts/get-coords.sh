#!/usr/bin/env bash
# @desc  Print Ghostty window geometry + TUI cell size for click calibration (legacy, see calibrate.sh).
#
# Usage: bash .pi/skills/ghostty-control/scripts/get-coords.sh
#
# Output:
#   window: x=1111 y=156 w=1384 h=1167
#   terminal: 173 cols x 66 rows
#   cell: 8.0 x 17.3 px  (title bar: 28px)
#   formula: pixel_x = col * cell_w | pixel_y = row * cell_h

set -euo pipefail

# Window geometry via System Events
GEO=$(osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}' 2>/dev/null) || {
  echo "✗ Ghostty not running or not accessible" >&2
  exit 1
}

WIN_X=$(echo "$GEO" | awk -F',' '{print $1}' | tr -d ' ')
WIN_Y=$(echo "$GEO" | awk -F',' '{print $2}' | tr -d ' ')
WIN_W=$(echo "$GEO" | awk -F',' '{print $3}' | tr -d ' ')
WIN_H=$(echo "$GEO" | awk -F',' '{print $4}' | tr -d ' ')

# Terminal dimensions from wibwob
SCREEN=$(wibwob ls 2>/dev/null | python3 -c "
import json,sys
instances = json.load(sys.stdin)
if not instances:
    print('0 0')
    exit()
s = instances[0]['screen']
print(s['width'], s['height'])
" 2>/dev/null) || { echo "✗ wibwob not running" >&2; exit 1; }

COLS=$(echo "$SCREEN" | awk '{print $1}')
ROWS=$(echo "$SCREEN" | awk '{print $2}')

TITLE_BAR=28
CELL_W=$(python3 -c "print(f'{$WIN_W / $COLS:.1f}')")
CELL_H=$(python3 -c "print(f'{($WIN_H - $TITLE_BAR) / $ROWS:.1f}')")

echo "window:   x=${WIN_X} y=${WIN_Y} w=${WIN_W} h=${WIN_H}"
echo "terminal: ${COLS} cols x ${ROWS} rows"
echo "cell:     ${CELL_W} x ${CELL_H} px  (title bar: ${TITLE_BAR}px)"
echo "formula:  pixel_x = col * ${CELL_W} | pixel_y = row * ${CELL_H}"
echo ""
echo "# osascript click template:"
echo "# send mouse position x (COL * ${CELL_W}) y (ROW * ${CELL_H}) to t"
