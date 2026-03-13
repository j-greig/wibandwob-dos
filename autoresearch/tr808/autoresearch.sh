#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

bash "$REPO_ROOT/scripts/restart.sh"
sleep 1

# Open TR-808
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"command":"microapp.wibwob.tr808.open"}' > /dev/null 2>&1 || true

sleep 1

# Load a preset so the grid has content for scoring
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"command":"microapp.wibwob.tr808.load-preset","args":{"preset":"classic-house"}}' > /dev/null 2>&1 || true

sleep 0.5

# Verify preset loaded
STEPS=$(curl -s "http://127.0.0.1:8099/state?detail=true" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for w in d['windows']:
    if 'TR-808' in w.get('title',''):
        det = w.get('details', {})
        active = sum(1 for i in det.get('instruments',[]) for s in i.get('steps',[]) if s)
        print(active)
        break
" 2>/dev/null || echo "0")
echo "Active steps after preset load: $STEPS"

SHOT_DIR="$REPO_ROOT/autoresearch/tr808"
SHOT="$SHOT_DIR/screenshot.png"

# Try screencapture first, fall back to tmux-to-PNG renderer
if screencapture -D 2 -x "$SHOT" 2>/dev/null || screencapture -D 1 -x "$SHOT" 2>/dev/null || screencapture -x "$SHOT" 2>/dev/null; then
  echo "Screenshot via screencapture"
else
  echo "screencapture failed, using tmux-to-PNG fallback"
  python3 "$REPO_ROOT/autoresearch/tr808/tmux-to-png.py" "$SHOT"
fi

file "$SHOT"
echo "Screenshot saved to $SHOT"

TS=$(date +%H%M%S)
IDX=$(printf "%03d" "$(ls "$SHOT_DIR/shots/" 2>/dev/null | wc -l | tr -d ' ')")
cp "$SHOT" "$SHOT_DIR/shots/${IDX}-${TS}.png"
echo "Archived to $SHOT_DIR/shots/${IDX}-${TS}.png"
