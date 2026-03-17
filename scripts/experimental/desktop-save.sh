#!/usr/bin/env bash
# @name    desktop-save
# @desc    Snapshot current desktop layout to a recipe JSON (desktop-compose compatible)
#
# Usage:
#   ./scripts/experimental/desktop-save.sh                    # → stdout
#   ./scripts/experimental/desktop-save.sh layout.json        # → file
#   ./scripts/experimental/desktop-save.sh --name "my setup"  # with label
#
# Output is a desktop-compose.sh recipe: theme, windows with positions,
# sizes, open commands, and args. Reload with:
#   ./scripts/experimental/desktop-compose.sh layout.json

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"

# Parse args
OUTFILE=""
NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    -*) echo "Unknown flag: $1" >&2; exit 1 ;;
    *) OUTFILE="$1"; shift ;;
  esac
done

# Health check
ww_curl /health > /dev/null || { echo "ERROR: No WibWob-DOS instance found" >&2; exit 1; }

# Fetch state and build workspace JSON (v2 format — matches WorkspaceService)
RECIPE=$(ww_curl /state | python3 -c "
import sys, json

state = json.load(sys.stdin)
theme = state.get('app', {}).get('theme', '')
windows = state.get('windows', [])
focus_id = state.get('focus', {}).get('windowId')

# Build payload from details (strip summary/meta, keep app-specific props)
def build_payload(w):
    d = w.get('details', {})
    skip = {'summary', 'commandCount', 'focusedWindowId', 'blockerCount'}
    payload = {k: v for k, v in d.items() if k not in skip}
    return payload if payload else {}

ws_windows = []
for w in windows:
    entry = {
        'kind': w.get('kind', 'microapp'),
        'title': w.get('title', ''),
        'left': w['left'],
        'top': w['top'],
        'width': w['width'],
        'height': w['height'],
        'payload': build_payload(w),
    }
    if w['id'] == focus_id:
        entry['focused'] = True
    ws_windows.append(entry)

workspace = {
    'version': 2,
    'theme': theme or None,
    'windows': ws_windows,
}

print(json.dumps(workspace, indent=2))
")

if [[ -n "$OUTFILE" ]]; then
  echo "$RECIPE" > "$OUTFILE"
  echo "saved → $OUTFILE ($(echo "$RECIPE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('windows',[])))")  windows)" >&2
else
  echo "$RECIPE"
fi
