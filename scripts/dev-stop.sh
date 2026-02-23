#!/usr/bin/env bash
# dev-stop.sh — stop WibWobDOS TUI + API tmux sessions

set -euo pipefail

PORT=${WIBWOB_API_PORT:-8089}

tmux kill-session -t wibwob     2>/dev/null && echo "🛑  Killed TUI session"     || echo "   (wibwob not running)"
tmux kill-session -t wibwob-api 2>/dev/null && echo "🛑  Killed API session"     || echo "   (wibwob-api not running)"

# Kill anything still on the port
STALE=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$STALE" ]; then
  kill "$STALE" 2>/dev/null && echo "🧹  Killed stale process on :$PORT"
fi

echo "✅  Done"
