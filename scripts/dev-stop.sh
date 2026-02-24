#!/usr/bin/env bash
# dev-stop.sh — kill WibWobDOS TUI + API cleanly
#
# If the wibwob tmux session has monitor panes attached (pane count > 1),
# only the TUI process is killed — the session and monitor layout survive.
# If it's a bare single-pane session, the whole session is killed as before.

set -euo pipefail
INSTANCE="${WIBWOB_INSTANCE:-1}"

# ── TUI ───────────────────────────────────────────────────────────────────────
if tmux has-session -t wibwob 2>/dev/null; then
  PANE_COUNT=$(tmux list-panes -t wibwob:0 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PANE_COUNT" -gt 1 ]; then
    # Monitor is attached — kill only the TUI process, keep session alive
    pkill -f "test_pattern" 2>/dev/null && echo "  stopped: TUI process (monitor layout preserved)" || echo "  TUI process not found"
  else
    # Bare session — kill it entirely
    tmux kill-session -t wibwob 2>/dev/null && echo "  stopped: TUI (wibwob)" || true
  fi
else
  echo "  not running: wibwob"
fi

# ── API ───────────────────────────────────────────────────────────────────────
tmux kill-session -t wibwob-api 2>/dev/null && echo "  stopped: API (wibwob-api)" || echo "  not running: wibwob-api"

# ── Socket ────────────────────────────────────────────────────────────────────
rm -f "/tmp/wibwob_${INSTANCE}.sock" && echo "  removed: /tmp/wibwob_${INSTANCE}.sock" || true
echo "done."
