#!/usr/bin/env bash
# send.sh — send text or a message to a WibWob-DOS window
#
# Two modes:
#
#   Keyboard input (default) — simulates typing + Enter
#     bash scripts/send.sh <window-id> "hello world"
#
#   Agent message — appears as a named sender in agent/chat windows
#     bash scripts/send.sh <window-id> "hello world" --agent my-agent-name
#
# Get window ids from: bash scripts/state.sh
#
# Notes:
# - Trailing \r is appended automatically (submits the input)
# - For multi-line input, use separate calls or include literal \n
# - Agent windows accept --agent; regular windows use keyboard input

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"
TOKEN="${WIBWOB_TOKEN:-}"

# Warn if token not set (protected endpoints)
if [[ -z "$TOKEN" ]]; then
  echo "warning: WIBWOB_TOKEN not set — requests may return 401. Run: eval \"\$(bash scripts/connect.sh)\"" >&2
fi

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <window-id> <text> [--agent <sender-name>]" >&2
  exit 1
fi

WIN_ID="$1"
TEXT="$2"
AGENT_NAME=""

shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT_NAME="${2:-wibwob}"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Validate window id exists ─────────────────────────────────────────────────

STATE=$(curl -sf --connect-timeout 5 \
  -H "Authorization: Bearer $TOKEN" \
  "$API/state") || {
  echo "error: cannot reach $API" >&2; exit 1
}

WIN_EXISTS=$(echo "$STATE" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
ids = [str(w['id']) for w in d.get('windows', [])]
print('yes' if sys.argv[1] in ids else 'no')
" "$WIN_ID")

if [[ "$WIN_EXISTS" != "yes" ]]; then
  echo "error: window $WIN_ID not found" >&2
  echo "open windows:" >&2
  echo "$STATE" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for w in d.get('windows', []):
  print(f\"  [{w['id']}] {w.get('title','?')}\")
" >&2
  exit 1
fi

# ── Send ──────────────────────────────────────────────────────────────────────

if [[ -n "$AGENT_NAME" ]]; then
  # Agent message — shows up as named sender in agent/chat windows
  PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({'id': int(sys.argv[1]) if sys.argv[1].isdigit() else sys.argv[1],
                  'text': sys.argv[2],
                  'sender': sys.argv[3]}))
" "$WIN_ID" "$TEXT" "$AGENT_NAME")

  curl -sf -X POST "$API/windows/agent-message" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
  echo "sent agent-message to window $WIN_ID as '$AGENT_NAME'"
else
  # Keyboard input — simulates typing + Enter
  PAYLOAD=$(python3 -c "
import json, sys
win = int(sys.argv[1]) if sys.argv[1].isdigit() else sys.argv[1]
print(json.dumps({'id': win, 'input': sys.argv[2] + '\r'}))
" "$WIN_ID" "$TEXT")

  curl -sf -X POST "$API/windows/input" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
  echo "sent input to window $WIN_ID"
fi
