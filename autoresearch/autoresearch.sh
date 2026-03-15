#!/bin/bash
set -euo pipefail

SCREENSHOT_PATH="scratch/autoresearch-screenshot.png"

cd "$(dirname "$0")/.."

# ── 1. Restart the app in tmux ───────────────────────────────────────
tmux resize-window -t journal -x 169 -y 44 2>/dev/null || true

# Kill existing, relaunch
PID=$(cat scratch/wibwob.pid 2>/dev/null) && kill "$PID" 2>/dev/null || true
sleep 2

# Clean stale sockets
for s in scratch/instances/*.sock; do
  curl -s --max-time 1 --unix-socket "$s" http://localhost/health >/dev/null 2>&1 || rm -f "$s"
done

tmux send-keys -t journal "bun run start" Enter
sleep 5

# ── 2. Find live socket ─────────────────────────────────────────────
SOCK=""
for s in scratch/instances/*.sock; do
  if curl -s --max-time 1 --unix-socket "$s" http://localhost/health >/dev/null 2>&1; then
    SOCK="$s"
    break
  fi
done

if [ -z "$SOCK" ]; then
  echo "ERROR: API not healthy after restart"
  exit 1
fi

# ── 3. Open the journal window ──────────────────────────────────────
curl -s --unix-socket "$SOCK" -X POST http://localhost/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' > /dev/null 2>&1 || true

sleep 2

# ── 4. Capture screenshot via macOS screencapture ────────────────────
mkdir -p "$(dirname "$SCREENSHOT_PATH")" scratch/autoresearch-shots

# Use tmux capture-pane as text fallback, plus try screencapture
# Find the terminal window ID for the journal tmux session
WINID=$(osascript -e '
tell application "System Events"
  set termWins to every window of every process whose name contains "Ghostty" or name contains "Terminal" or name contains "iTerm"
end tell
' 2>/dev/null || echo "")

# Simple: just use screencapture on the whole screen and crop later
screencapture -x -C "$SCREENSHOT_PATH" 2>/dev/null || {
  # Fallback: capture tmux text
  tmux capture-pane -t journal -p > "${SCREENSHOT_PATH%.png}.txt"
  echo "WARNING: screencapture failed, text fallback at ${SCREENSHOT_PATH%.png}.txt"
}

# ── 5. Archive ───────────────────────────────────────────────────────
SHOTS_DIR="scratch/autoresearch-shots"
NEXT_NUM=$(printf "%03d" "$(( $(ls "$SHOTS_DIR"/*.png 2>/dev/null | wc -l) + 1 ))")
STAMP=$(date +%H%M%S)
cp "$SCREENSHOT_PATH" "$SHOTS_DIR/${NEXT_NUM}-${STAMP}.png" 2>/dev/null || true

echo "Screenshot saved to $SCREENSHOT_PATH"
echo "Agent should Read this file and score against the rubric."
