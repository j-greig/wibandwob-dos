#!/bin/bash
set -euo pipefail

# E042-B06 God File Decomposition — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: max_ui_parts_lines ──
ui_parts_lines=$(wc -l < src/core/ui-parts.ts | tr -d ' ')
echo "METRIC max_ui_parts_lines=$ui_parts_lines"

# ── Secondary ──

# God file count (files > 500 lines in src/)
god_files=$(find src/ -name '*.ts' -exec wc -l {} + 2>/dev/null | sort -rn | awk '$1 > 500 && !/total$/ {count++} END {print count+0}')
echo "METRIC god_file_count=$god_files"

# Top file lines
max_file_lines=$(find src/ -name '*.ts' -exec wc -l {} + 2>/dev/null | sort -rn | head -1 | awk '{print $1}')
echo "METRIC max_file_lines=$max_file_lines"

# ui submodule count
ui_submodules=$(ls src/core/ui-parts-*.ts 2>/dev/null | wc -l | tr -d ' ')
echo "METRIC ui_submodule_count=$ui_submodules"

# Circular deps (regression watch)
circular_deps=$(npx madge --circular --extensions ts src/ 2>/dev/null | grep -c "^[0-9])" || true)
echo "METRIC circular_deps=${circular_deps:-0}"

# Typecheck time
tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
