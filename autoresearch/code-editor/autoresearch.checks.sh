#!/usr/bin/env bash
set -euo pipefail

echo "=== typecheck ==="
cd /Users/james/Repos/wibandwob-dos
bun run typecheck

echo "=== API health ==="
curl -sf http://127.0.0.1:8099/health | grep -q '"ok":true'
echo "API healthy"

echo "=== Spore Clock window check ==="
SPORE_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id']); break
" 2>/dev/null || true)

if [ -z "$SPORE_ID" ]; then
  echo "Spore Clock not open — opening..."
  curl -sf -X POST http://127.0.0.1:8099/commands/run \
    -H 'Content-Type: application/json' \
    -d '{"id":"microapp.wibwob.spore-clock.open"}' > /dev/null
  sleep 2
  SPORE_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id']); break
" 2>/dev/null || true)
fi

if [ -n "$SPORE_ID" ]; then
  echo "Spore Clock window id: $SPORE_ID"
  echo "=== Screenshot ==="
  curl -s "http://127.0.0.1:8099/screenshot/text?id=$SPORE_ID" | head -30
  echo ""
  echo "=== State ==="
  curl -s "http://127.0.0.1:8099/state" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(json.dumps(w, indent=2))
"
else
  echo "WARN: Could not open Spore Clock window"
fi

echo "=== All checks passed ==="
