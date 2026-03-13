#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

bash "$REPO_ROOT/scripts/restart.sh"
sleep 1

# Close any existing windows, open terrain lab maximised
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys, json
for w in json.load(sys.stdin)['windows']:
    import urllib.request
    req = urllib.request.Request(f'http://127.0.0.1:8099/windows/close',
        data=json.dumps({'id': w['id']}).encode(), method='POST',
        headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req)
" 2>/dev/null || true

sleep 0.3

# Open terrain lab
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"command":"terrain-lab.open"}' > /dev/null

sleep 0.5

# Maximise it
WID=$(curl -s http://127.0.0.1:8099/state | python3 -c "import sys,json; ws=json.load(sys.stdin)['windows']; print(ws[-1]['id'])")
SCREEN_W=$(curl -s http://127.0.0.1:8099/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['screen']['width'])")
SCREEN_H=$(curl -s http://127.0.0.1:8099/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['screen']['height'])")
W=$((SCREEN_W - 5))
H=$((SCREEN_H - 3))
curl -s -X POST http://127.0.0.1:8099/windows/resize \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$WID,\"width\":$W,\"height\":$H}" > /dev/null
curl -s -X POST http://127.0.0.1:8099/windows/move \
  -H 'Content-Type: application/json' \
  -d "{\"id\":$WID,\"left\":2,\"top\":0}" > /dev/null

sleep 0.5

SHOT_DIR="$REPO_ROOT/autoresearch/terrain-lab"
SHOT="$SHOT_DIR/screenshot.png"

# Use tmux-to-PNG renderer (reliable even when display is unavailable)
python3 "$REPO_ROOT/autoresearch/terrain-lab/tmux-to-png.py" "$SHOT"

file "$SHOT"
echo "Screenshot saved to $SHOT"

TS=$(date +%H%M%S)
IDX=$(printf "%03d" "$(ls "$SHOT_DIR/shots/" 2>/dev/null | wc -l | tr -d ' ')")
cp "$SHOT" "$SHOT_DIR/shots/${IDX}-${TS}.png"
echo "Archived to $SHOT_DIR/shots/${IDX}-${TS}.png"
