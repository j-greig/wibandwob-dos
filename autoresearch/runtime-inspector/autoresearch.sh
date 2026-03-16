#!/bin/bash
set -euo pipefail

TEXT_PATH="scratch/autoresearch-screenshot.txt"

# ── 1. Reload the microapp ───────────────────────────────────────────
bash scripts/reload-microapp.sh wibwob.runtime-inspector 2>/dev/null || {
  echo "Reload failed, trying restart..."
  bash scripts/restart.sh
}

# ── 2. Wait for health ───────────────────────────────────────────────
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 || {
  echo "ERROR: API not healthy after 30s"
  exit 1
}

# ── 3. Open the Runtime Inspector window ─────────────────────────────
curl -sf http://127.0.0.1:8099/commands/run \
  -X POST -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.runtime-inspector.open"}' > /dev/null 2>&1 || true

# Let the UI settle (render, layout, data fetch)
sleep 2

# Ensure we're on the Overview tab by sending key "1" to the window
# Find the window ID first
WIN_ID=$(curl -sf http://127.0.0.1:8099/state 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
for w in d.get('windows', []):
    if 'runtime-inspector' in w.get('appType', '').lower() or 'Runtime Inspector' in w.get('title', ''):
        print(w['id']); break
" 2>/dev/null || echo "")

# Wait another beat for data to load
sleep 1

# ── 4. Capture text screenshot of all tabs ───────────────────────────
mkdir -p "$(dirname "$TEXT_PATH")"

{
  echo "=== TAB: Overview ==="
  bash scripts/screenshot-window.sh "Runtime Inspector" 2>/dev/null || echo "(failed)"
  echo ""
} > "$TEXT_PATH"

# Also capture the source file state for scoring structure
echo "=== SOURCE: index.ts ==="  >> "$TEXT_PATH"
wc -l microapps/runtime-inspector/index.ts >> "$TEXT_PATH"

# ── 5. Archive into run subdir ────────────────────────────────────────
SHOTS_DIR="autoresearch/runtime-inspector/shots"
mkdir -p "$SHOTS_DIR"
NEXT_NUM=$(printf "%03d" "$(( $(ls "$SHOTS_DIR"/*.txt 2>/dev/null | wc -l) + 1 ))")
STAMP=$(date +%H%M%S)
cp "$TEXT_PATH" "$SHOTS_DIR/${NEXT_NUM}-${STAMP}.txt"

echo "Text screenshot saved to $TEXT_PATH"
echo "Agent should Read $TEXT_PATH and the source file, then score against the rubric."
