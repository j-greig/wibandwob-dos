#!/usr/bin/env bash
# snap.sh — one command that captures TUI txt + JSON + SVG and prints a summary.
#
# Usage:
#   ./scripts/snap.sh                       # auto-named by timestamp
#   ./scripts/snap.sh test-01-single-window # named stem
#
# After running, opens the SVG in your browser and prints the JSON table.
# Designed to be run after every arrangement test so a human can verify.

set -euo pipefail

PORT=${WIBWOB_API_PORT:-8089}
STEM="${1:-$(date +%Y%m%d_%H%M%S)}"
OUT="logs/snapshots"
mkdir -p "$OUT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " SNAP: $STEM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. TUI screenshot (txt)
TXT_PATH=$(curl -s -X POST "http://127.0.0.1:$PORT/screenshot" \
  -H "Content-Type: application/json" -d "{}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['path'])")
echo "📸 TUI txt → $TXT_PATH"

# 2. JSON + SVG snapshot
VENV_PY="./tools/api_server/venv/bin/python3"
[ ! -x "$VENV_PY" ] && VENV_PY="python3"

SVG_PATH="$OUT/${STEM}.svg"
JSON_PATH="$OUT/${STEM}.json"

"$VENV_PY" scripts/workspace_snapshot.py --port "$PORT" --out "$OUT" --name "$STEM"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TUI txt  : $TXT_PATH"
echo "  JSON     : $JSON_PATH"
echo "  SVG      : $SVG_PATH"
echo ""
echo "👀 CHECK: does the SVG match what you see in tmux?"
echo ""
