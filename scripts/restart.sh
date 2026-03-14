#!/usr/bin/env bash
# @name    restart
# @desc    Stop → relaunch → verify new instance (delegates to ensure-running if no tmux)
# Restart WibWob-DOS without human involvement.
#
# Usage: bash scripts/restart.sh [--force]
#
# Handles:
#   - No tmux server → delegates to ensure-running.sh
#   - No tmux session → delegates to ensure-running.sh
#   - App running → SIGTERM → wait → relaunch → poll /health
#   - Stuck process → SIGKILL fallback
#
# Safe pattern: capture old instanceId → stop → reset terminal → launch → verify new id.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
API="http://127.0.0.1:${PORT}"

# ── If no tmux session, delegate to ensure-running ──────────────────
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "▶ no tmux session '$SESSION' — delegating to ensure-running.sh"
  exec bash "$ROOT/scripts/ensure-running.sh" --cmd "$CMD" --port "$PORT" --session "$SESSION"
fi

is_port_alive() {
  lsof -ti:"$PORT" >/dev/null 2>&1
}

force_kill() {
  if is_port_alive; then
    echo "  SIGKILL → port $PORT"
    kill -9 "$(lsof -ti:"$PORT")" 2>/dev/null || true
  fi
  pkill -9 -f "wibwob-dos" 2>/dev/null || true
}

echo "▶ restart: session=$SESSION window=$WINDOW port=$PORT force=$FORCE"

# ── Capture old instance id ─────────────────────────────────────────
OLD_ID=$(curl -s --max-time 2 "${API}/health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4 || true)

# ── Stop the running process ────────────────────────────────────────
if [[ "$FORCE" -eq 1 ]]; then
  force_kill
  sleep 2
else
  if [ -f "$ROOT/$PID_FILE" ]; then
    PID=$(cat "$ROOT/$PID_FILE")
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
    echo "  still alive after SIGTERM — escalating to SIGKILL"
    force_kill
    sleep 2
  fi
fi

# ── Reset terminal escape codes ────────────────────────────────────
tmux send-keys -t "$SESSION:$WINDOW" \
  "printf '\\033[?1000l\\033[?1002l\\033[?1003l\\033[?1006l\\033[?25h\\033[0m'" Enter
sleep 0.5

# ── Relaunch ────────────────────────────────────────────────────────
echo "  launching '$CMD' in $SESSION:$WINDOW"
tmux send-keys -t "$SESSION:$WINDOW" "" C-c 2>/dev/null || true
sleep 0.5
tmux send-keys -t "$SESSION:$WINDOW" "cd $ROOT && $CMD" Enter

# ── Poll for new API ────────────────────────────────────────────────
echo -n "  waiting for API"
for _ in $(seq 1 30); do
  sleep 1
  r=$(curl -s --max-time 2 "${API}/health" 2>/dev/null || true)
  if [ -n "$r" ] && echo "$r" | grep -q '"ok":true'; then
    NEW_ID=$(printf '%s' "$r" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4 || true)
    echo ""
    echo "  ✓ ready: $r"
    if [ -n "$OLD_ID" ] && [ -n "$NEW_ID" ] && [ "$OLD_ID" = "$NEW_ID" ]; then
      echo "  ⚠ instanceId unchanged — old process may still be running"
    fi
    exit 0
  fi
  echo -n "."
done

echo ""
echo "  ✗ timed out waiting for API on port $PORT" >&2
exit 1
