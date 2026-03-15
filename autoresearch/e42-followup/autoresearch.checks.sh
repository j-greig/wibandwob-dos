#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bun run test 2>&1 | tail -1
bun run typecheck 2>&1 | tail -1
bun run check-coat 2>&1 | grep "COAT check" || true
echo "OK"
