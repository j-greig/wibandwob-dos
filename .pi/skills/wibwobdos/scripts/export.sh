#!/usr/bin/env bash
# export.sh — read a window's text content to stdout
#
# Usage:
#   bash scripts/export.sh <window-id>          # window text to stdout
#   bash scripts/export.sh <window-id> --save   # also saves to scratch/captures/
#   bash scripts/export.sh --full               # full TUI text screenshot
#
# Get window ids from: bash scripts/state.sh
#
# This is the right way to read what is in a window. Use it to:
#   - read agent chat history
#   - inspect text editor content
#   - capture a primer or art window
#   - check what a terminal window shows

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <window-id> [--save] | --full" >&2
  exit 1
fi

ARG="$1"
SAVE="${2:-}"

# ── Full TUI screenshot ───────────────────────────────────────────────────────

if [[ "$ARG" == "--full" ]]; then
  curl -sf --connect-timeout 8 "$API/screenshot/text" || {
    echo "error: cannot reach $API" >&2; exit 1
  }
  exit 0
fi

WIN_ID="$ARG"

# ── Window text ───────────────────────────────────────────────────────────────

RESP=$(curl -sf --connect-timeout 8 "$API/windows/text?id=${WIN_ID}") || {
  echo "error: cannot reach $API or window $WIN_ID not found" >&2
  exit 1
}

# /windows/text returns {"ok":true,"text":"..."} — extract the text field
TEXT=$(echo "$RESP" | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
  d = json.loads(raw)
  if isinstance(d, dict) and 'text' in d:
    print(d['text'], end='')
  else:
    print(raw, end='')
except Exception:
  print(raw, end='')
") || { echo "$RESP"; }

echo "$TEXT"

if [[ "${SAVE:-}" == "--save" ]]; then
  SAVE_PATH=$(curl -sf -X POST "$API/windows/text/export" \
    -H "Content-Type: application/json" \
    -d "{\"id\": ${WIN_ID}}" \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('path','(unknown)'))" 2>/dev/null \
    || echo "(save failed)")
  echo "" >&2
  echo "saved: $SAVE_PATH" >&2
fi
