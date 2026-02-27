#!/usr/bin/env bash
# eval.sh — smoke-test codex-runner via claude -p slash-command invocation
#
# Usage:
#   ./eval.sh                    # all evals
#   ./eval.sh --eval devnote     # one eval by name
#
# Requires: claude CLI, skill symlinked at .claude/skills/codex-runner

set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --eval) ONLY="${2:-}"; shift ;;
    *) ;;
  esac
  shift
done

pass=0; fail=0

run_eval() {
  local name="$1" prompt="$2" must_contain="$3"
  [[ -n "$ONLY" && "$ONLY" != "$name" ]] && return 0
  printf "  %-32s" "$name ..."
  local output
  output=$(cd "$REPO_ROOT" && claude -p \
    --permission-mode dontAsk \
    --tools "" \
    --output-format text \
    "/codex-runner $prompt" 2>&1) || true
  if echo "$output" | grep -qi "$must_contain"; then
    echo "PASS"; pass=$((pass + 1))
  else
    echo "FAIL"
    echo "    Expected: '$must_contain'"
    echo "$output" | head -8 | sed 's/^/    /'
    fail=$((fail + 1))
  fi
  return 0
}

echo ""
echo "codex-runner eval — $(date '+%Y-%m-%d %H:%M')"
echo "Skill: $SKILL_DIR/SKILL.md"
echo ""

# 1. Basic invocation — does Claude call the script?
run_eval "uses-script" \
  "analyse app/wibwob_engine.cpp for race conditions" \
  "run.sh"

# 2. Implementation mode — --impl flag present?
run_eval "impl-flag" \
  "implement a fix for the race condition in app/wibwob_engine.cpp" \
  "\-\-impl"

# 3. DEVNOTE — implementation prompts must include the boilerplate
run_eval "devnote" \
  "write me an implementation prompt for refactoring app/wibwob_engine.cpp" \
  "DEVNOTE"

# 4. Monitoring — tail -f mentioned?
run_eval "monitoring" \
  "how do I check on a run that's already in the background?" \
  "tail"

# 5. Model override — env var pattern shown?
run_eval "model-override" \
  "how do I run with a specific model?" \
  "CODEX_MODEL"

echo ""
echo "Results: $pass passed, $fail failed"
echo ""
[[ $fail -eq 0 ]]
