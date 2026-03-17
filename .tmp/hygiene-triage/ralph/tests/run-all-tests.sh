#!/bin/bash
set -euo pipefail

export REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASSED=0
FAILED=0

run_test() {
  TEST_FILE=$1
  TEST_NAME=$(basename "$TEST_FILE" .sh)

  echo ""
  echo "=================================================="
  echo "Running: $TEST_NAME"
  echo "=================================================="

  if bash "$TEST_FILE"; then
    ((PASSED++))
    echo "✅ $TEST_NAME PASSED"
  else
    ((FAILED++))
    echo "❌ $TEST_NAME FAILED"
  fi
}

echo "========================================"
echo "Ralph Module System - Test Suite"
echo "========================================"

# Run unit tests
if ls "$REPO_ROOT"/tests/unit/*.sh 1>/dev/null 2>&1; then
  echo ""
  echo "Running Unit Tests..."
  for test in "$REPO_ROOT"/tests/unit/*.sh; do
    run_test "$test"
  done
fi

# Run integration tests
if ls "$REPO_ROOT"/tests/integration/*.sh 1>/dev/null 2>&1; then
  echo ""
  echo "Running Integration Tests..."
  for test in "$REPO_ROOT"/tests/integration/*.sh; do
    run_test "$test"
  done
fi

echo ""
echo "========================================="
echo "FINAL RESULTS: $PASSED passed, $FAILED failed"
echo "========================================="

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
