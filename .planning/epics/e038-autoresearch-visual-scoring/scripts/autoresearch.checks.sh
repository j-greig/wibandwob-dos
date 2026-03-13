#!/bin/bash
set -euo pipefail

# ── 1. Typecheck ─────────────────────────────────────────────────────
echo "typecheck..."
bun run typecheck 2>&1 | grep -i error && { echo "TYPECHECK FAILED"; exit 1; } || true

# ── 2. Module load verification ──────────────────────────────────────
echo "verifying module loaded..."

# Check API is up
curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 || {
  echo "ERROR: API not healthy — app may have crashed"
  exit 1
}

# Verify LLM Orch Studio window exists in state (give it a moment after open)
sleep 1
curl -sf http://127.0.0.1:8099/state 2>&1 | grep -q "LLM Orch Studio" || {
  echo "ERROR: LLM Orch Studio window not found in /state"
  echo "Attempting to open it..."
  curl -sf http://127.0.0.1:8099/commands/run \
    -X POST -H 'Content-Type: application/json' \
    -d '{"command":"microapp.wibwob.llm-orch-studio.open"}' > /dev/null 2>&1
  sleep 2
  curl -sf http://127.0.0.1:8099/state 2>&1 | grep -q "LLM Orch Studio" || {
    echo "ERROR: LLM Orch Studio still not found after retry"
    exit 1
  }
}

echo "checks passed"
