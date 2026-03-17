#!/bin/bash
# Test helper functions for Ralph testing

setup_test_env() {
  TEST_NAME=$1
  export TEST_DIR="/tmp/ralph-test-${TEST_NAME}-$$"
  mkdir -p "$TEST_DIR"
  cd "$TEST_DIR"

  # Copy Ralph plugin
  mkdir -p .claude/skills
  cp -r "$REPO_ROOT/.claude/skills/ralph-wiggum" .claude/skills/

  # Copy prompts
  cp -r "$REPO_ROOT/prompts" .

  # Create default module config
  echo '{"enabled_modules":[],"available_modules":["french","crabs","pirate"]}' > .claude/ralph-modules.json

  # Initialize git (required for some tests)
  git init -q 2>/dev/null
  git config user.email "test@test.com"
  git config user.name "Test"
}

log_pass() {
  echo "✅ PASS: $1"
}

log_fail() {
  echo "❌ FAIL: $1"
}

cleanup_test_env() {
  if [[ -n "${TEST_DIR:-}" ]] && [[ -d "$TEST_DIR" ]]; then
    cd /tmp
    rm -rf "$TEST_DIR"
  fi
}

# Helper to run Ralph setup script
run_ralph_setup() {
  .claude/skills/ralph-wiggum/scripts/setup-ralph-loop.sh "$@"
}

# Helper to check if file contains text
file_contains() {
  local file=$1
  local text=$2
  if [[ -f "$file" ]] && grep -q "$text" "$file"; then
    return 0
  else
    return 1
  fi
}
