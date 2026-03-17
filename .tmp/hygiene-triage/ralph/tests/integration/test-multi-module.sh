#!/bin/bash
# Multi-module stacking integration test

source "$(dirname "$0")/../test-helpers.sh"

TEST_NAME="multi-module"
setup_test_env "$TEST_NAME"

echo "========================================"
echo "Integration Test: Multi-Module Stacking"
echo "========================================"

echo "Test: Multiple modules load and stack correctly"

# Enable crabs + pirate modules
jq '.enabled_modules = ["crabs", "pirate"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

# Run Ralph setup
run_ralph_setup "echo test" --max-iterations 1 >/dev/null 2>&1

# Verify state file contains both modules
if [[ -f .claude/ralph-loop.local.md ]]; then
  CONTENT=$(cat .claude/ralph-loop.local.md)

  if echo "$CONTENT" | grep -qi "crab"; then
    log_pass "Crabs module loaded"
  else
    log_fail "Crabs module not found"
    cleanup_test_env
    exit 1
  fi

  if echo "$CONTENT" | grep -qi "pirate"; then
    log_pass "Pirate module loaded"
  else
    log_fail "Pirate module not found"
    cleanup_test_env
    exit 1
  fi

  # Verify they're in the right order (base, then modules, then task)
  BASE_POS=$(echo "$CONTENT" | grep -n "Ralph Wiggum" | head -1 | cut -d: -f1)
  CRAB_POS=$(echo "$CONTENT" | grep -n -i "crab" | head -1 | cut -d: -f1)
  TASK_POS=$(echo "$CONTENT" | grep -n "# Task" | head -1 | cut -d: -f1)

  if [[ $BASE_POS -lt $CRAB_POS ]] && [[ $CRAB_POS -lt $TASK_POS ]]; then
    log_pass "Modules in correct order (base -> modules -> task)"
  else
    log_fail "Module order incorrect"
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
echo "✅ Multi-Module Test PASSED"
exit 0
