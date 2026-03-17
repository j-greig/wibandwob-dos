#!/bin/bash
# Stop hook tests for Ralph

source "$(dirname "$0")/../test-helpers.sh"

TEST_NAME="stop-hook"
setup_test_env "$TEST_NAME"

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Frontmatter extraction works
test_frontmatter_extraction() {
  echo "Test: Frontmatter extraction from state file"

  # Create test state file
  cat > .claude/ralph-loop.local.md <<'EOF'
---
active: true
iteration: 1
max_iterations: 10
completion_promise: "DONE"
---

# Ralph persona
Test content

## Task
Do something
EOF

  # Extract using same method as stop-hook
  FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' .claude/ralph-loop.local.md)
  ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')

  if [[ "$ITERATION" == "1" ]]; then
    log_pass "Frontmatter extraction works"
    return 0
  else
    log_fail "Frontmatter extraction failed (got: $ITERATION)"
    return 1
  fi
}

# Test 2: Prompt extraction works
test_prompt_extraction() {
  echo "Test: Prompt extraction from state file"

  cat > .claude/ralph-loop.local.md <<'EOF'
---
active: true
iteration: 1
---

# Ralph persona
Base content

---

# Task
User task here
EOF

  # Extract using same method as stop-hook
  PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' .claude/ralph-loop.local.md)

  if echo "$PROMPT_TEXT" | grep -q "User task here"; then
    log_pass "Prompt extraction works"
    return 0
  else
    log_fail "Prompt extraction failed"
    echo "Got: $PROMPT_TEXT"
    return 1
  fi
}

# Test 3: Prompt with embedded --- separator
test_prompt_with_separator() {
  echo "Test: Prompt extraction with embedded ---"

  cat > .claude/ralph-loop.local.md <<'EOF'
---
active: true
iteration: 1
---

# Ralph persona

---

# Task

Document with separator:

---

More content
EOF

  # Extract using current method
  PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' .claude/ralph-loop.local.md)

  # Should get everything after 2nd ---
  if echo "$PROMPT_TEXT" | grep -q "More content"; then
    log_pass "Prompt with embedded --- extracted correctly"
    return 0
  else
    log_fail "Prompt with embedded --- failed"
    echo "Got: $PROMPT_TEXT"
    return 1
  fi
}

# Test 4: Completion promise extraction
test_completion_promise_extraction() {
  echo "Test: Completion promise extraction from YAML"

  cat > .claude/ralph-loop.local.md <<'EOF'
---
active: true
iteration: 1
completion_promise: "DONE"
---

Test content
EOF

  FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' .claude/ralph-loop.local.md)
  COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/')

  if [[ "$COMPLETION_PROMISE" == "DONE" ]]; then
    log_pass "Completion promise extracted correctly"
    return 0
  else
    log_fail "Completion promise extraction failed (got: $COMPLETION_PROMISE)"
    return 1
  fi
}

# Test 5: Special characters in frontmatter
test_special_chars_in_yaml() {
  echo "Test: Special characters in YAML frontmatter (doubled quotes)"

  cat > .claude/ralph-loop.local.md <<'EOF'
---
active: true
iteration: 1
completion_promise: "He said ""hello"""
---

Test content
EOF

  FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' .claude/ralph-loop.local.md)
  COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:')

  # Check for doubled quotes (valid YAML escaping)
  if echo "$COMPLETION_PROMISE" | grep -q '""'; then
    log_pass "YAML with doubled quotes is valid format"
    return 0
  else
    log_fail "YAML quote escaping incorrect: $COMPLETION_PROMISE"
    return 1
  fi
}

# Run all tests
echo "========================================"
echo "Running Stop Hook Tests"
echo "========================================"

if test_frontmatter_extraction; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_prompt_extraction; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_prompt_with_separator; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_completion_promise_extraction; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_special_chars_in_yaml; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi

cleanup_test_env

echo ""
echo "Stop Hook Tests: $TESTS_PASSED passed, $TESTS_FAILED failed"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
