#!/usr/bin/env bash
# autoresearch.checks.sh — verify music player still works after changes
set -euo pipefail
REPO_ROOT="$(pwd)"

# 1. Typecheck
echo "Running typecheck..."
cd "$REPO_ROOT"
bun run typecheck

# 2. Verify app is running
echo "Checking health..."
curl -sf http://127.0.0.1:8099/health > /dev/null

# 3. Verify music player window exists in state
echo "Checking music player in state..."
STATE=$(curl -s http://127.0.0.1:8099/state)
echo "$STATE" | grep -q "microapp" || echo "$STATE" | grep -q "Music"

echo "All checks passed."
