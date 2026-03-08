#!/usr/bin/env bash
# poll-window.sh — wait for a window to have text content
# [vps-ok] WIBWOB_TOKEN optional — omit for local no-auth instances
# Usage: bash scripts/poll-window.sh <window-id> [timeout-seconds]
# Exits 0 with text on stdout. Exits 1 on timeout.
set -eo pipefail

: "${WIBWOB_API:=http://127.0.0.1:8099}"
: "${WIBWOB_TOKEN:=}"

WINDOW_ID="${1:?Usage: poll-window.sh <window-id> [timeout-seconds]}"
TIMEOUT="${2:-10}"

_curl() {
  if [[ -n "$WIBWOB_TOKEN" ]]; then
    curl -sf -H "Authorization: Bearer $WIBWOB_TOKEN" "$@"
  else
    curl -sf "$@"
  fi
}

deadline=$(( $(date +%s) + TIMEOUT ))

while [[ $(date +%s) -lt $deadline ]]; do
  text=$(_curl -X POST -H "Content-Type: application/json" \
    -d "{\"id\":$WINDOW_ID}" "$WIBWOB_API/windows/text" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('text','') or '')" 2>/dev/null || true)

  if [[ -n "$text" ]]; then
    echo "$text"
    exit 0
  fi
  sleep 0.4
done

echo "ERROR: window $WINDOW_ID had no content after ${TIMEOUT}s" >&2
exit 1
