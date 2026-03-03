#!/usr/bin/env bash
# fleet-test.sh — open all window kinds, cycle all themes, capture screenshots + text
#
# Usage: ./scripts/fleet-test.sh [port]
#   port: control API port (default 8099)
#
# Outputs:
#   scratch/captures/fleet-YYYY-MM-DD/
#     {theme}.png         — iTerm screenshot
#     {theme}.ansi        — blessed screenshot with ANSI codes
#     {theme}.txt         — plain text (ANSI stripped)
#     state-{theme}.json  — full desktop state

set -euo pipefail

PORT="${1:-8099}"
API="http://localhost:${PORT}"
DATE=$(date +%Y-%m-%d)
OUTDIR="scratch/captures/fleet-${DATE}"
mkdir -p "$OUTDIR"

# Check API is up
if ! curl -sf "$API/health" > /dev/null 2>&1; then
  echo "ERROR: control API not responding on port $PORT"
  exit 1
fi

echo "=== Fleet Test — $(date) ==="
echo "API: $API"
echo "Output: $OUTDIR"

# Open one of each window kind
CMDS=(
  "file.new_text_buffer"
  "figlet.open"
  "art.open"
  "pattern.open"
  "companion.open"
  "primer_gallery.open"
  "workspace.manage"
  "inspector.open"
  "palette.open"
  "backrooms_logs.open"
)

echo ""
echo "Opening windows..."
for cmd in "${CMDS[@]}"; do
  result=$(curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' -d "{\"id\":\"$cmd\"}" 2>&1 || echo '{"ok":false}')
  ok=$(echo "$result" | grep -o '"ok":true' || true)
  if [ -n "$ok" ]; then
    echo "  ✓ $cmd"
  else
    echo "  ✗ $cmd (may need args)"
  fi
done

sleep 0.5
curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' -d '{"id":"window.tile"}' > /dev/null
echo "  Tiled."

# Count windows
count=$(curl -sf "$API/state" | python3 -c "import sys,json; print(json.load(sys.stdin)['screen']['openWindowCount'])")
echo "  $count windows open"

# Cycle all themes and capture each
THEMES=("dark" "dark-nord" "dark-pastel" "phosphor" "light")

echo ""
echo "Capturing ${#THEMES[@]} themes..."
for t in "${THEMES[@]}"; do
  # Save state
  curl -sf "$API/state" > "$OUTDIR/state-${t}.json"
  
  # Text captures
  curl -sf "$API/screenshot/text" > "$OUTDIR/${t}.ansi"
  sed 's/\x1b\[[0-9;]*m//g' "$OUTDIR/${t}.ansi" > "$OUTDIR/${t}.txt"
  
  # PNG screenshot (macOS only, needs iTerm window ID)
  if command -v screencapture &> /dev/null; then
    screencapture -l 899 "$OUTDIR/${t}.png" 2>/dev/null || true
  fi
  
  echo "  ✓ $t"
  
  # Toggle to next theme
  curl -sf -X POST "$API/commands/run" -H 'Content-Type: application/json' -d '{"id":"theme.cycle"}' > /dev/null
  sleep 0.3
done

# Final summary
echo ""
echo "Captures:"
ls -la "$OUTDIR/" | tail -n +2
echo ""
echo "=== Done ==="
