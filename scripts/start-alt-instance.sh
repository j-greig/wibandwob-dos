#!/usr/bin/env bash
# @name    start-alt-instance
# @desc    Launch second WibWob-DOS instance (port 8098, label=zuk)
# start-alt-instance.sh — launch a second WibWob-DOS instance.
#
# Modes:
#   --direct  (default) Background process with PTY, no tmux
#   --tmux              New tmux window in existing session
#
# Usage:
#   bash scripts/start-alt-instance.sh                   # direct mode
#   bash scripts/start-alt-instance.sh --tmux            # tmux window
#   CONTROL_API_PORT=8097 bash scripts/start-alt-instance.sh
#
# The alt instance uses SCRATCH_DIR=scratch/alt so its workspace and state
# files don't clobber the main instance's.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
source "$ROOT/scripts/lib/process-manager.sh"

# Alt-instance defaults (override process-manager defaults)
WW_PORT=${CONTROL_API_PORT:-8098}
WW_API="http://127.0.0.1:${WW_PORT}"
LABEL=${WIBWOB_INSTANCE_LABEL:-zuk}
SCRATCH=${SCRATCH_DIR:-scratch/alt}
WW_PID_FILE="$ROOT/$SCRATCH/wibwob.pid"
WW_LOG_FILE="$ROOT/$SCRATCH/wibwob.log"

ww_parse_mode "$@"

# Kill any stale process on the target port
OLD=$(lsof -ti:$WW_PORT 2>/dev/null || true)
if [ -n "$OLD" ]; then
  echo "Killing stale process on port $WW_PORT (pid $OLD)"
  kill -9 $OLD 2>/dev/null || true
  sleep 1
fi

CMD="WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667"
CMD="$CMD WIBWOB_INSTANCE_LABEL=$LABEL CONTROL_API_PORT=$WW_PORT SCRATCH_DIR=$SCRATCH"
CMD="$CMD bun run src/app.ts --dev"

if [[ "$WW_MODE" == "tmux" ]]; then
  # Legacy: require existing tmux session
  if ! tmux has-session -t wibwob 2>/dev/null; then
    echo "ERROR: tmux session 'wibwob' not found. Start the main instance first." >&2
    exit 1
  fi

  WIN=$(tmux new-window -t wibwob -n "$LABEL" -a -P -F '#{window_index}')
  echo "Opened tmux window $WIN"
  tmux send-keys -t wibwob:$WIN "$CMD" Enter
  echo "Alt instance launching (tmux window $WIN, port $WW_PORT, label $LABEL)"
else
  # Direct mode: background process with PTY
  mkdir -p "$ROOT/$SCRATCH"
  echo "Alt instance launching (direct mode, port $WW_PORT, label $LABEL)"
  echo "  log: $WW_LOG_FILE"

  COLUMNS="$WW_COLS" LINES="$WW_ROWS" \
    nohup script -q /dev/null bash -c "cd $ROOT && $CMD" \
    > "$WW_LOG_FILE" 2>&1 &
  disown $! 2>/dev/null || true
fi

echo "Waiting for API..."
for i in $(seq 1 20); do
  sleep 1
  health=$(curl -sf "http://127.0.0.1:$WW_PORT/health" 2>/dev/null || true)
  if [[ -n "$health" ]] && echo "$health" | grep -q '"ok":true'; then
    echo "✓ alt instance ready:"
    echo "  $health"
    echo "  port=$WW_PORT  label=$LABEL  scratch=$SCRATCH  mode=$WW_MODE"
    exit 0
  fi
done

echo "ERROR: alt instance did not respond on port $WW_PORT after 20s" >&2
exit 1
