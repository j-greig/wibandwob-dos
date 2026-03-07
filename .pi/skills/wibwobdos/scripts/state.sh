#!/usr/bin/env bash
# state.sh — compact live desktop state
#
# Usage:
#   bash scripts/state.sh               # full state
#   bash scripts/state.sh --json        # raw /state JSON
#   bash scripts/state.sh --windows     # window list only (id title w h x y)
#
# Output is designed to be human-readable and agent-parseable.

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"

RAW=$(curl -sf --connect-timeout 5 "$API/state") || {
  echo "error: cannot reach $API — run: eval \"\$(bash scripts/connect.sh)\"" >&2
  exit 1
}

MODE="${1:---pretty}"

case "$MODE" in
  --json)
    echo "$RAW" | python3 -m json.tool
    ;;
  --windows)
    echo "$RAW" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for w in d.get('windows', []):
    focus = '◀' if w.get('focused') else ' '
    ww, hh = w.get('width', w.get('w','?')), w.get('height', w.get('h','?'))
    xx, yy = w.get('left',  w.get('x','?')), w.get('top',    w.get('y','?'))
    print(f\"{focus} {w['id']:>3}  {w.get('title','?'):<30}  {ww}x{hh}  @{xx},{yy}\")
"
    ;;
  *)
    echo "$RAW" | python3 -c "
import sys, json

d     = json.loads(sys.stdin.read())
app   = d.get('app', {})
scr   = d.get('screen', {})
focus = d.get('focus', {})
wins  = d.get('windows', [])

label    = app.get('instanceLabel') or app.get('sessionId', '?')
theme    = app.get('theme', '?')
sid      = app.get('sessionId', '?')
w, h     = scr.get('width', '?'), scr.get('height', '?')
focus_id = focus.get('windowId', 'none')

print(f'WibWob-DOS  {label}  {theme}  {w}x{h}  {len(wins)} windows  focus:{focus_id}  session:{sid}')

if not wins:
    print('  (no open windows — open one: bash scripts/open.sh <command-id>)')
else:
    print()
    for ww in wins:
        fmark = '◀' if ww.get('focused') or ww['id'] == focus_id else ' '
        title = ww.get('title', '?')
        wid   = ww['id']
        typ   = ww.get('appType', ww.get('kind', ''))
        ww_w  = ww.get('width',  ww.get('w', '?'))
        ww_h  = ww.get('height', ww.get('h', '?'))
        ww_x  = ww.get('left',   ww.get('x', '?'))
        ww_y  = ww.get('top',    ww.get('y', '?'))
        print(f'  {fmark} [{wid:>3}] {title:<32}  {ww_w:>4}x{str(ww_h):<4}  @{str(ww_x):>3},{ww_y}  {typ}')
"
    ;;
esac
