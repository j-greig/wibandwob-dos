#!/bin/bash
# systemd entrypoint for WibWob-DOS on VPS.
# systemd is the supervisor; tmux is the interactive surface.
#
# Critical: tmux new-session -d exits immediately (code 0), which causes
# systemd Type=simple to see that exit and restart-loop. We block with
# tmux wait-for so systemd tracks the foreground process correctly.
#
# Usage: ExecStart=/opt/wibandwob-dos/scripts/start-tmux.sh
#        ExecStop=/usr/bin/tmux kill-session -t wibwob

set -e

APP_DIR="${APP_DIR:-/opt/wibandwob-dos}"
BUN="${BUN:-/usr/local/bin/bun}"
SESSION=wibwob
WIDTH=320
HEIGHT=79

# Source .env so capability profile + secrets are in the environment
set -a
[ -f "$APP_DIR/.env" ] && . "$APP_DIR/.env"
set +a

# Kill any stale session before starting fresh
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -x "$WIDTH" -y "$HEIGHT" \
  "exec $BUN run $APP_DIR/src/app.ts 2>>$APP_DIR/scratch/app-stderr.log"

echo "[start-tmux] session '$SESSION' started (${WIDTH}x${HEIGHT})"

# Block — keep foreground process alive so systemd tracks it
tmux wait-for "$SESSION"
