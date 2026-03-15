#!/bin/bash
# F7 Self-Maintaining CLI Help — behaviour test harness
set -uo pipefail
source ~/.wibwob

SCORE=0
TOTAL=0

check() {
  local label="$1"
  local pts="$2"
  local test="$3"
  TOTAL=$((TOTAL + pts))
  if eval "$test" 2>/dev/null 1>/dev/null; then
    echo "  ✓ $label (+$pts)"
    SCORE=$((SCORE + pts))
  else
    echo "  ✗ $label (0/$pts)"
  fi
}

# ── 0. Ensure app is running ──────────────────────────────────
bash scripts/ensure-running.sh > /dev/null 2>&1 || true
for i in $(seq 1 15); do
  wibwob health > /dev/null 2>&1 && break
  sleep 1
done
wibwob health > /dev/null 2>&1 || {
  echo "ERROR: wibwob health failed"
  exit 1
}

echo "Instance: $(wibwob health | jq -r '.instanceLabel') (pid $(wibwob health | jq -r '.pid'))"
echo ""

# ── Command Table Exists (10 pts) ────────────────────────────
echo "=== Command Table Exists (10 pts) ==="

check "CLI_COMMANDS array exists" 5 \
  "grep -q 'CLI_COMMANDS' src/cli/wibwob.ts"

check "CliCommand interface exists" 5 \
  "grep -q 'CliCommand' src/cli/wibwob.ts"

# ── Dispatch Works (25 pts) ──────────────────────────────────
echo ""
echo "=== Dispatch Works (25 pts) ==="

check "state dispatches" 5 \
  "wibwob state 2>/dev/null | jq -e '.windows'"

check "health dispatches" 5 \
  "wibwob health 2>/dev/null | jq -e '.ok'"

check "write dispatches (usage shown without args)" 5 \
  "wibwob write 2>&1; [ \$? -eq 1 ]"

check "read/screenshot dispatches" 5 \
  "wibwob read 2>&1; [ \$? -le 1 ]"

check "attach dispatches (recognized)" 5 \
  "grep -q 'attach' src/cli/wibwob.ts && grep -q '\"attach\"' src/cli/wibwob.ts"

# ── Help is Generated (20 pts) ───────────────────────────────
echo ""
echo "=== Help is Generated (20 pts) ==="

check "usage loops CLI_COMMANDS (not hardcoded)" 5 \
  "grep -q 'for.*of.*CLI_COMMANDS' src/cli/wibwob.ts"

check "all table entries appear in help" 5 \
  "H=\$(wibwob help 2>&1 || true); echo \"\$H\" | grep -q 'state' && echo \"\$H\" | grep -q 'health' && echo \"\$H\" | grep -q 'write' && echo \"\$H\" | grep -q 'minimap'"

check "completions in help (was missing)" 5 \
  "wibwob help 2>&1 | grep -q 'completions'"

check "no giant hardcoded usage block" 5 \
  "! grep -A50 'function usage' src/cli/wibwob.ts | grep -q 'wibwob state.*Full desktop'"

# ── Aliases Work (10 pts) ────────────────────────────────────
echo ""
echo "=== Aliases Work (10 pts) ==="

check "map aliases to minimap" 5 \
  "wibwob map 2>/dev/null > /tmp/ww-map-test.txt && grep -q 'WibWob-DOS' /tmp/ww-map-test.txt"

check "read aliases to screenshot" 5 \
  "wibwob read 2>&1 | wc -l | xargs test 0 -lt"

# ── Default Fallthrough (15 pts) ─────────────────────────────
echo ""
echo "=== Default Fallthrough (15 pts) ==="

check "dot-syntax works" 5 \
  "wibwob primer.list 2>/dev/null | jq -e '.ok'"

check "cmd <id> works" 5 \
  "wibwob cmd primer.list 2>/dev/null | jq -e '.ok'"

check "noun verb works" 5 \
  "wibwob primer list 2>/dev/null | jq -e '.ok'"

# ── Parity (20 pts) ──────────────────────────────────────────
echo ""
echo "=== Parity (20 pts) ==="

# All known subcommands appear in help
check "all known subcommands in help" 10 \
  "H=\$(wibwob help 2>&1 || true); for sub in state inspection windows commands health minimap screenshot read write instances attach completions cmd; do echo \"\$H\" | grep -q \"\$sub\" || exit 1; done"

# All subcommands still respond (not broken)
check "all subcommands respond" 10 \
  "wibwob state > /dev/null 2>&1 && wibwob health > /dev/null 2>&1 && wibwob windows -q > /dev/null 2>&1 && wibwob commands -q > /dev/null 2>&1"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "help_score: $SCORE / $TOTAL"
echo "========================================="
