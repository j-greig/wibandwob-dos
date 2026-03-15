#!/bin/bash
set -euo pipefail

# E042-B04 Infra Wrappers — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: raw_call_count ──
# Raw platform calls outside wrapper files and CLI

raw_fs=$(grep -rn 'readFileSync\|writeFileSync' src/ --include='*.ts' 2>/dev/null \
  | grep -v 'safe-fs\.ts' \
  | grep -v 'node_modules' \
  | wc -l | tr -d ' ')

raw_exec=$(grep -rn 'execSync\|spawnSync' src/ --include='*.ts' 2>/dev/null \
  | grep -v 'platform-commands\.ts' \
  | grep -v 'audio-process\.ts' \
  | grep -v 'append-log\.ts' \
  | grep -v 'node_modules' \
  | grep -v 'src/cli/' \
  | wc -l | tr -d ' ')

raw_call_count=$((raw_fs + raw_exec))
echo "METRIC raw_call_count=$raw_call_count"

# ── Secondary ──

echo "METRIC raw_fs_calls=$raw_fs"
echo "METRIC raw_exec_calls=$raw_exec"

# Wrapper count (how many wrapper modules exist)
wrapper_count=0
[ -f src/core/clipboard.ts ] && wrapper_count=$((wrapper_count + 1))
[ -f src/core/safe-fs.ts ] && wrapper_count=$((wrapper_count + 1))
[ -f src/core/platform-commands.ts ] && wrapper_count=$((wrapper_count + 1))
[ -f src/core/append-log.ts ] && wrapper_count=$((wrapper_count + 1))
[ -f src/services/audio-process.ts ] && wrapper_count=$((wrapper_count + 1))
echo "METRIC wrapper_count=$wrapper_count"

# Typecheck time
tc_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; $((tc_end - tc_start)) / 1000" | bc)"
