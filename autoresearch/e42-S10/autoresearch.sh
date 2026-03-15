#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Primary: hero pass count
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

# Secondary
if [ -f src/windows/file-manager-window.ts ]; then
  echo "METRIC fm_in_src=1"
else
  echo "METRIC fm_in_src=0"
fi

fm_dir=$(find microapps/ -maxdepth 1 -type d -name "*file-manager*" 2>/dev/null | head -1)
if [ -n "$fm_dir" ] && [ -f "$fm_dir/index.ts" ]; then
  echo "METRIC fm_lines=$(wc -l < "$fm_dir/index.ts" | tr -d ' ')"
else
  echo "METRIC fm_lines=0"
fi

tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
