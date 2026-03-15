#!/bin/bash
set -euo pipefail

# E042 Solid Foundations — Autoresearch Benchmark
# Outputs METRIC name=number lines for all tracked metrics.

cd "$(dirname "$0")/../.."

# ── Primary composite: finding_count ──

# Unused exports (knip) — count lines of actual findings
if [ -f knip.json ]; then
  unused_exports=$(bunx knip --no-progress 2>/dev/null | grep -c "unused export" || echo 0)
else
  # No knip config yet — count known baseline
  unused_exports=66  # 28 unused exports + 38 unused types from audit
fi

# Circular dependencies (madge)
circular_deps=$(bunx madge --circular --no-spinner src/ 2>/dev/null | grep -c "→" || echo 0)

# SDK gap count — microapps importing directly from src/core/ or src/services/
sdk_gaps=$(grep -rn "from ['\"].*src/core/\|from ['\"].*src/services/" microapps/ --include='*.ts' 2>/dev/null | grep -v "microapp-sdk" | wc -l | tr -d ' ')

# Raw platform calls outside wrappers
raw_fs_calls=$(grep -rn 'readFileSync\|writeFileSync' src/ --include='*.ts' 2>/dev/null \
  | grep -v 'safe-fs\.ts' | grep -v 'node_modules' | wc -l | tr -d ' ')
raw_exec_calls=$(grep -rn 'execSync\|spawnSync' src/ --include='*.ts' 2>/dev/null \
  | grep -v 'platform-commands\.ts' | grep -v 'audio-process\.ts' \
  | grep -v 'node_modules' | grep -v 'cli' | wc -l | tr -d ' ')
raw_calls=$((raw_fs_calls + raw_exec_calls))

# Failing tests (0 = all pass, count failures otherwise)
if grep -q '"test"' package.json 2>/dev/null; then
  failing_tests=$(bun test 2>&1 | grep -c "fail" || echo 0)
else
  failing_tests=17  # no runner configured yet
fi

# Composite finding count
finding_count=$((unused_exports + circular_deps + sdk_gaps + raw_calls + failing_tests))

echo "METRIC finding_count=$finding_count"

# ── Secondary metrics ──

# Typecheck time
typecheck_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
typecheck_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
typecheck_ms=$((typecheck_end - typecheck_start))
typecheck_seconds=$(echo "scale=2; $typecheck_ms / 1000" | bc)
echo "METRIC typecheck_seconds=$typecheck_seconds"

# Max file lines in src/
max_file_lines=$(find src/ -name '*.ts' -exec wc -l {} + 2>/dev/null | sort -rn | head -1 | awk '{print $1}')
echo "METRIC max_file_lines=$max_file_lines"

# SDK primitive count (composition helpers exported from microapp-sdk.ts)
sdk_primitive_count=$(grep -c "export.*create\|export.*show" src/services/microapp-sdk.ts 2>/dev/null || echo 0)
echo "METRIC sdk_primitive_count=$sdk_primitive_count"

# Hero pass count (microapps with both describeState and captureText)
hero_apps=("hello-world" "notepad" "runtime-inspector" "figlet-banner" "layout-stress-test" "data-dashboard" "file-manager")
hero_pass=0
for app in "${hero_apps[@]}"; do
  dir=$(find microapps/ -maxdepth 1 -type d -name "*${app}*" 2>/dev/null | head -1)
  if [ -n "$dir" ]; then
    has_describe=$(grep -rl "describeState" "$dir" --include='*.ts' 2>/dev/null | head -1)
    has_capture=$(grep -rl "captureText" "$dir" --include='*.ts' 2>/dev/null | head -1)
    if [ -n "$has_describe" ] && [ -n "$has_capture" ]; then
      hero_pass=$((hero_pass + 1))
    fi
  fi
done
echo "METRIC hero_pass_count=$hero_pass"

# as any count in src/core/
any_count=$(grep -rn "as any" src/core/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "METRIC any_count=$any_count"

# Sub-metric breakdown (for debugging)
echo "METRIC unused_exports=$unused_exports"
echo "METRIC circular_deps=$circular_deps"
echo "METRIC sdk_gaps=$sdk_gaps"
echo "METRIC raw_calls=$raw_calls"
echo "METRIC failing_tests=$failing_tests"
