#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

bash "$REPO_ROOT/scripts/restart.sh"
sleep 1

# Open TR-808
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.tr808.open"}' > /dev/null

sleep 1.5

# Load a preset so the grid has content
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.tr808.load-preset","args":{"name":"rock-1"}}' > /dev/null 2>&1 || true

sleep 0.5

SHOT_DIR="$REPO_ROOT/autoresearch/tr808"
SHOT="$SHOT_DIR/screenshot.png"
# Try display 2 first, fall back to display 1, then default
screencapture -D 2 -x "$SHOT" 2>/dev/null || screencapture -D 1 -x "$SHOT" 2>/dev/null || screencapture -x "$SHOT"
file "$SHOT"
echo "Screenshot saved to $SHOT"

TS=$(date +%H%M%S)
IDX=$(printf "%03d" "$(ls "$SHOT_DIR/shots/" 2>/dev/null | wc -l | tr -d ' ')")
cp "$SHOT" "$SHOT_DIR/shots/${IDX}-${TS}.png"
echo "Archived to $SHOT_DIR/shots/${IDX}-${TS}.png"
