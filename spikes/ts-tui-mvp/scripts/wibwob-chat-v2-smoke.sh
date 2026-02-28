#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp"
SESSION="ts-tui-wibwob-chat-v2"
PORT="${CONTROL_API_PORT:-8115}"
STATE_FILE="$ROOT/scratch/app-state.json"
CAPTURE_DIR="$ROOT/scratch/captures"

mkdir -p "$CAPTURE_DIR"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" "cd '$ROOT' && CONTROL_API_PORT=$PORT bun run start"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "control API did not start on port $PORT" >&2
  tmux capture-pane -pt "$SESSION" || true
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:$PORT/view/wibwob-chat/open" >/dev/null
sleep 3
curl -fsS "http://127.0.0.1:$PORT/state" > "$STATE_FILE"

CHAT_ID="$(bun -e 'const fs=require("node:fs");const state=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const match=state.windows.find((w)=>w.appType==="wibwob-chat-v2");if(match){process.stdout.write(String(match.id));}' "$STATE_FILE")"

if [[ -z "$CHAT_ID" ]]; then
  echo "wibwob-chat-v2 window not found in state" >&2
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:$PORT/windows/input" \
  -H 'content-type: application/json' \
  -d "{\"id\":$CHAT_ID,\"input\":\"Say hello briefly and keep the task loop tiny.\\r\"}" >/dev/null

sleep 12

curl -fsS "http://127.0.0.1:$PORT/state" > "$STATE_FILE"
curl -fsS -X POST "http://127.0.0.1:$PORT/windows/text/export" \
  -H 'content-type: application/json' \
  -d "{\"id\":$CHAT_ID,\"name\":\"wibwob-chat-v2-smoke\"}" >/dev/null
tmux capture-pane -pt "$SESSION" > "$CAPTURE_DIR/wibwob-chat-v2-smoke-pane.txt"

echo "wibwob chat v2 smoke ok"
echo "state: $STATE_FILE"
echo "tmux capture: $CAPTURE_DIR/wibwob-chat-v2-smoke-pane.txt"
