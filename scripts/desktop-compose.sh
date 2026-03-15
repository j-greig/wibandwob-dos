#!/usr/bin/env bash
# @name    desktop-compose
# @desc    Declarative multi-window layout from a JSON recipe file
#
# Usage:
#   ./scripts/desktop-compose.sh <recipe.json>
#   ./scripts/desktop-compose.sh --example     # print example recipe
#
# Recipe format:
#   {
#     "clear": true,                           // clear desktop first (default true)
#     "theme": "wibwob-dark",                  // optional theme switch
#     "windows": [
#       { "cmd": "microapp.wibwob.figlet.open",
#         "args": { "text": "HELLO", "font": "doom" },
#         "left": 0, "top": 1, "width": 60, "height": 12 },
#       { "cmd": "microapp.wibwob.contour.open",
#         "left": 62, "top": 1, "width": 80, "height": 40 }
#     ]
#   }
#
# Under the hood: wibwob CLI + ww-batch. No new API — pure COAT.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/runtime-env.sh"
API="$(ww_api_base)"
CLI="bun run $ROOT/src/cli/wibwob.ts"

if [[ "${1:-}" == "--example" ]]; then
  cat <<'EOF'
{
  "clear": true,
  "theme": "wibwob-dark",
  "windows": [
    { "cmd": "microapp.wibwob.figlet.open", "args": { "text": "WIB&WOB", "font": "doom" },
      "left": 2, "top": 1, "width": 70, "height": 12 },
    { "cmd": "microapp.wibwob.contour.open",
      "left": 2, "top": 14, "width": 85, "height": 30 },
    { "cmd": "microapp.wibwob.runtime-inspector.open",
      "left": 90, "top": 1, "width": 78, "height": 43 }
  ]
}
EOF
  exit 0
fi

RECIPE="${1:-}"
if [[ -z "$RECIPE" || ! -f "$RECIPE" ]]; then
  echo "Usage: $0 <recipe.json|--example>" >&2
  exit 1
fi

# Parse recipe
CLEAR=$(python3 -c "import sys,json; d=json.load(open(sys.argv[1])); print(d.get('clear',True))" "$RECIPE")
THEME=$(python3 -c "import sys,json; d=json.load(open(sys.argv[1])); print(d.get('theme',''))" "$RECIPE")
WINDOW_COUNT=$(python3 -c "import sys,json; d=json.load(open(sys.argv[1])); print(len(d.get('windows',[])))" "$RECIPE")

# Health check
curl -sf "$API/health" > /dev/null || { echo "ERROR: API not reachable at $API" >&2; exit 1; }

# Clear desktop
if [[ "$CLEAR" == "True" ]]; then
  echo "clearing desktop..."
  $CLI cmd desktop.clear-all > /dev/null 2>&1
  sleep 0.3
fi

# Theme switch
if [[ -n "$THEME" ]]; then
  echo "theme → $THEME"
  $CLI theme.set --name "$THEME" > /dev/null 2>&1
fi

# Snapshot window ids before
BEFORE=$(curl -sf "$API/state" | python3 -c "
import sys,json
print(','.join(str(w['id']) for w in json.load(sys.stdin)['windows']))
" 2>/dev/null || echo "")

# Open each window
echo "opening $WINDOW_COUNT windows..."
python3 -c "
import sys, json, subprocess, time

recipe = json.load(open(sys.argv[1]))
api = sys.argv[2]
cli = sys.argv[3].split()

for i, w in enumerate(recipe.get('windows', [])):
    cmd_args = cli + ['cmd', w['cmd']]
    for k, v in (w.get('args') or {}).items():
        cmd_args.extend([f'--{k}', str(v)])
    subprocess.run(cmd_args, capture_output=True)
    time.sleep(0.3)
    print(f'  [{i+1}/{len(recipe[\"windows\"])}] {w[\"cmd\"]}')
" "$RECIPE" "$API" "$CLI"

# Snapshot window ids after — diff to find new ones
sleep 0.5
AFTER=$(curl -sf "$API/state" | python3 -c "
import sys,json
print(','.join(str(w['id']) for w in json.load(sys.stdin)['windows']))
" 2>/dev/null || echo "")

# Build batch ops from new windows + recipe positions
python3 -c "
import sys, json

recipe = json.load(open(sys.argv[1]))
before = set(sys.argv[2].split(',')) if sys.argv[2] else set()
after = sys.argv[3].split(',') if sys.argv[3] else []
new_ids = [int(x) for x in after if x not in before]
windows = recipe.get('windows', [])

if len(new_ids) != len(windows):
    print(f'  ⚠ expected {len(windows)} new windows, got {len(new_ids)}', file=sys.stderr)
    # Best effort: use what we have
    new_ids = new_ids[:len(windows)]

ops = []
focus_id = None
for i, wid in enumerate(new_ids):
    w = windows[i]
    ops.append({
        'id': wid,
        'left': w.get('left', 0),
        'top': w.get('top', 1),
        'width': w.get('width', 80),
        'height': w.get('height', 24),
    })
    if w.get('focused'):
        focus_id = wid

if ops:
    import urllib.request
    body = json.dumps({'ops': ops}).encode()
    req = urllib.request.Request(
        f'{sys.argv[4]}/windows/batch',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    urllib.request.urlopen(req)

if focus_id:
    body = json.dumps({'ops': [{'id': focus_id, 'focus': True}]}).encode()
    req = urllib.request.Request(
        f'{sys.argv[4]}/windows/batch',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    urllib.request.urlopen(req)

print(f'positioned {len(ops)} windows')
" "$RECIPE" "$BEFORE" "$AFTER" "$API"

echo "done ✓"
