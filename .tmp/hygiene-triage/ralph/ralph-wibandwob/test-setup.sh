#!/bin/bash
# Verify ralph-wibandwob setup

set -euo pipefail

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  echo "✓ PASS: $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo "✗ FAIL: $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

echo "Testing ralph-wibandwob setup..."
echo ""

# Test 1: Main script exists and is executable
if [[ -x "ralph-wibandwob.sh" ]]; then
  pass "ralph-wibandwob.sh is executable"
else
  fail "ralph-wibandwob.sh not executable"
fi

# Test 2: System prompt exists
if [[ -f "wibandwob-base.md" ]]; then
  pass "wibandwob-base.md exists"
else
  fail "wibandwob-base.md not found"
fi

# Test 3: Task file exists
if [[ -f "PROMPT.md" ]]; then
  pass "PROMPT.md exists"
else
  fail "PROMPT.md not found"
fi

# Test 4: Module loader exists and is executable
if [[ -x "scripts/load-modules.sh" ]]; then
  pass "scripts/load-modules.sh is executable"
else
  fail "scripts/load-modules.sh not executable"
fi

# Test 5: JSON config is valid
if jq empty ralph-modules.json 2>/dev/null; then
  pass "ralph-modules.json is valid JSON"
else
  fail "ralph-modules.json is invalid"
fi

# Test 6: Log directories exist
if [[ -d "logs/prompts" ]]; then
  pass "logs/prompts directory exists"
else
  fail "logs/prompts directory missing"
fi

# Test 7: Optional modules exist
if [[ -f "modules/chaos-amplifier.md" ]] && [[ -f "modules/structure-amplifier.md" ]]; then
  pass "Optional modules exist"
else
  fail "Optional modules missing"
fi

# Test 8: Module loader runs without error (with empty config)
if output=$(./scripts/load-modules.sh 2>&1); then
  pass "Module loader runs (no modules enabled)"
else
  fail "Module loader failed: $output"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $TESTS_FAILED -eq 0 ]]; then
  echo "✓ All tests passed!"
  exit 0
else
  echo "✗ Some tests failed"
  exit 1
fi
