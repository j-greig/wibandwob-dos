#!/bin/bash
# Module loading tests for Ralph

source "$(dirname "$0")/../test-helpers.sh"

TEST_NAME="module-loading"
setup_test_env "$TEST_NAME"

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Base persona loads
test_base_persona_loads() {
  echo "Test: Base Ralph persona loads correctly"

  run_ralph_setup "test task" --max-iterations 1 >/dev/null 2>&1

  if file_contains .claude/ralph-loop.local.md "Ralph Wiggum"; then
    log_pass "Base persona loaded"
    return 0
  else
    log_fail "Base persona not found in state file"
    return 1
  fi
}

# Test 2: Single module loads
test_single_module_loads() {
  echo "Test: Single module loads correctly"

  # Enable crabs module
  jq '.enabled_modules = ["crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

  run_ralph_setup "test task" --max-iterations 1 >/dev/null 2>&1

  if file_contains .claude/ralph-loop.local.md "crab"; then
    log_pass "Single module (crabs) loaded"
    return 0
  else
    log_fail "Crabs module not found in state file"
    cat .claude/ralph-loop.local.md
    return 1
  fi
}

# Test 3: Multiple modules stack
test_multiple_modules_stack() {
  echo "Test: Multiple modules stack correctly"

  # Enable three modules
  jq '.enabled_modules = ["french", "crabs", "pirate"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

  run_ralph_setup "test task" --max-iterations 1 >/dev/null 2>&1

  if file_contains .claude/ralph-loop.local.md "French" && \
     file_contains .claude/ralph-loop.local.md "crab" && \
     file_contains .claude/ralph-loop.local.md "pirate"; then
    log_pass "Multiple modules stacked"
    return 0
  else
    log_fail "Not all modules found in state file"
    return 1
  fi
}

# Test 4: Missing module file handling
test_missing_module_file() {
  echo "Test: Missing module file handling"

  # Enable non-existent module
  jq '.enabled_modules = ["nonexistent"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

  # This should either warn (current) or fail (after fix #5)
  if run_ralph_setup "test task" --max-iterations 1 2>&1 | grep -i "not found\|error"; then
    log_pass "Missing module detected and reported"
    return 0
  else
    log_fail "Missing module not detected"
    return 1
  fi
}

# Test 5: Malformed JSON detected
test_malformed_json() {
  echo "Test: Malformed JSON detected"

  # Create invalid JSON
  echo '{"enabled_modules": ["crabs",]}' > .claude/ralph-modules.json

  # This should fail (after fix #4)
  if run_ralph_setup "test task" --max-iterations 1 2>&1 | grep -i "json\|error"; then
    log_pass "Malformed JSON detected"
    return 0
  else
    log_fail "Malformed JSON not detected"
    return 1
  fi
}

# Test 6: Empty prompt handling (already fixed in 290c22a)
test_empty_prompt() {
  echo "Test: Empty prompt handled correctly"

  # Try to run with no prompt
  if run_ralph_setup --max-iterations 1 2>&1 | grep -i "no prompt\|error"; then
    log_pass "Empty prompt detected and rejected"
    return 0
  else
    log_fail "Empty prompt not detected"
    return 1
  fi
}

# Test 7: Module with --- separator
test_module_with_separator() {
  echo "Test: Module containing --- doesn't break extraction"

  # Create test module with --- in content
  mkdir -p prompts/modules
  cat > prompts/modules/test-separator.md <<'EOF'
# Module: Test

## Directive
Test module with separator

## Examples

---

Some content after separator
EOF

  jq '.enabled_modules = ["test-separator"] | .available_modules += ["test-separator"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

  run_ralph_setup "test task" --max-iterations 1 >/dev/null 2>&1

  # State file should be created without breaking
  if [[ -f .claude/ralph-loop.local.md ]]; then
    # Extract prompt using the same method as stop-hook
    PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' .claude/ralph-loop.local.md)

    if [[ -n "$PROMPT_TEXT" ]] && echo "$PROMPT_TEXT" | grep -q "test task"; then
      log_pass "Module with --- handled correctly"
      return 0
    else
      log_fail "Prompt extraction failed with --- in module"
      echo "Extracted: $PROMPT_TEXT"
      return 1
    fi
  else
    log_fail "State file not created"
    return 1
  fi
}

# Run all tests
echo "========================================"
echo "Running Module Loading Tests"
echo "========================================"

if test_base_persona_loads; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_single_module_loads; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_multiple_modules_stack; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_missing_module_file; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_malformed_json; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_empty_prompt; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
if test_module_with_separator; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi

cleanup_test_env

echo ""
echo "Module Loading Tests: $TESTS_PASSED passed, $TESTS_FAILED failed"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
