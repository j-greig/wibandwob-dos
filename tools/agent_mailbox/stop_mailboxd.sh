#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)/logs/agent-mailbox}"
PID_FILE="$ROOT/daemon/mailboxd.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "mailboxd not running (no pid file)"
  exit 0
fi

pid=$(cat "$PID_FILE" || true)
if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid" || true
  sleep 0.2
fi

rm -f "$PID_FILE"
echo "stopped mailboxd"
