#!/usr/bin/env bash
# ensure-running.sh — Idempotent: make sure WibWob-DOS is alive.
#
# Handles ALL cases:
#   1. No tmux server      → create session + launch
#   2. No wibwob session   → create session + launch
#   3. Session exists, app dead → launch in existing session
#   4. Session exists, app alive → no-op, print status
#
# Usage:  bash scripts/ensure-running.sh [--cmd "bun run dev:world"]
#         bash scripts/ensure-running.sh --port 8098 --session wibwob-alt
#
# Safe for multiple agents/humans to call concurrently — the first wins,
# the rest see "already running" and exit 0.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Defaults
SESSION="${TMUX_SESSION:-wibwob}"
PORT="${CONTROL_API_PORT:-8099}"
CMD="${WIBWOB_CMD:-bun run dev:world}"
COLS="${TMUX_COLS:-205}"
ROWS="${TMUX_ROWS:-55}"
WINDOW=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cmd)     CMD="$2"; shift 2 ;;
    --port)    PORT="$2"; shift 2 ;;
    --session) SESSION="$2"; shift 2 ;;
    --cols)    COLS="$2"; shift 2 ;;
    --rows)    ROWS="$2"; shift 2 ;;
    *)         shift ;;
  esac
done

API="http://127.0.0.1:${PORT}"

# ── Check if already alive ──────────────────────────────────────────
health=$(curl -s --max-time 2 "${API}/health" 2>/dev/null || true)
if [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'; then
  id=$(echo "$health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
  echo "✓ already running  instance=$id  port=$PORT"
  exit 0
fi

# ── Ensure tmux session exists ──────────────────────────────────────
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "  creating tmux session: $SESSION (${COLS}x${ROWS})"
  tmux new-session -d -s "$SESSION" -x "$COLS" -y "$ROWS"
  sleep 0.5
fi

# ── Check if something is already starting on this port ─────────────
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "  port $PORT in use but API not responding — waiting..."
  for _ in $(seq 1 15); do
    sleep 1
    health=$(curl -s --max-time 2 "${API}/health" 2>/dev/null || true)
    if [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'; then
      id=$(echo "$health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
      echo "✓ came alive  instance=$id  port=$PORT"
      exit 0
    fi
  done
  echo "  port $PORT stuck — killing stale process"
  kill -9 "$(lsof -ti:"$PORT")" 2>/dev/null || true
  sleep 1
fi

# ── Reset terminal escape codes (in case of dirty exit) ─────────────
tmux send-keys -t "$SESSION:$WINDOW" \
  "printf '\\033[?1000l\\033[?1002l\\033[?1003l\\033[?1006l\\033[?25h\\033[0m'" Enter
sleep 0.3

# ── Launch ──────────────────────────────────────────────────────────
echo "  launching: $CMD"
tmux send-keys -t "$SESSION:$WINDOW" "cd $ROOT && $CMD" Enter

# ── Poll for API ────────────────────────────────────────────────────
echo -n "  waiting for API"
for _ in $(seq 1 30); do
  sleep 1
  health=$(curl -s --max-time 2 "${API}/health" 2>/dev/null || true)
  if [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'; then
    id=$(echo "$health" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "✓ started  instance=$id  port=$PORT  session=$SESSION"
    exit 0
  fi
  echo -n "."
done

echo ""
echo "✗ timed out waiting for API on port $PORT" >&2
echo "  check: tmux attach -t $SESSION" >&2
exit 1
