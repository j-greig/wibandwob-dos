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
API="$(ww_api_base)"

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
curl -sf "$API/health" > /dev/null || { echo "ERROR: API not reachable at $API" >&2; exit 1; }

# Fetch state and build workspace JSON (same format as workspaces/*.json)
RECIPE=$(curl -sf "$API/state" | python3 -c "
import sys, json
from datetime import datetime

state = json.load(sys.stdin)
name = '''$NAME''' or f'desktop-{datetime.now().strftime(\"%Y%m%d-%H%M%S\")}'
theme = state.get('app', {}).get('theme', '')
screen = state.get('screen', {})
windows = state.get('windows', [])
focus_id = state.get('focus', {}).get('windowId')

# Map appType → workspace type
def ws_type(w):
    app = w.get('appType', '')
    kind = w.get('kind', '')
    type_map = {
        'wibwob.figlet': 'figlet_text',
        'wibwob.runtime-inspector': 'runtime_inspector',
        'music-player': 'music_player',
        'terrain-lab': 'terrain_lab',
        'wibwob.contour': 'contour',
    }
    return type_map.get(app, app or kind)

# Extract props from details
def extract_props(w):
    d = w.get('details', {})
    app = w.get('appType', '')
    props = {}

    if app == 'wibwob.figlet':
        if d.get('inputText'): props['text'] = d['inputText']
        if d.get('font'): props['font'] = d['font']
    elif app == 'terrain-lab':
        if d.get('terrain'): props['terrain'] = d['terrain']
        if d.get('seed'): props['seed'] = d['seed']
        if d.get('mode'): props['mode'] = d['mode']
    elif app == 'music-player':
        if d.get('filePath'): props['file'] = d['filePath']

    return props

focused_idx = 0
ws_windows = []
for i, w in enumerate(windows):
    entry = {
        'id': f'w{i+1}',
        'type': ws_type(w),
        'title': w.get('title', ''),
        'bounds': {
            'x': w['left'],
            'y': w['top'],
            'w': w['width'],
            'h': w['height'],
        },
        'zoomed': w.get('maximized', False),
        'props': extract_props(w),
    }
    ws_windows.append(entry)
    if w['id'] == focus_id:
        focused_idx = i

workspace = {
    'version': 1,
    'app': name,
    'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
    'screen': {'width': screen.get('width', 0), 'height': screen.get('height', 0)},
    'globals': {},
    'windows': ws_windows,
    'focusedIndex': focused_idx,
}
if theme:
    workspace['globals']['theme'] = theme

print(json.dumps(workspace, indent=2))
")

if [[ -n "$OUTFILE" ]]; then
  echo "$RECIPE" > "$OUTFILE"
  echo "saved → $OUTFILE ($(echo "$RECIPE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('windows',[])))")  windows)" >&2
else
  echo "$RECIPE"
fi
