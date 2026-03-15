#!/bin/bash
set -euo pipefail

# E042-B02 SDK Composition Helpers — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: sdk_primitive_count ──
sdk_primitive_count=$(grep -cE "createSimpleStatusBar|createTextViewer|createListPanel|createSplitView|createSimpleButtonBar" src/services/microapp-sdk.ts 2>/dev/null || echo 0)
# Deduplicate (each appears in export + type export)
sdk_primitive_count=$(grep -oE "createSimpleStatusBar|createTextViewer|createListPanel|createSplitView|createSimpleButtonBar" src/services/microapp-sdk.ts 2>/dev/null | sort -u | wc -l | tr -d ' ')
echo "METRIC sdk_primitive_count=$sdk_primitive_count"

# ── Secondary ──

# Notepad SDK helper usage
notepad_dir=$(find microapps/ -maxdepth 1 -type d -name "*notepad*" 2>/dev/null | head -1)
if [ -n "$notepad_dir" ]; then
  notepad_sdk_usage=$(grep -coE "createSimpleStatusBar|createTextViewer|createListPanel|createSplitView|createSimpleButtonBar" "$notepad_dir/index.ts" 2>/dev/null || echo 0)
else
  notepad_sdk_usage=0
fi
echo "METRIC notepad_sdk_usage=$notepad_sdk_usage"

# SDK gap count
sdk_gaps=$(grep -rn "from ['\"].*src/core/\|from ['\"].*src/services/" microapps/ --include='*.ts' 2>/dev/null | grep -v "microapp-sdk" | wc -l | tr -d ' ' || true)
sdk_gaps=${sdk_gaps:-0}
echo "METRIC sdk_gap_count=$sdk_gaps"

# Doc exists
if [ -f docs/sdk-primitives.md ] && [ -s docs/sdk-primitives.md ]; then
  echo "METRIC doc_exists=1"
else
  echo "METRIC doc_exists=0"
fi

# Typecheck time
tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
