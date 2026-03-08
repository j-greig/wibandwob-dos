#!/usr/bin/env bash
# minimap.sh — print desktop state to stdout
# [vps-ok] WIBWOB_TOKEN optional — omit for local no-auth instances
# Usage: bash scripts/minimap.sh
set -eo pipefail

: "${WIBWOB_API:=http://127.0.0.1:8099}"
: "${WIBWOB_TOKEN:=}"

TMP=$(mktemp)
trap "rm -f $TMP" EXIT

if [[ -n "$WIBWOB_TOKEN" ]]; then
  curl -sf -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/state" > "$TMP"
else
  curl -sf "$WIBWOB_API/state" > "$TMP"
fi

python3 - "$TMP" << 'EOF'
import sys, json
d    = json.load(open(sys.argv[1]))
wins = d.get('windows', [])
scr  = d.get('screen', {})
app  = d.get('app', {})
print(f"{scr.get('width','?')}x{scr.get('height','?')}  theme:{app.get('theme','?')}  profile:{app.get('deployProfile','?')}  session:{app.get('sessionId','?')}  {len(wins)} windows")
for w in wins:
    f = '◀' if w.get('focused') else ' '
    print(f"  {f}[{w['id']:>2}] {w.get('title','?'):<30}  {w.get('width','?')}x{w.get('height','?')}  @{w.get('left','?')},{w.get('top','?')}  {w.get('appType','')}")
EOF
