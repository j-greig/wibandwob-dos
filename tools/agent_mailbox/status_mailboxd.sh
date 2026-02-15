#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)/logs/agent-mailbox}"
PID_FILE="$ROOT/daemon/mailboxd.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "mailboxd: stopped"
  exit 1
fi

pid=$(cat "$PID_FILE" || true)
if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
  echo "mailboxd: running pid=$pid"
  exit 0
fi

echo "mailboxd: stale pid file"
exit 1
