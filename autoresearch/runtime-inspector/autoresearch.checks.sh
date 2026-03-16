#!/bin/bash
set -euo pipefail

# ── 1. Typecheck ─────────────────────────────────────────────────────
echo "typecheck..."
bun run typecheck 2>&1 | grep -i error && { echo "TYPECHECK FAILED"; exit 1; } || true

# ── 2. Module load verification ──────────────────────────────────────
echo "verifying module loaded..."

curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 || {
  echo "ERROR: API not healthy — app may have crashed"
  exit 1
}

# Try to open Runtime Inspector — it may have been closed between scripts
curl -sf http://127.0.0.1:8099/commands/run \
  -X POST -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.runtime-inspector.open"}' > /dev/null 2>&1 || true
sleep 2
curl -sf http://127.0.0.1:8099/state 2>&1 | grep -q "runtime-inspector\|Runtime Inspector" || {
  echo "ERROR: Runtime Inspector could not be opened — microapp may have failed to load"
  exit 1
}

echo "checks passed"
