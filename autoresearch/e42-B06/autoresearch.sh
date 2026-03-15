#!/bin/bash
set -euo pipefail

# E042-B06 Next Frontier — Autoresearch Benchmark
#
# STUB: The agent running B06 should update this script once they've
# audited B01–B05 and chosen a focus area. Until then, this collects
# all prior bucket metrics as a baseline snapshot.

cd "$(dirname "$0")/../.."

echo "=== B06 Baseline Snapshot ==="

# ── Carry forward from B01: dead code + cycles ──
unused_exports=$(bunx knip --no-progress 2>/dev/null | grep -c "unused export" || echo "?")
circular_deps=$(bunx madge --circular --no-spinner src/ 2>/dev/null | grep -c "→" || echo "?")
echo "METRIC unused_exports=$unused_exports"
echo "METRIC circular_deps=$circular_deps"

# ── Carry forward from B02: SDK ──
sdk_primitive_count=$(grep -cE "export.*(createStatusBar|createSplitView|createListPanel|createTextViewer|createButtonBar|createPanel|createTabs|createDataTable)" src/services/microapp-sdk.ts 2>/dev/null || echo 0)
sdk_gaps=$(grep -rn "from ['\"].*src/core/\|from ['\"].*src/services/" microapps/ --include='*.ts' 2>/dev/null | grep -v "microapp-sdk" | wc -l | tr -d ' ')
echo "METRIC sdk_primitive_count=$sdk_primitive_count"
echo "METRIC sdk_gaps=$sdk_gaps"

# ── Carry forward from B03: heroes ──
hero_apps=("hello-world" "notepad" "runtime-inspector" "figlet-banner" "layout-stress-test" "data-dashboard" "file-manager")
hero_pass=0
for app in "${hero_apps[@]}"; do
  dir=$(find microapps/ -maxdepth 1 -type d -name "*${app}*" 2>/dev/null | head -1)
  if [ -n "$dir" ]; then
    has_d=$(grep -rl "describeState" "$dir" --include='*.ts' 2>/dev/null | head -1)
    has_c=$(grep -rl "captureText" "$dir" --include='*.ts' 2>/dev/null | head -1)
    [ -n "$has_d" ] && [ -n "$has_c" ] && hero_pass=$((hero_pass + 1))
  fi
done
echo "METRIC hero_pass_count=$hero_pass"

# ── Carry forward from B04: wrappers ──
raw_fs=$(grep -rn 'readFileSync\|writeFileSync' src/ --include='*.ts' 2>/dev/null | grep -v 'safe-fs\.ts' | grep -v 'node_modules' | wc -l | tr -d ' ')
raw_exec=$(grep -rn 'execSync\|spawnSync' src/ --include='*.ts' 2>/dev/null | grep -v 'platform-commands\.ts' | grep -v 'audio-process\.ts' | grep -v 'node_modules' | grep -v 'src/cli/' | wc -l | tr -d ' ')
echo "METRIC raw_call_count=$((raw_fs + raw_exec))"

# ── Carry forward from B05: tests ──
if grep -q '"test"' package.json 2>/dev/null; then
  test_output=$(bun test 2>&1 || true)
  test_passing=$(echo "$test_output" | grep -oP '\d+ pass' | grep -oP '\d+' || echo 0)
  test_failing=$(echo "$test_output" | grep -oP '\d+ fail' | grep -oP '\d+' || echo 0)
  echo "METRIC test_passing=$test_passing"
  echo "METRIC test_failing=$test_failing"
else
  echo "METRIC test_passing=0"
  echo "METRIC test_failing=0"
fi

# ── Codebase health indicators ──
any_count=$(grep -rn "as any" src/core/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
max_file_lines=$(find src/ -name '*.ts' -exec wc -l {} + 2>/dev/null | sort -rn | head -1 | awk '{print $1}')
total_src_lines=$(find src/ -name '*.ts' -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
doc_files=$(find docs/ .agents/ -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
echo "METRIC any_count=$any_count"
echo "METRIC max_file_lines=$max_file_lines"
echo "METRIC total_src_lines=$total_src_lines"
echo "METRIC doc_count=$doc_files"

# Typecheck time
tc_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; $((tc_end - tc_start)) / 1000" | bc)"

# ── B06-specific primary metric ──
# STUB: Replace this with your chosen metric after audit.
# For now, output a placeholder so the harness doesn't break.
echo "METRIC b06_primary=0"
echo ""
echo "B06 agent: update this script with your chosen primary metric."
