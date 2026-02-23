#!/usr/bin/env bash
# dev-stop.sh — kill WibWobDOS TUI + API cleanly

set -euo pipefail
INSTANCE="${WIBWOB_INSTANCE:-1}"

tmux kill-session -t wibwob     2>/dev/null && echo "  stopped: TUI (wibwob)"     || echo "  not running: wibwob"
tmux kill-session -t wibwob-api 2>/dev/null && echo "  stopped: API (wibwob-api)" || echo "  not running: wibwob-api"
rm -f "/tmp/wibwob_${INSTANCE}.sock" && echo "  removed: /tmp/wibwob_${INSTANCE}.sock" || true
echo "done."
