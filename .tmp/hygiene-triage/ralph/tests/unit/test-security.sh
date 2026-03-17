#!/bin/bash
# Security vulnerability tests for Ralph

source "$(dirname "$0")/../test-helpers.sh"

TEST_NAME="security"
setup_test_env "$TEST_NAME"

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Shell injection prevented
test_shell_injection() {
  echo "Test: Shell injection via \$(whoami) in task"

  # Try to inject command
  run_ralph_setup "Test \$(whoami)" --max-iterations 1 2>/dev/null || true

  # Check if whoami was NOT executed (literal string preserved)
  if [[ -f .claude/ralph-loop.local.md ]]; then
    if grep -F '$(whoami)' .claude/ralph-loop.local.md >/dev/null; then
      log_pass "Shell injection prevented - literal \$(whoami) preserved"
      return 0
    elif grep -F "$(whoami)" .claude/ralph-loop.local.md >/dev/null; then
      log_fail "Shell injection vulnerability - command was executed!"
      return 1
    else
      log_fail "Unexpected state - neither literal nor executed found"
      return 1
    fi
  else
    log_fail "State file not created"
    return 1
  fi
}

# Test 2: Backticks prevented
test_backticks_injection() {
  echo "Test: Shell injection via backticks in task"

  # Try to inject via backticks
  run_ralph_setup 'Test `date`' --max-iterations 1 2>/dev/null || true

  if [[ -f .claude/ralph-loop.local.md ]]; then
    if grep -F '`date`' .claude/ralph-loop.local.md >/dev/null; then
      log_pass "Backtick injection prevented"
      return 0
    else
      log_fail "Backtick injection vulnerability"
      return 1
    fi
  else
    log_fail "State file not created"
    return 1
  fi
}

# Test 3: YAML quote escaping in completion promise
test_yaml_quote_escaping() {
  echo "Test: Quotes in completion promise"

  run_ralph_setup "test" --completion-promise 'He said "hello"' --max-iterations 1 2>/dev/null || true

  if [[ -f .claude/ralph-loop.local.md ]]; then
    # Extract YAML frontmatter
    FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' .claude/ralph-loop.local.md)
    COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' || echo "")

    # Check if quotes were properly escaped (should contain "")
    # Input: He said "hello" → YAML: "He said ""hello"""
    if echo "$COMPLETION_PROMISE" | grep -q '""'; then
      log_pass "YAML quote escaping works - quotes doubled"
      return 0
    else
      log_fail "YAML quote escaping broken - quotes not escaped: $COMPLETION_PROMISE"
      return 1
    fi
  else
    log_fail "State file not created"
    return 1
  fi
}

# Test 4: Special characters preserved
test_special_chars() {
  echo "Test: Special characters in prompt preserved"

  SPECIAL_TEXT='Test $HOME and `echo test` and $(date)'
  run_ralph_setup "$SPECIAL_TEXT" --max-iterations 1 2>/dev/null || true

  if [[ -f .claude/ralph-loop.local.md ]]; then
    if grep -F '$HOME' .claude/ralph-loop.local.md >/dev/null; then
      log_pass "Special characters preserved"
      return 0
    else
      log_fail "Special characters not preserved"
      cat .claude/ralph-loop.local.md
      return 1
    fi
  else
    log_fail "State file not created"
    return 1
  fi
}

# Run all tests
echo "========================================"
echo "Running Security Tests"
echo "========================================"

if test_shell_injection; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_backticks_injection; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_yaml_quote_escaping; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_special_chars; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi

cleanup_test_env

echo ""
echo "Security Tests: $TESTS_PASSED passed, $TESTS_FAILED failed"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
