#!/usr/bin/env bash
# Restart WibWob-DOS without human involvement.
# Usage: bash scripts/restart.sh [tmux-window]
#        bash scripts/restart.sh 0          (default)
#        bash scripts/restart.sh alt        (second instance, port 8098)
#
# Safe pattern: SIGTERM via PID file → wait for clean exit → tmux send-keys → poll /health.

set -euo pipefail

WINDOW="${1:-0}"
SESSION="${TMUX_SESSION:-wibwob}"
PORT="${CONTROL_API_PORT:-8099}"
PID_FILE="${SCRATCH_DIR:-scratch}/wibwob.pid"
CMD="${WIBWOB_CMD:-bun run dev:world}"

echo "▶ restart: session=$SESSION window=$WINDOW port=$PORT"

# 1. SIGTERM the running instance via PID file (preferred) or port
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  echo "  SIGTERM → pid $PID"
  kill "$PID" 2>/dev/null || true
elif lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "  SIGTERM → port $PORT"
  kill "$(lsof -ti:"$PORT")" 2>/dev/null || true
else
  echo "  nothing running on port $PORT"
fi

# 2. Wait for clean exit (up to 8s)
for i in $(seq 1 8); do
  lsof -ti:"$PORT" >/dev/null 2>&1 || break
  sleep 1
done

# 3. Launch in tmux window
echo "  launching '$CMD' in $SESSION:$WINDOW"
tmux send-keys -t "$SESSION:$WINDOW" "" C-c 2>/dev/null || true  # cancel any hanging prompt
sleep 0.5
tmux send-keys -t "$SESSION:$WINDOW" "$CMD" Enter

# 4. Poll /health until ready (up to 30s)
echo -n "  waiting for API"
for i in $(seq 1 30); do
  sleep 1
  r=$(curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" 2>/dev/null || true)
  if [ -n "$r" ]; then
    echo ""
    echo "  ready: $r"
    exit 0
  fi
  echo -n "."
done

echo ""
echo "  ✗ timed out waiting for API on port $PORT" >&2
exit 1
