#!/usr/bin/env bash
# minimap.sh — print desktop state to stdout
# [vps-ok] requires: WIBWOB_API, WIBWOB_TOKEN
# Usage: bash scripts/minimap.sh
set -euo pipefail

: "${WIBWOB_API:=http://127.0.0.1:8099}"
: "${WIBWOB_TOKEN:=}"

if [[ -z "$WIBWOB_TOKEN" ]]; then
  echo "ERROR: WIBWOB_TOKEN not set. Source .env or run connect.sh first." >&2
  exit 1
fi

curl -sf -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/state" | python3 - << 'EOF'
import sys, json
d    = json.load(sys.stdin)
wins = d.get('windows', [])
scr  = d.get('screen', {})
app  = d.get('app', {})
print(f"{scr.get('width','?')}x{scr.get('height','?')}  theme:{app.get('theme','?')}  profile:{app.get('deployProfile','?')}  session:{app.get('sessionId','?')}  {len(wins)} windows")
for w in wins:
    f = '◀' if w.get('focused') else ' '
    print(f"  {f}[{w['id']:>2}] {w.get('title','?'):<30}  {w.get('width','?')}x{w.get('height','?')}  @{w.get('left','?')},{w.get('top','?')}  {w.get('appType','')}")
EOF
