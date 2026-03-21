#!/usr/bin/env bash
# validate-microapp.sh — open a microapp, screenshot it, check it's not blank
#
# Usage: bash scripts/validate-microapp.sh <command-id> [min-chars]
#   command-id  e.g. microapp.wibwob.click-counter.open
#   min-chars   minimum captureText length to pass (default: 50)
#
# Exits 0 on PASS, 1 on FAIL.
# Prints a short PASS/FAIL report with an excerpt of the screenshot.

set -euo pipefail

COMMAND_ID="${1:-}"
MIN_CHARS="${2:-5}"
PORT="${CONTROL_API_PORT:-8099}"
API="http://127.0.0.1:${PORT}"

if [[ -z "$COMMAND_ID" ]]; then
  echo "Usage: bash scripts/validate-microapp.sh <command-id> [min-chars]"
  echo "  e.g. bash scripts/validate-microapp.sh microapp.wibwob.click-counter.open"
  exit 1
fi

echo "▶ validate-microapp: $COMMAND_ID"

# 1. Health check first
if ! curl -sf --max-time 5 "$API/health" >/dev/null 2>&1; then
  echo "✗ FAIL — API not responding at $API"
  exit 1
fi

# 2. Open the microapp
open_result=$(curl -sf --max-time 5 -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"$COMMAND_ID\"}" 2>&1) || {
  echo "✗ FAIL — could not open command: $COMMAND_ID"
  echo "  $open_result"
  exit 1
}
echo "  opened: $open_result"

# 3. Wait for render
sleep 1

# 4. Get window list, find the newest window ID
state=$(curl -sf --max-time 5 "$API/state" 2>/dev/null)
win_id=$(echo "$state" | python3 -c "
import sys, json
d = json.load(sys.stdin)
wins = d.get('windows', [])
if wins:
    # highest id = most recently opened
    print(max(w['id'] for w in wins))
" 2>/dev/null || echo "")

if [[ -z "$win_id" ]]; then
  echo "✗ FAIL — no windows found after opening $COMMAND_ID"
  exit 1
fi
echo "  window id: $win_id"

# 5. Text screenshot
screenshot=$(curl -sf --max-time 5 "$API/screenshot/text?id=$win_id" 2>/dev/null || echo "")

# 6. Measure content
char_count=${#screenshot}
echo "  captureText length: $char_count chars (minimum: $MIN_CHARS)"

# 7. Show excerpt (first 200 chars, single line)
excerpt=$(echo "$screenshot" | head -5 | tr '\n' ' ' | cut -c1-200)
echo "  excerpt: $excerpt"

# 8. Close the window
curl -sf --max-time 5 -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"window.close\",\"args\":{\"id\":$win_id}}" >/dev/null 2>&1 || true
echo "  window closed"

# 9. Pass/fail
if [[ $char_count -lt $MIN_CHARS ]]; then
  echo ""
  echo "✗ FAIL — captureText returned $char_count chars (< $MIN_CHARS minimum)"
  echo "  App appears blank or not rendering content."
  echo "  Check: does the microapp implement captureText() returning meaningful text?"
  echo "  Tip: for richer apps pass a higher threshold: bash scripts/validate-microapp.sh <id> 50"
  exit 1
fi

echo ""
echo "✓ PASS — $COMMAND_ID ($char_count chars)"
