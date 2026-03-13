#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

echo "=== typecheck ==="
cd "$REPO_ROOT" && bun run typecheck

echo "=== API health ==="
curl -sf http://127.0.0.1:8099/health > /dev/null

echo "=== WibWobWorld window present ==="
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys, json
ws = json.load(sys.stdin)['windows']
found = any('wibwobworld' in w.get('title','').lower() or 'WibWobWorld' in w.get('title','') for w in ws)
if not found:
    print('ERROR: No WibWobWorld window found in:', [w.get('title','') for w in ws])
    sys.exit(1)
print('OK: WibWobWorld window found')
"

echo "=== all checks passed ==="
