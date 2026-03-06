#!/usr/bin/env bash
# minimap.sh — ASCII art spatial map of the live WibWob-DOS desktop
# Usage: scripts/minimap.sh
# Fetches /state from port 8099 and renders scaled window rectangles.

set -euo pipefail

STATE=$(curl -sf http://127.0.0.1:8099/state 2>/dev/null) || {
  echo "WibWob-DOS not running (port 8099 unreachable)" >&2
  exit 1
}

python3 -c "
import sys, json

state = json.loads(sys.argv[1])
windows = state.get('windows', [])
screen  = state.get('screen', {})
sw, sh  = screen.get('width', 280), screen.get('height', 80)
focus_id      = state.get('focus', {}).get('windowId')
theme         = state.get('app', {}).get('theme', '?')
session_id    = state.get('app', {}).get('sessionId', '')
instance_label = state.get('app', {}).get('instanceLabel', '')

MW, MH = 62, 18
sx = MW / sw
sy = MH / (sh * 0.5)  # cell aspect 2:1

grid = [[' '] * MW for _ in range(MH)]

def clamp(v, lo, hi): return max(lo, min(hi, v))

def stamp(wx, wy, ww, wh, label, focused):
    x = clamp(round(wx * sx), 0, MW - 4)
    y = clamp(round(wy * sy), 0, MH - 3)
    w = clamp(round(ww * sx), 4, MW - x)
    h = clamp(round(wh * sy), 2, MH - y)
    for i in range(w):
        if x+i < MW:
            grid[y][x+i]     = '-'
            grid[y+h-1][x+i] = '-'
    for j in range(h):
        grid[y+j][x]       = '|'
        if x+w-1 < MW: grid[y+j][x+w-1] = '|'
    tl = '#' if focused else '+'
    grid[y][x]         = tl
    grid[y][x+w-1]     = tl
    grid[y+h-1][x]     = tl
    grid[y+h-1][x+w-1] = tl
    lbl = label[:w-2]
    for i, c in enumerate(lbl):
        grid[y+1][x+1+i] = c

for w in sorted(windows, key=lambda w: w.get('zIndex', 0)):
    lbl = f\"{w['id']}:{w['title'][:14]}\"
    stamp(w.get('left',0), w.get('top',0),
          w.get('width',10), w.get('height',5),
          lbl, w['id'] == focus_id)

f = state.get('focus', {})
focus_label = f\"{f.get('windowId','?')}:{f.get('title','?')}\" if f else 'none'
identity = f\"{instance_label}·{session_id}\" if instance_label else session_id
id_suffix = f\"  id:{identity}\" if identity else \"\"
print(f'WibWob-DOS  {theme}  {sw}x{sh}  {len(windows)} window{\"\" if len(windows)==1 else \"s\"}  focus:{focus_label}{id_suffix}')
print('  +' + '-'*MW + '+')
for row in grid:
    print('  |' + ''.join(row) + '|')
print('  +' + '-'*MW + '+')
print(f'  # = focused   + = other   {len(windows)} windows')
print()
for w in sorted(windows, key=lambda w: w['id']):
    focus_marker = ' ◀' if w['id'] == focus_id else ''
    z = w.get('zIndex', 0)
    print(f\"  {w['id']:3}  z{z:<2}  {w['title']:<28}  {w['width']}x{w['height']}  @{w['left']},{w['top']}{focus_marker}\")

# Inline overlap check — classify by severity
minor, heavy = [], []
for i,a in enumerate(windows):
    for j,b in enumerate(windows):
        if j<=i: continue
        ow = max(0, min(a['left']+a['width'], b['left']+b['width']) - max(a['left'],b['left']))
        oh = max(0, min(a['top']+a['height'], b['top']+b['height']) - max(a['top'],b['top']))
        cells = ow*oh
        if cells <= 0: continue
        area = min(a['width']*a['height'], b['width']*b['height'])
        pct = int(100*cells/area) if area else 0
        label = f\"{a['title'][:12]} ↔ {b['title'][:12]} ({ow}×{oh})\"
        (minor if pct < 5 else heavy).append(label)
if heavy:
    print()
    print('  ⚠ overlaps (fix): ' + '  '.join(heavy))
    print('  → bash scripts/overlap-check.sh  for bounds + fix hints')
elif minor:
    print()
    print('  ~ minor overlaps (may be intentional): ' + '  '.join(minor))
" "$STATE"
