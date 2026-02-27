#!/usr/bin/env bash
# parity-check.sh — PreToolUse hook for Bash
#
# Fires on `git commit` commands. Checks if any staged files touch the
# C++/Python API surface. If so, runs source-parity contract tests.
# These tests parse source only — no running TUI needed.
#
# Catches: stale Python enums, missing schema types, phantom types,
# hardcoded command lists that should be auto-derived.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only fire on git commit
if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Check staged files for API surface changes
SURFACE_PATTERN="(window_type_registry\.cpp|command_registry\.cpp|tools/api_server/models\.py|tools/api_server/schemas\.py|tools/api_server/controller\.py)"
STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")

if [ -z "$STAGED" ]; then
  exit 0
fi

if ! echo "$STAGED" | grep -qE "$SURFACE_PATTERN"; then
  exit 0
fi

# Find pytest
PYTEST=""
if [ -x "tools/api_server/venv/bin/pytest" ]; then
  PYTEST="tools/api_server/venv/bin/pytest"
elif command -v pytest &>/dev/null; then
  PYTEST="pytest"
else
  echo "⚠️  pytest not found — skipping parity check (install: pip install pytest pydantic)"
  exit 0
fi

echo "🔍 API surface files staged — running parity contract tests..."

$PYTEST tests/contract/test_window_type_parity.py \
  tests/contract/test_parity_drift.py \
  tests/contract/test_no_hardcoded_migrated_command_lists.py \
  -v --tb=short -x 2>&1

RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "🚫 BLOCKED: parity contract tests failed."
  echo "   The Python API surface is out of sync with C++ source."
  echo "   Fix models.py / schemas.py to match window_type_registry.cpp"
  exit 1
fi
