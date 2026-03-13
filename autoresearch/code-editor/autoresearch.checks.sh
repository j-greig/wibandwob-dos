#!/usr/bin/env bash
set -euo pipefail

echo "=== typecheck ==="
cd /Users/james/Repos/wibandwob-dos
bun run typecheck

echo "=== API health ==="
curl -sf http://127.0.0.1:8099/health | grep -q '"ok":true'
echo "API healthy"

echo "=== All checks passed ==="
