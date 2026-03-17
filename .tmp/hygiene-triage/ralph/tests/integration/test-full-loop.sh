#!/bin/bash
# Full loop integration test

source "$(dirname "$0")/../test-helpers.sh"

TEST_NAME="full-loop"
setup_test_env "$TEST_NAME"

echo "========================================"
echo "Integration Test: Full Ralph Loop"
echo "========================================"

echo "Test: Loop runs and exits on completion promise"

# Run a simple Ralph loop that should complete immediately
run_ralph_setup "echo 'Starting...'; echo '<promise>DONE</promise>'" \
  --max-iterations 3 \
  --completion-promise "DONE" \
  >/dev/null 2>&1

# Check if state file was created
if [[ -f .claude/ralph-loop.local.md ]]; then
  log_pass "State file created"

  # Check if it contains the promise
  if grep -q "DONE" .claude/ralph-loop.local.md; then
    log_pass "Completion promise in state file"
  else
    log_fail "Completion promise missing"
    cleanup_test_env
    exit 1
  fi

  # Check if base persona was loaded
  if grep -q "Ralph" .claude/ralph-loop.local.md; then
    log_pass "Base Ralph persona loaded"
  else
    log_fail "Base persona not loaded"
    cleanup_test_env
    exit 1
  fi
else
  log_fail "State file not created"
  cleanup_test_env
  exit 1
fi

cleanup_test_env

echo ""
echo "✅ Full Loop Test PASSED"
exit 0
