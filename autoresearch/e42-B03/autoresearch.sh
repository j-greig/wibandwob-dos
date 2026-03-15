#!/bin/bash
set -euo pipefail

# E042-B03 Hero 7 — Autoresearch Benchmark

cd "$(dirname "$0")/../.."

# ── Primary: hero_pass_count ──
# Heroes that have both describeState and captureText in source
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

# ── Secondary ──

# hello-world line count
hw_dir=$(find microapps/ -maxdepth 1 -type d -name "*hello-world*" 2>/dev/null | head -1)
if [ -n "$hw_dir" ]; then
  hw_main=$(find "$hw_dir" -name '*.ts' -not -name '*.d.ts' | head -1)
  if [ -n "$hw_main" ]; then
    hello_world_lines=$(wc -l < "$hw_main" | tr -d ' ')
  else
    hello_world_lines=999
  fi
else
  hello_world_lines=999
fi
echo "METRIC hello_world_lines=$hello_world_lines"

# SDK helper usage across heroes
hero_sdk_usage=0
for app in "${hero_apps[@]}"; do
  dir=$(find microapps/ -maxdepth 1 -type d -name "*${app}*" 2>/dev/null | head -1)
  if [ -n "$dir" ]; then
    count=$(grep -rcE "createStatusBar|createSplitView|createListPanel|createTextViewer|createButtonBar" "$dir" --include='*.ts' 2>/dev/null || echo 0)
    hero_sdk_usage=$((hero_sdk_usage + count))
  fi
done
echo "METRIC hero_sdk_usage=$hero_sdk_usage"

# Doc exists
if [ -f docs/microapp-examples.md ] && [ -s docs/microapp-examples.md ]; then
  echo "METRIC doc_exists=1"
else
  echo "METRIC doc_exists=0"
fi

# Typecheck time
tc_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; $((tc_end - tc_start)) / 1000" | bc)"
