#!/usr/bin/env bash
# autoresearch.sh — restart WibWob-DOS and screenshot the File Manager window.
# Two screenshots: browse view (with .ts file preview) + search view. 
# Agent scores the BEST of the two views.
set -euo pipefail
REPO_ROOT="$(pwd)"

# ── 1. Restart the app ──────────────────────────────────────────────
bash "$REPO_ROOT/scripts/restart.sh"

# ── 2. Open the File Manager via API ────────────────────────────────
sleep 1
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"finder.open"}' > /dev/null

sleep 1

# ── 3. Navigate to src/core which has .ts files near top ───────────
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"finder.navigate","args":{"path":"'"$REPO_ROOT/src/core"'"}}' > /dev/null 2>&1 || true

sleep 0.5

# ── 4. Sort by modified to get interesting files first ─────────────
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"finder.sort_by","args":{"field":"modified"}}' > /dev/null 2>&1 || true

sleep 0.5

# ── 5. Screenshot ───────────────────────────────────────────────────
SHOT_DIR="$REPO_ROOT/autoresearch/file-manager"
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
