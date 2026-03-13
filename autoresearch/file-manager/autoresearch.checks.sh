#!/usr/bin/env bash
# Backpressure checks for File Manager autoresearch.
set -euo pipefail
REPO_ROOT="$(pwd)"

echo "── typecheck ──"
cd "$REPO_ROOT" && bun run typecheck

echo "── health ──"
curl -sf http://127.0.0.1:8099/health > /dev/null

echo "── file manager visible in /state ──"
STATE=$(curl -sf http://127.0.0.1:8099/state)
echo "$STATE" | grep -q '"kind":"browser"' || {
  echo "FAIL: no browser window in /state"
  echo "$STATE" | head -20
  exit 1
}

echo "All checks passed."
