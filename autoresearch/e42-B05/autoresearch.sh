#!/bin/bash
set -euo pipefail

# E042-B05 Test + Benchmark Harness — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: test_pass_rate ──

test_output=$(bun test src/tests/unit/ 2>&1 || true)
test_passing=$(echo "$test_output" | grep -oE '[0-9]+ pass' | grep -oE '[0-9]+' | head -1 || echo 0)
test_failing=$(echo "$test_output" | grep -oE '[0-9]+ fail' | grep -oE '[0-9]+' | head -1 || echo 0)
test_passing=${test_passing:-0}
test_failing=${test_failing:-0}
test_total=$((test_passing + test_failing))
if [ "$test_total" -gt 0 ]; then
  test_pass_rate=$(echo "scale=1; $test_passing * 100 / $test_total" | bc)
else
  test_pass_rate=0
fi

echo "METRIC test_pass_rate=$test_pass_rate"
echo "METRIC test_total=$test_total"
echo "METRIC test_passing=$test_passing"
echo "METRIC test_failing=$test_failing"

# Integration test count (may fail if app not running)
integ_output=$(bun test src/tests/integration/ 2>&1 || true)
integ_passing=$(echo "$integ_output" | grep -oE '[0-9]+ pass' | grep -oE '[0-9]+' | head -1 || echo 0)
integ_failing=$(echo "$integ_output" | grep -oE '[0-9]+ fail' | grep -oE '[0-9]+' | head -1 || echo 0)
echo "METRIC integration_passing=${integ_passing:-0}"
echo "METRIC integration_failing=${integ_failing:-0}"

# Typecheck time
tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
