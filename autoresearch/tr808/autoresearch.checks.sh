#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"

echo "Running typecheck..."
cd "$REPO_ROOT" && bun run typecheck

echo "Checking health..."
curl -sf http://127.0.0.1:8099/health > /dev/null

echo "Checking TR-808 in state..."
STATE=$(curl -s http://127.0.0.1:8099/state)
echo "$STATE" | grep -q "808"

echo "All checks passed."
