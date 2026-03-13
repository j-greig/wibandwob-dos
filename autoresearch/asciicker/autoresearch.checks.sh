#!/usr/bin/env bash
set -euo pipefail

echo "=== typecheck ==="
cd /Users/james/Repos/wibandwob-dos
bun run typecheck

echo "=== API health ==="
curl -sf http://127.0.0.1:8099/health | grep -q '"ok":true'
echo "API healthy"

echo "=== Asciicker window check ==="
ASC_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id']); break
" 2>/dev/null || true)

if [ -z "$ASC_ID" ]; then
  echo "Asciicker not open — opening..."
  curl -sf -X POST http://127.0.0.1:8099/commands/run \
    -H 'Content-Type: application/json' \
    -d '{"id":"microapp.wibwob.asciicker.open"}' > /dev/null
  sleep 3
  ASC_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id']); break
" 2>/dev/null || true)
fi

if [ -n "$ASC_ID" ]; then
  echo "Asciicker window id: $ASC_ID"
  echo "=== Screenshot ==="
  curl -s "http://127.0.0.1:8099/screenshot/text?id=$ASC_ID" | head -30
  echo ""
  echo "=== State ==="
  curl -s "http://127.0.0.1:8099/state" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(json.dumps(w, indent=2))
"
else
  echo "FAIL: Could not open Asciicker window"
  exit 1
fi

echo "=== All checks passed ==="
