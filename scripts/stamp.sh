#!/usr/bin/env bash
# stamp.sh — fire a gallery/arrange stamp call, snap the result, print stats
#
# Usage:
#   ./scripts/stamp.sh <label> <primer> <pattern> [options-json]
#
# Examples:
#   ./scripts/stamp.sh wib-cats     cat-cat-simple.txt  text   '{"text":"WIB"}'
#   ./scripts/stamp.sh grid-jelly   jellyfish.txt       grid   '{"cols":9,"rows":4}'
#   ./scripts/stamp.sh wave-chaos   chaos.txt           wave   '{"cols":20}'
#   ./scripts/stamp.sh spiral-disco recursive-disco-cat.txt spiral '{"cols":28}'
#   ./scripts/stamp.sh border-herb  mini-herbivore.txt  border '{}'
#   ./scripts/stamp.sh cross-cube   iso-cube-cornered.txt cross '{}'
#
# For complex nested JSON in opts, use the Python driver pattern (see stamp-explorations.md)
# Simple string values with no apostrophes work fine here.
#
# Override padding / margin / anchor via env:
#   PAD=0 MARGIN=2 ANCHOR=tl ./scripts/stamp.sh ...

set -euo pipefail
API="${API_URL:-http://127.0.0.1:8089}"
LABEL="${1:-test}"
PRIMER="${2:-cat-cat-simple.txt}"
PATTERN="${3:-text}"
EXTRA_OPTS="${4:-{}}"
PAD="${PAD:-1}"
MARGIN="${MARGIN:-4}"
ANCHOR="${ANCHOR:-center}"

# Merge extra opts with anchor
OPTS=$(python3 -c "
import json, sys
base = {'anchor': '$ANCHOR'}
extra = json.loads('$EXTRA_OPTS')
base.update(extra)
base['pattern'] = '$PATTERN'
print(json.dumps(base))
")

PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'filenames': ['$PRIMER'],
  'algorithm': 'stamp',
  'padding': $PAD,
  'margin': $MARGIN,
  'options': $OPTS
}))
")

# Close all, arrange, snap
curl -s -X POST "$API/windows/close_all" > /dev/null
sleep 0.4

RESULT=$(curl -s -X POST "$API/gallery/arrange" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

STATS=$(echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
n=len(d['arrangement'])
ov=d['overlaps']
oob=d['out_of_bounds']
util=d['canvas_utilization']
print(f'placed={n}  overlaps={ov}  oob={oob}  util={util}')
")
echo "▶ [$LABEL]  primer=$PRIMER  pattern=$PATTERN  pad=$PAD  margin=$MARGIN  anchor=$ANCHOR"
echo "  $STATS"

sleep 0.4
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAP=$("$SCRIPT_DIR/snap.sh" "stamp-$LABEL" 2>&1 | grep "TUI txt" | awk '{print $NF}')
echo "  snap → $SNAP"

# Emit a reproducible curl one-liner for the docs
echo ""
echo "  # reproduce:"
echo "  curl -s -X POST $API/gallery/arrange -H 'Content-Type: application/json' -d '$PAYLOAD'"
echo ""
