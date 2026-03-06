#!/usr/bin/env bash
# start-alt-instance.sh — launch a second WibWob-DOS instance in a new tmux window.
#
# Usage:
#   bash scripts/start-alt-instance.sh            # defaults: port 8098, label zuk
#   CONTROL_API_PORT=8097 bash scripts/start-alt-instance.sh
#
# The alt instance uses SCRATCH_DIR=scratch/alt so its workspace and state
# files don't clobber the main instance's. Directories are created automatically.
#
# Requires: tmux session "wibwob" already exists (main instance running in window 0).

set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${CONTROL_API_PORT:-8098}
LABEL=${WIBWOB_INSTANCE_LABEL:-zuk}
SCRATCH=${SCRATCH_DIR:-scratch/alt}

# Check session exists
if ! tmux has-session -t wibwob 2>/dev/null; then
  echo "ERROR: tmux session 'wibwob' not found. Start the main instance first." >&2
  exit 1
fi

# Kill any stale process on the target port
OLD=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$OLD" ]; then
  echo "Killing stale process on port $PORT (pid $OLD)"
  kill -9 $OLD 2>/dev/null || true
  sleep 1
fi

# Open a new tmux window and capture its index
WIN=$(tmux new-window -t wibwob -P -F '#{window_index}')
echo "Opened tmux window $WIN"

CMD="WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667"
CMD="$CMD WIBWOB_INSTANCE_LABEL=$LABEL CONTROL_API_PORT=$PORT SCRATCH_DIR=$SCRATCH"
CMD="$CMD bun run src/app.ts --dev"

tmux send-keys -t wibwob:$WIN "$CMD" Enter
echo "Alt instance launching (window $WIN, port $PORT, label $LABEL, scratch $SCRATCH)"
echo "Waiting for API..."

for i in $(seq 1 20); do
  sleep 1
  if curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    echo "Alt instance ready:"
    curl -s "http://127.0.0.1:$PORT/health"
    echo
    echo "tmux window: wibwob:$WIN"
    exit 0
  fi
done

echo "ERROR: alt instance did not respond on port $PORT after 20s" >&2
exit 1
