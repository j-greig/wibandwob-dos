#!/usr/bin/env bash
# open-chat.sh — open W&W chat window and self-prompt via REST API
# Usage: ./scripts/open-chat.sh [api_port]

set -euo pipefail
API="http://127.0.0.1:${1:-8089}"

echo "⏳ Health check..."
curl -sf "$API/health" > /dev/null || { echo "❌ API not running at $API"; exit 1; }
echo "   ✅ API alive"

echo ""
echo "🪟 Opening W&W chat window..."
OPEN=$(curl -s "$API/windows" -X POST -H "Content-Type: application/json" \
  -d '{"type":"wibwob"}')
echo "   $OPEN"
WIN_ID=$(echo "$OPEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
if [ -n "$WIN_ID" ]; then
  echo "   Focusing window $WIN_ID..."
  curl -s "$API/windows/$WIN_ID/focus" -X POST > /dev/null
fi

echo ""
echo "⏳ Waiting for W&W to greet..."
sleep 4

echo ""
echo "💬 Self-prompting W&W..."
curl -s "$API/menu/command" -X POST -H "Content-Type: application/json" \
  -d '{"command":"wibwob_ask","args":{"text":"hello wib and wob, confirm you are alive in one sentence"}}' \
  | python3 -m json.tool 2>/dev/null || true

echo ""
echo "⏳ Waiting for response..."
sleep 8

echo ""
echo "📋 Chat history:"
curl -s "$API/menu/command" -X POST -H "Content-Type: application/json" \
  -d '{"command":"get_chat_history"}' \
  | python3 -c "
import sys, json
obj = json.load(sys.stdin)
msgs = obj.get('messages', [])
print(f'  {len(msgs)} messages')
for m in msgs:
    print(f\"  {m['role']:12} | {m['content'][:80]}\")
"

echo ""
echo "🖥  TUI:"
tmux capture-pane -t wibwob -p 2>/dev/null | grep -v "^▒\+$" | tail -20 || echo "  (attach tmux to see TUI)"
