#!/usr/bin/env bash
# screenshot.sh — text screenshot of the full TUI or a single window
#
# Usage:
#   bash scripts/screenshot.sh              # full TUI (all windows)
#   bash scripts/screenshot.sh <window-id>  # single window crop
#   bash scripts/screenshot.sh <title>      # window by title substring
#
# Output: raw text to stdout (ANSI codes stripped)
# For a PNG image: use scripts/png.sh instead
# For structured state: use scripts/state.sh

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"
TOKEN="${WIBWOB_TOKEN:-}"

# Warn if token not set (protected endpoints)
if [[ -z "$TOKEN" ]]; then
  echo "warning: WIBWOB_TOKEN not set — requests may return 401. Run: eval \"\$(bash scripts/connect.sh)\"" >&2
fi

ARG="${1:-}"

if [[ -z "$ARG" ]]; then
  # Full TUI
  curl -sf --connect-timeout 8 \
    -H "Authorization: Bearer $TOKEN" \
    "$API/screenshot/text" || {
    echo "error: cannot reach $API — run: eval \"\$(bash scripts/connect.sh)\"" >&2
    exit 1
  }
  exit 0
fi

# Resolve by id or title
WIN_ID=$(curl -sf --connect-timeout 5 \
  -H "Authorization: Bearer $TOKEN" \
  "$API/state" | python3 -c "
import sys, json
d    = json.loads(sys.stdin.read())
arg  = sys.argv[1]
wins = d.get('windows', [])

# Try numeric id first
if arg.isdigit():
  ids = [str(w['id']) for w in wins]
  if arg in ids:
    print(arg)
    sys.exit(0)

# Try title substring
q = arg.lower()
for w in wins:
  if q in w.get('title', '').lower():
    print(w['id'])
    sys.exit(0)

print('NOT_FOUND')
" "$ARG" 2>/dev/null)

if [[ -z "$WIN_ID" || "$WIN_ID" == "NOT_FOUND" ]]; then
  echo "error: no window matching '$ARG'" >&2
  echo "open windows:" >&2
  curl -sf \
    -H "Authorization: Bearer $TOKEN" \
    "$API/state" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for w in d.get('windows', []):
  print(f\"  [{w['id']}] {w.get('title','?')}\")
" 2>/dev/null >&2
  exit 1
fi

curl -sf --connect-timeout 8 \
  -H "Authorization: Bearer $TOKEN" \
  "$API/screenshot/text?id=${WIN_ID}" || {
  echo "error: screenshot failed for window $WIN_ID" >&2
  exit 1
}
