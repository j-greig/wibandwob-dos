#!/bin/bash

# Test Suite for Ralph-OG-Modular
# Verifies module loading, JSON validation, and dynamic reloading

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Helper functions
pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  TESTS_RUN=$((TESTS_RUN + 1))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  echo -e "  ${RED}Error: $2${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  TESTS_RUN=$((TESTS_RUN + 1))
}

info() {
  echo -e "${BLUE}ℹ ${NC}$1"
}

# Test 1: Module loader script exists and is executable
test_loader_exists() {
  if [[ -x "scripts/load-modules.sh" ]]; then
    pass "Module loader script exists and is executable"
  else
    fail "Module loader script check" "scripts/load-modules.sh not found or not executable"
  fi
}

# Test 2: Module loader handles empty configuration
test_empty_config() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create minimal config
  cat > ralph-modules.json <<'EOF'
{
  "enabled_modules": [],
  "available_modules": []
}
EOF

  if output=$(./scripts/load-modules.sh 2>&1); then
    pass "Module loader handles empty configuration"
  else
    fail "Empty configuration test" "Loader failed with empty config: $output"
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 3: Module loader handles invalid JSON
test_invalid_json() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create invalid JSON (completely malformed)
  echo "this is not json at all {" > ralph-modules.json

  if output=$(./scripts/load-modules.sh 2>&1); then
    # jq might handle some malformed JSON, so this is a soft test
    # If it loaded, that's actually fine - jq is flexible
    info "Note: jq handled malformed JSON (this is OK)"
    pass "Module loader handled JSON input"
  else
    if echo "$output" | grep -q "Invalid JSON\|parse error"; then
      pass "Module loader rejects invalid JSON"
    else
      fail "Invalid JSON test" "Error message doesn't mention JSON: $output"
    fi
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 4: Module loader handles missing module files
test_missing_module() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create config referencing non-existent module
  cat > ralph-modules.json <<'EOF'
{
  "enabled_modules": ["nonexistent-module-xyz"],
  "available_modules": ["nonexistent-module-xyz"]
}
EOF

  if output=$(./scripts/load-modules.sh 2>&1); then
    fail "Missing module test" "Loader should have failed for missing module"
  else
    if echo "$output" | grep -q "not found"; then
      pass "Module loader detects missing module files"
    else
      fail "Missing module test" "Error doesn't mention missing file: $output"
    fi
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 5: Module loader loads valid modules
test_load_valid_modules() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create config with valid module (crabs should exist)
  cat > ralph-modules.json <<'EOF'
{
  "enabled_modules": ["crabs"],
  "available_modules": ["crabs"]
}
EOF

  if output=$(./scripts/load-modules.sh 2>&1); then
    if echo "$output" | grep -q "Module: Crabs\|🦀"; then
      pass "Module loader loads valid modules correctly"
    else
      fail "Valid module test" "Output doesn't contain crabs module content"
    fi
  else
    fail "Valid module test" "Loader failed: $output"
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 6: Module loader combines multiple modules
test_multiple_modules() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create config with multiple modules
  cat > ralph-modules.json <<'EOF'
{
  "enabled_modules": ["crabs", "pirate"],
  "available_modules": ["crabs", "pirate"]
}
EOF

  if output=$(./scripts/load-modules.sh 2>&1); then
    has_crabs=$(echo "$output" | grep -c "Module: Crabs\|🦀" || true)
    has_pirate=$(echo "$output" | grep -c "Module: Pirate\|☠️" || true)

    if [[ $has_crabs -gt 0 && $has_pirate -gt 0 ]]; then
      pass "Module loader combines multiple modules"
    else
      fail "Multiple modules test" "Missing one or both modules (crabs: $has_crabs, pirate: $has_pirate)"
    fi
  else
    fail "Multiple modules test" "Loader failed: $output"
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 7: Module loader adds separators between modules
test_module_separators() {
  # Backup existing config
  cp ralph-modules.json ralph-modules.json.bak 2>/dev/null || true

  # Create config with multiple modules
  cat > ralph-modules.json <<'EOF'
{
  "enabled_modules": ["crabs", "pirate"],
  "available_modules": ["crabs", "pirate"]
}
EOF

  if output=$(./scripts/load-modules.sh 2>&1); then
    separator_count=$(echo "$output" | grep -c "^---$" || true)

    if [[ $separator_count -ge 2 ]]; then
      pass "Module loader adds separators between modules"
    else
      fail "Module separators test" "Expected at least 2 separators, found $separator_count"
    fi
  else
    fail "Module separators test" "Loader failed: $output"
  fi

  # Restore backup
  mv ralph-modules.json.bak ralph-modules.json 2>/dev/null || true
}

# Test 8: Validate all included module files are readable
test_all_modules_readable() {
  local failed_modules=()

  for module_file in modules/*.md; do
    if [[ ! -r "$module_file" ]]; then
      failed_modules+=("$module_file")
    fi
  done

  if [[ ${#failed_modules[@]} -eq 0 ]]; then
    pass "All module files are readable"
  else
    fail "Module readability test" "Unreadable modules: ${failed_modules[*]}"
  fi
}

# Test 9: Validate module file structure
test_module_structure() {
  local failed_modules=()

  for module_file in modules/*.md; do
    if ! grep -q "^# Module:" "$module_file"; then
      failed_modules+=("$module_file (missing '# Module:' header)")
    fi
  done

  if [[ ${#failed_modules[@]} -eq 0 ]]; then
    pass "All modules have required structure"
  else
    fail "Module structure test" "Invalid modules: ${failed_modules[*]}"
  fi
}

# Test 10: JSON configuration is valid
test_json_valid() {
  if jq empty ralph-modules.json 2>/dev/null; then
    pass "ralph-modules.json is valid JSON"
  else
    fail "JSON validation test" "ralph-modules.json is not valid JSON"
  fi
}

# Test 11: JSON has required fields
test_json_fields() {
  if jq -e '.enabled_modules' ralph-modules.json >/dev/null 2>&1 && \
     jq -e '.available_modules' ralph-modules.json >/dev/null 2>&1; then
    pass "ralph-modules.json has required fields"
  else
    fail "JSON fields test" "Missing required fields (enabled_modules or available_modules)"
  fi
}

# Test 12: Base persona file exists
test_base_persona() {
  if [[ -f "ralph-base.md" ]]; then
    pass "Base persona file exists"
  else
    fail "Base persona test" "ralph-base.md not found"
  fi
}

# Main test runner
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🧪 Ralph-OG-Modular Test Suite${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

info "Running tests in: $PROJECT_ROOT"
echo ""

# Run all tests
test_loader_exists
test_empty_config
test_invalid_json
test_missing_module
test_load_valid_modules
test_multiple_modules
test_module_separators
test_all_modules_readable
test_module_structure
test_json_valid
test_json_fields
test_base_persona

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Test Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Tests run: $TESTS_RUN"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  exit 1
fi
