#!/bin/bash
# desktop-state.sh — UserPromptSubmit hook
# Injects compact desktop state if the WibWob-DOS API is reachable.
# Gives the agent instant awareness of desktop size, open windows, z-order.

# Try default port, then test port
STATE=""
for port in 8089 8090; do
  STATE=$(curl -sf --connect-timeout 1 "http://127.0.0.1:${port}/state" 2>/dev/null)
  if [ -n "$STATE" ]; then break; fi
done

if [ -z "$STATE" ]; then
  exit 0  # API not running, skip silently
fi

# Format compact state
python3 -c "
import sys, json

d = json.loads('''$STATE''')
desk = d.get('desktop', {})
wins = d.get('windows', [])
theme = d.get('theme_mode', '?')
variant = d.get('theme_variant', '?')

w, h = desk.get('w', '?'), desk.get('h', '?')
print(f'[WibWob-DOS Desktop {w}x{h} | {theme}/{variant} | {len(wins)} windows]')

for i, win in enumerate(wins):
    r = win.get('rect', {})
    t = win.get('type', '?')
    title = win.get('title', '')
    props = win.get('props', {})
    path = props.get('path', '') if isinstance(props, dict) else ''
    label = path.split('/')[-1] if path else title
    cl = props.get('content_lines', '') if isinstance(props, dict) else ''
    cw = props.get('content_width', '') if isinstance(props, dict) else ''
    dims = f' content:{cl}x{cw}' if cl and cw else ''
    anim = ' animated' if isinstance(props, dict) and props.get('animated') else ''
    print(f'  z{i}: {t} \"{label}\" ({r.get(\"x\",\"?\")},{r.get(\"y\",\"?\")}) {r.get(\"w\",\"?\")}x{r.get(\"h\",\"?\")}{dims}{anim}')
" 2>/dev/null

exit 0
