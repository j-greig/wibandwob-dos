#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Primary: blessed imports in microapps
blessed_microapp_count=$(grep -rl "import blessed" microapps/ --include='*.ts' 2>/dev/null | grep -v node_modules | grep -v ".disabled" | wc -l | tr -d ' ')
echo "METRIC blessed_microapp_count=$blessed_microapp_count"

# Secondary
app_controller_lines=$(wc -l < src/core/app-controller.ts | tr -d ' ')
echo "METRIC app_controller_lines=$app_controller_lines"

as_any_count=$(grep -rn 'as any' src/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "METRIC as_any_count=$as_any_count"

god_file_count=$(find src/ -name '*.ts' -exec wc -l {} + 2>/dev/null | sort -rn | awk '$1 > 500 && !/total$/ {count++} END {print count+0}')
echo "METRIC god_file_count=$god_file_count"

tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
