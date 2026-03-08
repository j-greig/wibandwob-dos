#!/usr/bin/env bash
# poll-window.sh — wait for a window to appear in /state and optionally have content
# [vps-ok] requires: WIBWOB_API, WIBWOB_TOKEN
# Usage: bash scripts/poll-window.sh <window-id> [timeout-seconds]
#
# Exits 0 when window has text content. Prints the text to stdout.
# Exits 1 on timeout.
set -euo pipefail

: "${WIBWOB_API:=http://127.0.0.1:8099}"
: "${WIBWOB_TOKEN:=}"
WINDOW_ID="${1:?Usage: poll-window.sh <window-id> [timeout-seconds]}"
TIMEOUT="${2:-10}"

if [[ -z "$WIBWOB_TOKEN" ]]; then
  echo "ERROR: WIBWOB_TOKEN not set." >&2
  exit 1
fi

H="Authorization: Bearer $WIBWOB_TOKEN"
deadline=$(( $(date +%s) + TIMEOUT ))

while [[ $(date +%s) -lt $deadline ]]; do
  response=$(curl -sf -H "$H" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"id\":$WINDOW_ID}" \
    "$WIBWOB_API/windows/text" 2>/dev/null || echo '{"ok":false}')

  text=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('text','') or '')" 2>/dev/null || true)

  if [[ -n "$text" ]]; then
    echo "$text"
    exit 0
  fi
  sleep 0.4
done

echo "ERROR: window $WINDOW_ID had no content after ${TIMEOUT}s" >&2
exit 1
