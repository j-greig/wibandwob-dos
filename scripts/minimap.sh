#!/usr/bin/env bash
# minimap.sh — ASCII art spatial map of the live WibWob-DOS desktop
# Usage: scripts/minimap.sh
# Fetches /state from port 8099 and renders scaled window rectangles.

set -euo pipefail

STATE=$(curl -sf http://127.0.0.1:8099/state 2>/dev/null) || {
  echo "WibWob-DOS not running (port 8099 unreachable)" >&2
  exit 1
}

# Fetch terminal window text buffers (kind=terminal) for content peek
TERM_BUFS="{}"
if command -v python3 &>/dev/null; then
  TERM_IDS=$(python3 -c "
import json,sys
state=json.loads(sys.argv[1])
ids=[str(w['id']) for w in state.get('windows',[]) if w.get('appType')=='wibwob.terminal' or w.get('kind')=='terminal']
print(' '.join(ids))
" "$STATE" 2>/dev/null)
  if [ -n "$TERM_IDS" ]; then
    BUF_JSON="{"
    first=1
    for tid in $TERM_IDS; do
      raw=$(curl -sf "http://127.0.0.1:8099/windows/text?id=$tid" 2>/dev/null || echo '{}')
      text=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(json.dumps(d.get('text','')))" "$raw" 2>/dev/null || echo '""')
      [ $first -eq 0 ] && BUF_JSON="$BUF_JSON,"
      BUF_JSON="$BUF_JSON\"$tid\":$text"
      first=0
    done
    BUF_JSON="$BUF_JSON}"
    TERM_BUFS="$BUF_JSON"
  fi
fi

python3 -c "
import sys, json, re

state = json.loads(sys.argv[1])
term_bufs = json.loads(sys.argv[2])
windows = state.get('windows', [])
screen  = state.get('screen', {})
sw, sh  = screen.get('width', 280), screen.get('height', 80)
focus_id      = state.get('focus', {}).get('windowId')
theme         = state.get('app', {}).get('theme', '?')
instance_id    = state.get('app', {}).get('instanceId', '')
instance_label = state.get('app', {}).get('instanceLabel', '')

MW, MH = 62, 18
sx = MW / sw
sy = MH / (sh * 0.5)  # cell aspect 2:1

grid = [[' '] * MW for _ in range(MH)]

def clamp(v, lo, hi): return max(lo, min(hi, v))

def peek_terminal(buf, max_lines=3, max_width=30):
    '''Extract meaningful lines from a terminal buffer — skip chrome/noise.'''
    lines = buf.split('\n')
    result = []
    for line in lines:
        # strip block fill chars (background noise) and whitespace
        cleaned = line.replace('\u2592', '').replace('\u2591', '').replace('\u2593', '').strip()
        # skip empty, menu bar, or pure box-drawing lines
        if not cleaned:
            continue
        if re.search(r'File\s+Edit\s+View', cleaned):
            continue
        if re.match(r'^[\u2500-\u257f\s]+$', cleaned):
            continue
        # strip leading box/border chars (│ ┌ ─ etc) but keep content after
        cleaned = re.sub(r'^[\u2500-\u257f\s]+', '', cleaned).strip()
        if len(cleaned) >= 3:
            result.append(cleaned[:max_width])
        if len(result) >= max_lines:
            break
    return result

def stamp(wx, wy, ww, wh, label, focused, content_lines=None):
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
    if content_lines:
        for row_off, line in enumerate(content_lines[:h-3], start=2):
            if y+row_off >= MH-1: break
            snippet = line[:w-2]
            for i, c in enumerate(snippet):
                if x+1+i < MW: grid[y+row_off][x+1+i] = c

for w in sorted(windows, key=lambda w: w.get('zIndex', 0)):
    lbl = f\"{w['id']}:{w['title'][:14]}\"
    content = None
    if w.get('appType') == 'wibwob.terminal' or w.get('kind') == 'terminal':
        buf = term_bufs.get(str(w['id']), '')
        if buf:
            content = peek_terminal(buf)
    stamp(w.get('left',0), w.get('top',0),
          w.get('width',10), w.get('height',5),
          lbl, w['id'] == focus_id, content)

f = state.get('focus', {})
focus_label = f\"{f.get('windowId','?')}:{f.get('title','?')}\" if f else 'none'
identity = f\"{instance_label}·{instance_id}\" if instance_label else instance_id
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
" "$STATE" "$TERM_BUFS"
