#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8099}"
CHANNEL_ID="${1:-}"

if [[ -z "$CHANNEL_ID" ]]; then
  echo "usage: $0 '#world-ridge-overlook'"
  echo "tip: curl -s \"$API_BASE/world-chat/channels\" | jq -r '.channels[].id'"
  exit 1
fi

while true; do
  clear
  date +"%Y-%m-%d %H:%M:%S"
  echo
  curl -fsS --get \
    --data-urlencode "id=$CHANNEL_ID" \
    "$API_BASE/world-chat/channel/text" || true
  sleep 1
done
