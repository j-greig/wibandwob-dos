#!/bin/bash
set -euo pipefail

# Antopolis autoresearch checks
# 1. Typecheck passes
# 2. Module loads and window appears in /state

# When symlinked from repo root, pwd is already correct.
REPO_ROOT="$(pwd)"

echo "== typecheck =="
bun run typecheck

echo "== module load check =="
STATE=$(curl -sf http://127.0.0.1:8099/state 2>/dev/null || echo "{}")
if echo "$STATE" | grep -q "ANTOPOLIS"; then
  echo "OK: ANTOPOLIS window found in /state"
else
  echo "FAIL: ANTOPOLIS window not found in /state"
  echo "$STATE" | head -5
  exit 1
fi

echo "== all checks passed =="
