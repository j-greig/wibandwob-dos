#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Count export lines vs annotated lines in microapp-sdk.ts
total_exports=$(grep -cE "^export " src/services/microapp-sdk.ts 2>/dev/null || true)
total_exports=${total_exports:-0}
annotated=$(grep -cE "@public|@beta|@internal" src/services/microapp-sdk.ts 2>/dev/null || true)
annotated=${annotated:-0}
unannotated=$((total_exports - annotated))
[ "$unannotated" -lt 0 ] && unannotated=0

echo "METRIC unannotated_exports=$unannotated"
echo "METRIC public_count=$(grep -c "@public" src/services/microapp-sdk.ts 2>/dev/null || echo 0)"
echo "METRIC beta_count=$(grep -c "@beta" src/services/microapp-sdk.ts 2>/dev/null || echo 0)"
echo "METRIC internal_count=$(grep -c "@internal" src/services/microapp-sdk.ts 2>/dev/null || echo 0)"

tc_start=$(python3 -c 'import time; print(int(time.time()*1000))')
bun run typecheck >/dev/null 2>&1
tc_end=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "METRIC typecheck_seconds=$(echo "scale=2; ($tc_end - $tc_start) / 1000" | bc)"
