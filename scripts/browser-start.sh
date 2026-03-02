#!/usr/bin/env bash
# Start Chrome with remote debugging for the WibWob-DOS text browser.
# The Chrome Browser window connects via CDP on localhost:9222.
#
# Usage:
#   ./scripts/browser-start.sh            # headless (no visible window)
#   ./scripts/browser-start.sh --visible  # normal Chrome window
#
# To stop: kill the process or Ctrl-C.

set -euo pipefail

PORT=9222
VISIBLE=false

for arg in "$@"; do
  case "$arg" in
    --visible) VISIBLE=true ;;
    --port=*)  PORT="${arg#--port=}" ;;
    *)         echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# Find Chrome binary
if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome-stable &>/dev/null; then
  CHROME="google-chrome-stable"
elif command -v chromium &>/dev/null; then
  CHROME="chromium"
elif command -v chromium-browser &>/dev/null; then
  CHROME="chromium-browser"
else
  echo "Error: Chrome/Chromium not found."
  echo "Install Chrome or set the path manually in this script."
  exit 1
fi

# Check if already running on this port
if curl -s "http://localhost:${PORT}/json/version" &>/dev/null; then
  echo "Chrome already running on :${PORT}"
  curl -s "http://localhost:${PORT}/json/version" | python3 -c "import json,sys; v=json.load(sys.stdin); print(f\"  {v.get('Browser','?')}\")" 2>/dev/null || true
  exit 0
fi

ARGS=(
  "--remote-debugging-port=${PORT}"
  "--no-first-run"
  "--no-default-browser-check"
  "--disable-background-networking"
  "--disable-sync"
)

if [[ "$VISIBLE" == "false" ]]; then
  ARGS+=("--headless=new" "--disable-gpu")
  echo "Starting headless Chrome on :${PORT}..."
else
  echo "Starting Chrome on :${PORT} (visible window)..."
fi

exec "$CHROME" "${ARGS[@]}"
