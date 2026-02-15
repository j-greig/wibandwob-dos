#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)/logs/agent-mailbox}"
POLL="${MAILBOXD_POLL_INTERVAL:-0.5}"
STATE_DIR="$ROOT/daemon"
PID_FILE="$STATE_DIR/mailboxd.pid"
LOG_FILE="$STATE_DIR/mailboxd.log"

mkdir -p "$STATE_DIR"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE" || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "mailboxd already running (pid=$pid)"
    exit 0
  fi
fi

python3 "$(dirname "$0")/agent_mailboxd.py" --root "$ROOT" --poll-interval "$POLL" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "started mailboxd pid=$(cat "$PID_FILE") root=$ROOT"
