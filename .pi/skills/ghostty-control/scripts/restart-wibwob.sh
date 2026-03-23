#!/usr/bin/env bash
# Restart WibWob-DOS via Ghostty AppleScript — kill old process, relaunch, wait for health.
set -euo pipefail

TIMEOUT="${1:-15}"

# Kill the running instance
pid=$(wibwob ls 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['pid'])" 2>/dev/null || true)
if [[ -n "$pid" ]]; then
    kill -9 "$pid" 2>/dev/null || true
    echo "⏹  Killed PID $pid"
    sleep 2
fi

# Launch via Ghostty
osascript -e '
tell application "Ghostty"
    set t to focused terminal of selected tab of front window
    input text "bun run dev:world" to t
    send key "enter" to t
end tell' 2>/dev/null

echo "🚀 Launched — waiting for API..."

# Wait for health
elapsed=0
while (( elapsed < TIMEOUT )); do
    if wibwob health &>/dev/null; then
        echo "✅ Ready ($(wibwob health 2>&1 | awk '/^port:/{print "port="$2}'))"
        exit 0
    fi
    sleep 1
    (( elapsed++ ))
done

echo "❌ Timed out after ${TIMEOUT}s"
exit 1
