#!/usr/bin/env bash
# @name    screenshot-window
# @desc    Text crop of a single window from the live TUI
#
# Usage:
#   ./scripts/screenshot-window.sh <id>           # by window id (preferred)
#   ./scripts/screenshot-window.sh <title>        # by title substring (first match)
#   ./scripts/screenshot-window.sh --list         # list all windows with ids
#
# Prints plain-text crop of the window to stdout.
# All errors and hints go to stderr. Exit 1 on failure.
#
# COAT note: prefer window id over title — ids are stable within a session,
# titles can change. Get ids from: curl /state, ./scripts/minimap.sh, or --list.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"
API="$(ww_api_base)"
ARG="${1:-}"

if [[ -z "$ARG" ]]; then
  echo "Usage: $0 <window-id|title-substring|--list>" >&2
  exit 1
fi

# --list mode: show all windows (to stderr so it's visible but not captured)
list_windows() {
  curl -sf "$API/state" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('Windows:')
for w in data.get('windows', []):
    t = w.get('title','?')
    a = w.get('appType','')
    print(f\"  {w['id']:3}  {t:40s} [{a}]\")
" 2>/dev/null || echo "  (API unreachable)" >&2
}

if [[ "$ARG" == "--list" ]]; then
  list_windows
  exit 0
fi

# Resolve window id
if [[ "$ARG" =~ ^[0-9]+$ ]]; then
  WIN_ID="$ARG"
else
  # Look up by title substring (case-insensitive, first match)
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
    echo "ERROR: No window matching '$ARG'" >&2
    list_windows >&2
    exit 1
  fi
fi

# Verify the window exists before fetching
EXISTS=$(curl -sf "$API/state" | python3 -c "
import sys, json
data = json.load(sys.stdin)
wid = int(sys.argv[1])
found = any(w['id'] == wid for w in data.get('windows', []))
print('yes' if found else 'no')
" "$WIN_ID" 2>/dev/null || echo "no")

if [[ "$EXISTS" != "yes" ]]; then
  echo "ERROR: Window id $WIN_ID does not exist" >&2
  list_windows >&2
  exit 1
fi

# Fetch the crop, strip any residual ANSI escape codes
RESULT=$(curl -sf "$API/screenshot/text?id=$WIN_ID" 2>/dev/null || true)

if [[ -z "$RESULT" ]]; then
  echo "ERROR: Empty response for window $WIN_ID (API may be down)" >&2
  exit 1
fi

echo "$RESULT" | sed 's/\x1b\[[0-9;]*[mK]//g'
