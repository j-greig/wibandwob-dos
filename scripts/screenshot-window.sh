#!/usr/bin/env bash
# screenshot-window.sh — TEXT crop of the live TUI to a single window's rect
#
# WARNING: This tool outputs plain text, NOT PNG/JPEG images.
# It is intended for semantic capture/debugging only.
#
# Usage:
#   ./scripts/screenshot-window.sh <id>           # by window id
#   ./scripts/screenshot-window.sh <title>        # by title substring (first match)
#
# Prints plain-text crop of the window. Small enough to paste into any context.
# Exit 1 if window not found or API unreachable.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"
API="$(ww_api_base)"
ARG="${1:-}"

if [[ -z "$ARG" ]]; then
  echo "Usage: $0 <window-id|title-substring>" >&2
  exit 1
fi

# Resolve window id
if [[ "$ARG" =~ ^[0-9]+$ ]]; then
  WIN_ID="$ARG"
else
  # Look up by title substring
  WIN_ID=$(curl -sf "$API/state" | python3 -c "
import sys, json
data = json.load(sys.stdin)
q = sys.argv[1].lower()
for w in data.get('windows', []):
    if q in w.get('title','').lower():
        print(w['id'])
        break
" "$ARG" 2>/dev/null || true)
  if [[ -z "$WIN_ID" ]]; then
    echo "No window matching: $ARG" >&2
    # List available windows as a hint
    curl -sf "$API/state" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('Available windows:')
for w in data.get('windows', []):
    print(f\"  {w['id']:3}  {w.get('title','?')}\")
" 2>/dev/null || true
    exit 1
  fi
fi

# Fetch the crop, strip any residual ANSI escape codes
curl -sf "$API/screenshot/text?id=$WIN_ID" \
  | sed 's/\x1b\[[0-9;]*[mK]//g'
