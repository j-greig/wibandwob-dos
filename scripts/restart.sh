#!/usr/bin/env bash
# Restart WibWob-DOS without human involvement.
# Usage: bash scripts/restart.sh [--force] [tmux-window]
#        bash scripts/restart.sh --force 0    (default)
#        bash scripts/restart.sh alt          (second instance, port 8098)
#
# Safe pattern: capture old sessionId → stop process → reset terminal modes → tmux send-keys → poll /health.

set -euo pipefail

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
  shift
fi

WINDOW="${1:-0}"
SESSION="${TMUX_SESSION:-wibwob}"
PORT="${CONTROL_API_PORT:-8099}"
PID_FILE="${SCRATCH_DIR:-scratch}/wibwob.pid"
CMD="${WIBWOB_CMD:-bun run dev:world}"

is_port_alive() {
  lsof -ti:"$PORT" >/dev/null 2>&1
}

force_kill() {
  if is_port_alive; then
    echo "  SIGKILL → port $PORT"
    kill -9 "$(lsof -ti:"$PORT")" 2>/dev/null || true
  fi
  echo "  SIGKILL → pkill wibwob-dos"
  pkill -9 -f "wibwob-dos" 2>/dev/null || true
}

echo "▶ restart: session=$SESSION window=$WINDOW port=$PORT force=$FORCE"

OLD_SID=$(curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || true)

if [[ "$FORCE" -eq 1 ]]; then
  force_kill
  sleep 2
else
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "  SIGTERM → pid $PID"
    kill "$PID" 2>/dev/null || true
  elif is_port_alive; then
    echo "  SIGTERM → port $PORT"
    kill "$(lsof -ti:"$PORT")" 2>/dev/null || true
  else
    echo "  nothing running on port $PORT"
  fi

  for _ in $(seq 1 5); do
    is_port_alive || break
    sleep 1
  done

  if is_port_alive; then
    force_kill
    sleep 2
  fi
fi

tmux send-keys -t "$SESSION:$WINDOW" "printf '\\033[?1000l\\033[?1002l\\033[?1003l\\033[?1006l\\033[?25h\\033[0m'" Enter
sleep 0.5

echo "  launching '$CMD' in $SESSION:$WINDOW"
tmux send-keys -t "$SESSION:$WINDOW" "" C-c 2>/dev/null || true
sleep 0.5
tmux send-keys -t "$SESSION:$WINDOW" "$CMD" Enter

echo -n "  waiting for API"
for _ in $(seq 1 30); do
  sleep 1
  r=$(curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" 2>/dev/null || true)
  if [ -n "$r" ]; then
    NEW_SID=$(printf '%s' "$r" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || true)
    echo ""
    echo "  ready: $r"
    if [ -n "$OLD_SID" ] && [ -n "$NEW_SID" ] && [ "$OLD_SID" = "$NEW_SID" ]; then
      echo "  ⚠ sessionId unchanged — old process may still be running"
    fi
    exit 0
  fi
  echo -n "."
done

echo ""
echo "  ✗ timed out waiting for API on port $PORT" >&2
exit 1
