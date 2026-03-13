#!/usr/bin/env bash
set -uo pipefail

echo "=== Unix Control v2 — Backlog Completion ==="

cd /Users/james/Repos/wibandwob-dos
WIBWOB="bun run src/cli/wibwob.ts"
API="http://127.0.0.1:8099"

PASS=0
FAIL=0
TOTAL=10

check() {
  local num="$1"
  local desc="$2"
  local result="$3"
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ #$num $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ #$num $desc — $result"
  fi
}

# ── Item 1: Zod param schemas on AppCommandDefinition ────
# Check: does the interface have a params field?
HAS_PARAMS=$(sed -n '/^export interface AppCommandDefinition/,/^}/p' src/core/command-catalog.ts | grep -c 'params' 2>/dev/null || true)
HAS_PARAMS=${HAS_PARAMS:-0}
# Check: does a bad arg to window.move return 400?
BAD_MOVE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"window.move","args":{"id":"not-a-number","x":"bad","y":"bad"}}')
if [ "$HAS_PARAMS" -gt 0 ] && [ "$BAD_MOVE_STATUS" = "400" ]; then
  check 1 "Zod param schemas (params field + 400 on bad args)" "PASS"
else
  check 1 "Zod param schemas (params field + 400 on bad args)" "params=$HAS_PARAMS, bad_move_status=$BAD_MOVE_STATUS"
fi

# ── Item 2: Return type hints ───────────────────────────
IFACE_RETURNS=$(sed -n '/^export interface AppCommandDefinition/,/^}/p' src/core/command-catalog.ts | grep -c 'returns' 2>/dev/null || true)
IFACE_RETURNS=${IFACE_RETURNS:-0}
if [ "$IFACE_RETURNS" -gt 0 ]; then
  check 2 "Return type hints on AppCommandDefinition" "PASS"
else
  check 2 "Return type hints on AppCommandDefinition" "no returns field in interface"
fi

# ── Item 3: CI parity script ────────────────────────────
# Check: does a CI config or CI test script exist?
HAS_CI=0
[ -f .github/workflows/cli-parity.yml ] && HAS_CI=1
[ -f .github/workflows/cli-test.yml ] && HAS_CI=1
[ -f .github/workflows/ci.yml ] && HAS_CI=1
[ -f scripts/ci-cli-test.sh ] && HAS_CI=1
if [ "$HAS_CI" -eq 1 ]; then
  check 3 "CI parity script exists" "PASS"
else
  check 3 "CI parity script exists" "no CI config found"
fi

# ── Item 4: Benchmark script ────────────────────────────
HAS_BENCH=0
[ -f scripts/benchmark-cli.sh ] && HAS_BENCH=1
[ -f autoresearch/unix-control-v2/benchmark.sh ] && HAS_BENCH=1
[ -f src/cli/benchmark.sh ] && HAS_BENCH=1
if [ "$HAS_BENCH" -eq 1 ]; then
  check 4 "Benchmark: CLI vs curl vs MCP" "PASS"
else
  check 4 "Benchmark: CLI vs curl vs MCP" "no benchmark script found"
fi

# ── Item 5: Per-command --help ───────────────────────────
# Uses wibwob itself to test
HELP_OUT=$($WIBWOB window.move --help 2>&1 || true)
if echo "$HELP_OUT" | grep -qi 'flag\|param\|usage\|--id\|--x\|--y'; then
  check 5 "Per-command --help (window.move)" "PASS"
else
  check 5 "Per-command --help (window.move)" "no flag info in --help output"
fi

# ── Item 6: Tab completion ───────────────────────────────
COMP_OUT=$($WIBWOB completions --zsh 2>&1 || $WIBWOB completions 2>&1 || true)
if echo "$COMP_OUT" | grep -qi 'compdef\|complete\|compadd\|_wibwob'; then
  check 6 "Tab completion generation" "PASS"
else
  check 6 "Tab completion generation" "no completion output"
fi

# ── Item 7: wibwob watch / event streaming ───────────────
# Check if /events endpoint exists (quick timeout probe)
EVENTS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 "$API/events" 2>/dev/null || echo "000")
WATCH_OUT=$($WIBWOB watch --help 2>&1 || true)
if [ "$EVENTS_STATUS" = "200" ] || echo "$WATCH_OUT" | grep -qi 'stream\|event\|watch'; then
  check 7 "Event streaming (wibwob watch)" "PASS"
else
  check 7 "Event streaming (wibwob watch)" "no /events endpoint ($EVENTS_STATUS), no watch subcommand"
fi

# ── Item 8: Naming hygiene — wibwob not ww ──────────────
# Uses wibwob to list commands and verify CLI self-references
WW_HITS=$(grep -rn '\bww\b' src/cli/ 2>/dev/null | grep -v 'WW_API' | wc -l | tr -d ' ')
if [ "$WW_HITS" = "0" ]; then
  check 8 "Naming hygiene in src/cli/ (no stale ww refs)" "PASS"
else
  check 8 "Naming hygiene in src/cli/ (no stale ww refs)" "$WW_HITS stale references"
fi

# ── Item 9: SURFACE_PARITY_ARCHITECTURE.md updated ──────
ARCH_FILE="autoresearch/unix-control/SURFACE_PARITY_ARCHITECTURE.md"
if [ -f "$ARCH_FILE" ]; then
  WW_IN_ARCH=$(grep -c '\bww\b' "$ARCH_FILE" 2>/dev/null || true)
  WW_IN_ARCH=${WW_IN_ARCH:-0}
  HAS_HTTP_ONLY=$(grep -ci 'http.only\|pure.http\|thin.http' "$ARCH_FILE" 2>/dev/null || true)
  HAS_HTTP_ONLY=${HAS_HTTP_ONLY:-0}
  if [ "$WW_IN_ARCH" -eq 0 ] && [ "$HAS_HTTP_ONLY" -gt 0 ]; then
    check 9 "SURFACE_PARITY_ARCHITECTURE.md updated" "PASS"
  else
    check 9 "SURFACE_PARITY_ARCHITECTURE.md updated" "ww_refs=$WW_IN_ARCH, http_only_mentions=$HAS_HTTP_ONLY"
  fi
else
  check 9 "SURFACE_PARITY_ARCHITECTURE.md updated" "file missing"
fi

# ── Item 10: Dogfood wibwob in test suite ────────────────
# Self-referential: this test uses wibwob to check if the v1 test suite dogfoods wibwob.
# Count curl vs wibwob usage in the v1 test suite
V1_TESTS="autoresearch/unix-control/autoresearch.sh"
if [ -f "$V1_TESTS" ]; then
  CURL_CALLS=$(grep -c 'curl ' "$V1_TESTS" 2>/dev/null || echo 0)
  WIBWOB_CALLS=$(grep -c '\$WIBWOB\|wibwob ' "$V1_TESTS" 2>/dev/null || echo 0)
  # Dogfooded = wibwob calls outnumber curl calls, and at most 1 curl remains
  if [ "$WIBWOB_CALLS" -gt "$CURL_CALLS" ] && [ "$CURL_CALLS" -le 1 ]; then
    check 10 "Dogfood wibwob in tests (wibwob=$WIBWOB_CALLS, curl=$CURL_CALLS)" "PASS"
  else
    check 10 "Dogfood wibwob in tests (wibwob=$WIBWOB_CALLS, curl=$CURL_CALLS)" "too much curl, not enough wibwob"
  fi
else
  check 10 "Dogfood wibwob in tests" "v1 test suite not found"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "=== Results: $PASS/$TOTAL items complete ==="
echo "METRIC:completion_count:$PASS"
exit 0
