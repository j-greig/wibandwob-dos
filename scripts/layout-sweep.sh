#!/usr/bin/env bash
# layout-sweep.sh — resize a module window through breakpoints and dump layout report at each.
#
# Usage:
#   ./scripts/layout-sweep.sh <command-id> [port]
#   ./scripts/layout-sweep.sh microapp.wibwob.example.hello.open
#   ./scripts/layout-sweep.sh microapp.wibwob.example.hello.open 8098
#
# Outputs a diff-able text log to stdout. Pipe to a file for regression checks:
#   ./scripts/layout-sweep.sh microapp.wibwob.example.hello.open > scratch/layout-sweep.log

set -euo pipefail

CMD="${1:?Usage: layout-sweep.sh <command-id> [port]}"
PORT="${2:-8099}"
API="http://127.0.0.1:$PORT"

# Breakpoints: edges of each responsive mode (width x height)
BREAKPOINTS=(
  "35x10"   # S
  "39x11"   # S edge
  "40x12"   # M threshold
  "50x16"   # M mid
  "64x17"   # M edge
  "65x18"   # L threshold
  "80x22"   # L mid
  "94x25"   # L edge
  "95x26"   # XL threshold
  "120x35"  # XL mid
  "160x42"  # XL large
)

# Open the module
RESULT=$(curl -sf -X POST "$API/commands/run" -H "Content-Type: application/json" -d "{\"command\":\"$CMD\"}")
if ! echo "$RESULT" | python3 -c "import sys,json; assert json.load(sys.stdin).get('ok')" 2>/dev/null; then
  echo "Failed to open: $RESULT" >&2
  exit 1
fi
sleep 1

# Find window id
WIN_ID=$(curl -sf "$API/state" | python3 -c "
import sys, json
windows = json.load(sys.stdin)['windows']
if windows:
    print(windows[-1]['id'])
else:
    print('')
")

if [[ -z "$WIN_ID" ]]; then
  echo "No window found after opening $CMD" >&2
  exit 1
fi

echo "# Layout Sweep: $CMD (window $WIN_ID)"
echo "# $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

for BP in "${BREAKPOINTS[@]}"; do
  W="${BP%x*}"
  H="${BP#*x}"

  curl -sf -X POST "$API/windows/resize" \
    -H "Content-Type: application/json" \
    -d "{\"id\":$WIN_ID,\"width\":$W,\"height\":$H}" >/dev/null

  sleep 0.5

  echo "## ${W}x${H}"

  # Extract layout report from window state
  curl -sf "$API/state" | python3 -c "
import sys, json
state = json.load(sys.stdin)
win = next((w for w in state['windows'] if w['id'] == $WIN_ID), None)
if not win:
    print('  WINDOW NOT FOUND')
    sys.exit(0)
details = win.get('details', {})
mode = details.get('mode', '?')
report = details.get('layoutReport', {})
regions = report.get('regions', {})
print(f'  mode: {mode}  viewport: {report.get(\"viewport\", {})}')
for name, info in sorted(regions.items()):
    vis = 'VISIBLE' if info.get('visible') else 'hidden'
    rect = info.get('rect', {})
    collapsed = ' COLLAPSED' if info.get('collapsed') else ''
    r = f'{rect.get(\"width\",0)}x{rect.get(\"height\",0)}@{rect.get(\"left\",0)},{rect.get(\"top\",0)}'
    print(f'  {name:10s} {vis:7s} {r:16s}{collapsed}')
"
  echo ""
done

# Clean up
curl -sf -X POST "$API/windows/close" \
  -H "Content-Type: application/json" \
  -d "{\"id\":$WIN_ID}" >/dev/null 2>&1 || true

echo "# Done"
