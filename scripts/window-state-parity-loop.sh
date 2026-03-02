#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp"
SESSION="ts-tui-parity-loop"
PORT="${CONTROL_API_PORT:-8114}"
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

curl -fsS -X POST "http://127.0.0.1:$PORT/view/primer-browser/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/primer-gallery/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/browser-reader/open" \
  -H 'content-type: application/json' \
  -d '{"filePath":"/Users/james/Repos/wibandwob-dos/README.md"}' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/figlet/open" \
  -H 'content-type: application/json' \
  -d '{"text":"WIB WOB"}' >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/art/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/chat/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/wibwob-chat/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/workspace/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/palette/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/inspector/open" >/dev/null
curl -fsS -X POST "http://127.0.0.1:$PORT/view/editor/open" \
  -H 'content-type: application/json' \
  -d '{"title":"parity.txt","initial":"hello parity"}' >/dev/null

sleep 2

curl -fsS "http://127.0.0.1:$PORT/state" > "$STATE_FILE"
tmux capture-pane -pt "$SESSION" > "$CAPTURE_DIR/window-state-parity-loop.txt"

for expected in \
  primer-browser \
  primer-gallery \
  reader-viewer \
  figlet-banner \
  generative-art \
  chat-transcript \
  wibwob-chat-v2 \
  workspace-manager \
  command-palette \
  state-inspector \
  text-editor
do
  if ! grep -Eq "\"appType\"[[:space:]]*:[[:space:]]*\"$expected\"" "$STATE_FILE"; then
    echo "missing appType: $expected" >&2
    exit 1
  fi
done

echo "parity loop ok"
echo "state: $STATE_FILE"
echo "capture: $CAPTURE_DIR/window-state-parity-loop.txt"
