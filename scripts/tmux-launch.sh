#!/bin/bash
# tmux-launch.sh — clean launch of wwdos + API in tmux
# Usage: ./scripts/tmux-launch.sh [session-name]
# Default session: wibwob

set -e
SESSION="${1:-wibwob}"
INSTANCE="${SESSION}"
SOCK="/tmp/wibwob_${INSTANCE}.sock"
PORT="${WIBWOB_PORT:-8090}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Cleaning up..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
tmux kill-session -t "$SESSION" 2>/dev/null || true
rm -f "$SOCK"
sleep 1

echo "Launching tmux session '$SESSION' (socket: $SOCK, API port: $PORT)"
tmux new-session -d -s "$SESSION" -x 200 -y 55
tmux send-keys -t "${SESSION}:0" "cd ${DIR} && WIBWOB_INSTANCE=${INSTANCE} ./build/app/wwdos 2>/tmp/wibwob_debug_${INSTANCE}.log" Enter

echo "Waiting for socket..."
for i in $(seq 1 15); do
  [ -S "$SOCK" ] && break
  sleep 1
done

if [ ! -S "$SOCK" ]; then
  echo "ERROR: socket $SOCK not found after 15s"
  exit 1
fi

echo "Starting API on :${PORT}..."
cd "$DIR"
WIBWOB_INSTANCE="$INSTANCE" tools/api_server/venv/bin/uvicorn tools.api_server.main:app \
  --host 127.0.0.1 --port "$PORT" &>/tmp/api_${INSTANCE}.log &

sleep 3
if curl -sf "http://127.0.0.1:${PORT}/state" > /dev/null 2>&1; then
  echo "Ready. Attach with: tmux attach -t ${SESSION}"
else
  echo "WARNING: API not responding on :${PORT}"
fi
