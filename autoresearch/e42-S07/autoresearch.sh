#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Primary: createSimple* in SDK surface + microapps + docs
simple_prefix_count=$(grep -rn "createSimple" src/services/microapp-sdk.ts src/sdk/composition-helpers.ts microapps/ docs/ 2>/dev/null --include='*.ts' --include='*.md' | wc -l | tr -d ' ')
echo "METRIC simple_prefix_count=$simple_prefix_count"

# Secondary: createLayout* in internal files (should increase as we rename)
layout_prefix_count=$(grep -rn "createLayout" src/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "METRIC layout_prefix_count=$layout_prefix_count"

tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
