#!/usr/bin/env bash
# monitor.sh — set up 4-pane WibWobDOS monitor in the wibwob tmux session
#
# Layout:
#   LEFT (big)        — TUI (already running in wibwob:0.0)
#   TOP RIGHT         — live tail of latest chat session log
#   MIDDLE RIGHT      — live tail of app debug log (/tmp/wibwob_debug.log)
#   BOTTOM RIGHT      — command pane (yours to use)
#
# Usage:
#   ./scripts/monitor.sh           # attach straight after
#   ./scripts/monitor.sh --no-attach
#
# Requires: dev-start.sh already run, wibwob tmux session exists

set -euo pipefail

SESSION="wibwob"
WINDOW=0
API="${WIBWOB_API:-http://127.0.0.1:8089}"
REPO_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

# ── guards ────────────────────────────────────────────────────────────────────
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "❌  No tmux session '$SESSION' found. Run ./scripts/dev-start.sh first."
  exit 1
fi

if ! curl -sf "$API/health" >/dev/null 2>&1; then
  echo "❌  API not healthy at $API. Run ./scripts/dev-start.sh first."
  exit 1
fi

# ── tear down any existing right-side panes (keep pane 0 = TUI) ───────────────
PANE_COUNT=$(tmux list-panes -t "$SESSION:$WINDOW" | wc -l | tr -d ' ')
if [ "$PANE_COUNT" -gt 1 ]; then
  echo "ℹ️   Removing $((PANE_COUNT - 1)) existing pane(s) from window $WINDOW..."
  # kill panes 1..N (iterate in reverse so indices stay valid)
  for i in $(seq $((PANE_COUNT - 1)) -1 1); do
    tmux kill-pane -t "$SESSION:$WINDOW.$i" 2>/dev/null || true
  done
fi

# ── find latest chat log ──────────────────────────────────────────────────────
CHATLOG=$(ls "$REPO_DIR"/logs/chat_*.log 2>/dev/null | tail -1 || true)
if [ -z "$CHATLOG" ]; then
  echo "⚠️   No chat log found yet — top-right pane will wait for first session."
  CHAT_CMD="echo 'Waiting for first chat session...' && until ls $REPO_DIR/logs/chat_*.log 2>/dev/null | tail -1 | grep -q .; do sleep 1; done && tail -f \$(ls $REPO_DIR/logs/chat_*.log | tail -1)"
else
  CHAT_CMD="echo '── CHAT LOG: $(basename "$CHATLOG") ──' && tail -f '$CHATLOG'"
fi

# ── build layout ─────────────────────────────────────────────────────────────
# Split right column off TUI pane
tmux split-window -t "$SESSION:$WINDOW.0" -h -l 48 -c "$REPO_DIR"

# Split right column into 3 rows
tmux split-window -t "$SESSION:$WINDOW.1" -v -c "$REPO_DIR"
tmux split-window -t "$SESSION:$WINDOW.2" -v -c "$REPO_DIR"

# ── start log tails ───────────────────────────────────────────────────────────
tmux send-keys -t "$SESSION:$WINDOW.1" "$CHAT_CMD" Enter
tmux send-keys -t "$SESSION:$WINDOW.2" "echo '── APP DEBUG ──' && tail -f /tmp/wibwob_debug.log" Enter
tmux send-keys -t "$SESSION:$WINDOW.3" "echo '── COMMANDS (API: $API) ──'" Enter

# Focus command pane
tmux select-pane -t "$SESSION:$WINDOW.3"

echo ""
echo "✅  Monitor layout ready:"
echo "   Pane 0 (left)         — TUI"
echo "   Pane 1 (top-right)    — chat log: $(basename "${CHATLOG:-pending}")"
echo "   Pane 2 (middle-right) — /tmp/wibwob_debug.log"
echo "   Pane 3 (bottom-right) — commands"
echo ""
echo "   Ctrl-B 0  switch window | Ctrl-B ←→  navigate panes"
echo ""

if [[ "${1:-}" != "--no-attach" ]]; then
  tmux attach -t "$SESSION:$WINDOW"
fi
