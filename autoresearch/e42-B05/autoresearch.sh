#!/bin/bash
set -euo pipefail

# E042-B05 Test + Benchmark Harness — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: test_pass_rate ──

if grep -q '"test"' package.json 2>/dev/null; then
  test_output=$(bun test 2>&1 || true)
  test_passing=$(echo "$test_output" | grep -oP '\d+ pass' | grep -oP '\d+' || echo 0)
  test_failing=$(echo "$test_output" | grep -oP '\d+ fail' | grep -oP '\d+' || echo 0)
  test_total=$((test_passing + test_failing))
  if [ "$test_total" -gt 0 ]; then
    test_pass_rate=$(echo "scale=1; $test_passing * 100 / $test_total" | bc)
  else
    test_pass_rate=0
  fi
else
  test_passing=0
  test_failing=0
  test_total=0
  test_pass_rate=0
fi

echo "METRIC test_pass_rate=$test_pass_rate"
echo "METRIC test_total=$test_total"
echo "METRIC test_passing=$test_passing"
echo "METRIC test_failing=$test_failing"

# ── Secondary ──

# Hero smoke tests passing (check if smoke test files exist and pass)
hero_smoke_count=0
if [ -d src/tests/smoke ]; then
  smoke_output=$(bun test src/tests/smoke/ 2>&1 || true)
  hero_smoke_count=$(echo "$smoke_output" | grep -oP '\d+ pass' | grep -oP '\d+' || echo 0)
fi
echo "METRIC hero_smoke_count=$hero_smoke_count"

# Boot time via wibwob CLI (if hyperfine available)
if command -v hyperfine >/dev/null 2>&1 && wibwob health >/dev/null 2>&1; then
  boot_ms=$(hyperfine --warmup 1 --runs 3 'wibwob health' --export-json /dev/stdout 2>/dev/null \
    | grep -oP '"mean":\s*[\d.]+' | head -1 | grep -oP '[\d.]+' || echo 0)
  boot_ms=$(echo "scale=0; $boot_ms * 1000" | bc 2>/dev/null || echo 0)
else
  boot_ms=0
fi
echo "METRIC boot_ms=$boot_ms"

# Typecheck time
tc_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; $((tc_end - tc_start)) / 1000" | bc)"
