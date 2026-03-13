#!/usr/bin/env bash
# autoresearch.sh — restart WibWob-DOS and screenshot the Music Player window.
# Cycles through viz modes to capture each one.
set -euo pipefail
REPO_ROOT="$(pwd)"

# ── 1. Restart the app ──────────────────────────────────────────────
bash "$REPO_ROOT/scripts/restart.sh"

# ── 2. Open the Music Player via API ────────────────────────────────
sleep 1
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"music-player.open"}' > /dev/null

sleep 2

# ── 3. Cycle to WAVE mode (press v once) ────────────────────────────
# Send writeInput to cycle viz
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"music-player.open"}' > /dev/null 2>&1 || true

# Use state to find window ID, then writeInput
WIN_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "import sys,json; d=json.load(sys.stdin); print([w['id'] for w in d['windows'] if 'Music' in w.get('title','')][0])" 2>/dev/null || echo "")

if [ -n "$WIN_ID" ]; then
  # writeInput "v" to cycle viz mode
  curl -s -X POST "http://127.0.0.1:8099/windows/$WIN_ID/input" \
    -H 'Content-Type: application/json' \
    -d '{"text":"v"}' > /dev/null 2>&1 || true
fi

sleep 1.5

# ── 4. Screenshot ───────────────────────────────────────────────────
SHOT_DIR="$REPO_ROOT/autoresearch/music-player"
SHOT="$SHOT_DIR/screenshot.png"

screencapture -D 2 -x "$SHOT"
file "$SHOT"
echo "$SHOT"
echo "Screenshot saved to $SHOT"

# Archive with timestamp
TS=$(date +%H%M%S)
IDX=$(printf "%03d" "$(ls "$SHOT_DIR/shots/" 2>/dev/null | wc -l | tr -d ' ')")
ARCHIVE="$SHOT_DIR/shots/${IDX}-${TS}.png"
cp "$SHOT" "$ARCHIVE"
echo "Archived to $ARCHIVE"

echo "Agent should Read this file and score it against the rubric."
