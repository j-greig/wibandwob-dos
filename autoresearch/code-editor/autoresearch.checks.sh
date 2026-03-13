#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

echo "=== typecheck ==="
cd "$REPO_ROOT" && bun run typecheck

echo "=== API health ==="
curl -sf http://127.0.0.1:8099/health > /dev/null

echo "=== editor window present ==="
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys, json
ws = json.load(sys.stdin)['windows']
found = any('microapp' in w.get('kind','').lower() or 'Edit' in w.get('title','') or 'Code' in w.get('title','') for w in ws)
if not found:
    print('ERROR: No editor window found in:', [w.get('title','') for w in ws])
    sys.exit(1)
print('OK: editor window found')
"

echo "=== all checks passed ==="
